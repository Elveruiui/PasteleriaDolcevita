package com.example.mantenimiento;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import io.micrometer.core.instrument.Metrics;

@Service
public class BackupService {

    private static final Logger log = LoggerFactory.getLogger(BackupService.class);

    private static final DateTimeFormatter FORMATO_ARCHIVO = DateTimeFormatter.ofPattern("yyyy-MM-dd_HHmmss");

    private static final Pattern URL_MYSQL = Pattern.compile("jdbc:mysql://([^:/?]+)(?::(\\d+))?/([^?]+)");

    @Value("${spring.datasource.url}")
    private String url;

    @Value("${spring.datasource.username}")
    private String usuario;

    @Value("${spring.datasource.password:}")
    private String clave;

    @Value("${mantenimiento.backups.carpeta:backups}")
    private String carpeta;

    @Value("${mantenimiento.backups.dias-retencion:15}")
    private int diasRetencion;

    @Value("${mantenimiento.mysql-bin:}")
    private String mysqlBin;

    public synchronized File generarBackup() throws Exception {
        String[] conexion = datosConexion();
        File destino = carpetaBackups();
        if (!destino.exists() && !destino.mkdirs()) {
            throw new Exception("No se pudo crear la carpeta de backups: " + destino.getAbsolutePath());
        }
        File archivo = new File(destino, conexion[2] + "_" + LocalDateTime.now().format(FORMATO_ARCHIVO) + ".sql");
        Path credenciales = crearCredenciales();
        long inicio = System.currentTimeMillis();
        try {
            List<String> comando = Arrays.asList(
                    rutaBinario("mysqldump"),
                    "--defaults-extra-file=" + credenciales.toAbsolutePath(),
                    "--host=" + conexion[0],
                    "--port=" + conexion[1],
                    "--single-transaction",
                    "--routines",
                    "--triggers",
                    "--databases", conexion[2],
                    "--result-file=" + archivo.getAbsolutePath());
            ProcessBuilder constructor = new ProcessBuilder(comando);
            constructor.redirectErrorStream(true);
            Process proceso = constructor.start();
            String salida;
            try (InputStream entrada = proceso.getInputStream()) {
                salida = new String(entrada.readAllBytes(), StandardCharsets.UTF_8).trim();
            }
            if (!proceso.waitFor(5, TimeUnit.MINUTES)) {
                proceso.destroyForcibly();
                throw new Exception("El backup tardó más de 5 minutos y fue cancelado.");
            }
            if (proceso.exitValue() != 0 || !archivo.exists() || archivo.length() == 0) {
                Files.deleteIfExists(archivo.toPath());
                throw new Exception("mysqldump terminó con error (código " + proceso.exitValue() + "): " + salida);
            }
        } catch (IOException e) {
            Metrics.counter("dolcevita.backups.fallidos").increment();
            log.error("No se pudo ejecutar mysqldump. Revisa la propiedad mantenimiento.mysql-bin", e);
            throw new Exception("No se encontró mysqldump. Configura la ruta en mantenimiento.mysql-bin.");
        } catch (Exception e) {
            Metrics.counter("dolcevita.backups.fallidos").increment();
            log.error("Backup fallido: {}", e.getMessage());
            throw e;
        } finally {
            Files.deleteIfExists(credenciales);
        }
        Metrics.counter("dolcevita.backups.exitosos").increment();
        log.info("Backup generado: {} ({} KB en {} ms)", archivo.getName(), archivo.length() / 1024, System.currentTimeMillis() - inicio);
        return archivo;
    }

    public synchronized Map<String, Object> restaurarBackup(String nombre) throws Exception {
        if (nombre == null || !nombre.matches("[A-Za-z0-9_\\-]+\\.sql")) {
            throw new Exception("El nombre del backup no es válido.");
        }
        File archivo = new File(carpetaBackups(), nombre);
        if (!archivo.isFile()) {
            throw new Exception("No existe el backup " + nombre + ".");
        }
        File respaldoPrevio = generarBackup();
        String[] conexion = datosConexion();
        Path credenciales = crearCredenciales();
        long inicio = System.currentTimeMillis();
        try {
            List<String> comando = Arrays.asList(
                    rutaBinario("mysql"),
                    "--defaults-extra-file=" + credenciales.toAbsolutePath(),
                    "--host=" + conexion[0],
                    "--port=" + conexion[1]);
            ProcessBuilder constructor = new ProcessBuilder(comando);
            constructor.redirectErrorStream(true);
            constructor.redirectInput(archivo);
            Process proceso = constructor.start();
            String salida;
            try (InputStream entrada = proceso.getInputStream()) {
                salida = new String(entrada.readAllBytes(), StandardCharsets.UTF_8).trim();
            }
            if (!proceso.waitFor(10, TimeUnit.MINUTES)) {
                proceso.destroyForcibly();
                throw new Exception("La restauración tardó más de 10 minutos y fue cancelada.");
            }
            if (proceso.exitValue() != 0) {
                throw new Exception("mysql terminó con error (código " + proceso.exitValue() + "): " + salida);
            }
        } catch (IOException e) {
            log.error("No se pudo ejecutar mysql para restaurar el backup", e);
            throw new Exception("No se encontró mysql. Configura la ruta en mantenimiento.mysql-bin.");
        } catch (Exception e) {
            log.error("Restauración fallida desde {}: {}", nombre, e.getMessage());
            throw e;
        } finally {
            Files.deleteIfExists(credenciales);
        }
        Metrics.counter("dolcevita.backups.restauraciones").increment();
        log.warn("Base de datos restaurada desde {} en {} ms (respaldo previo: {})", nombre, System.currentTimeMillis() - inicio, respaldoPrevio.getName());
        Map<String, Object> resultado = new LinkedHashMap<>();
        resultado.put("archivo", nombre);
        resultado.put("respaldoPrevio", respaldoPrevio.getName());
        return resultado;
    }

    public List<Map<String, Object>> listarBackups() {
        File[] archivos = carpetaBackups().listFiles((dir, nombre) -> nombre.toLowerCase().endsWith(".sql"));
        List<Map<String, Object>> lista = new ArrayList<>();
        if (archivos == null) {
            return lista;
        }
        Arrays.sort(archivos, Comparator.comparingLong(File::lastModified).reversed());
        for (File archivo : archivos) {
            Map<String, Object> datos = new LinkedHashMap<>();
            datos.put("nombre", archivo.getName());
            datos.put("tamanoKB", archivo.length() / 1024);
            datos.put("fecha", LocalDateTime.ofInstant(Instant.ofEpochMilli(archivo.lastModified()), ZoneId.systemDefault()).toString());
            lista.add(datos);
        }
        return lista;
    }

    public int eliminarBackupsAntiguos() {
        File[] archivos = carpetaBackups().listFiles((dir, nombre) -> nombre.toLowerCase().endsWith(".sql"));
        if (archivos == null) {
            return 0;
        }
        long limite = System.currentTimeMillis() - TimeUnit.DAYS.toMillis(diasRetencion);
        int eliminados = 0;
        for (File archivo : archivos) {
            if (archivo.lastModified() < limite) {
                if (archivo.delete()) {
                    eliminados++;
                    log.info("Backup antiguo eliminado: {}", archivo.getName());
                } else {
                    log.warn("No se pudo eliminar el backup antiguo: {}", archivo.getName());
                }
            }
        }
        log.info("Limpieza de backups completada: {} archivo(s) eliminados (retención de {} días)", eliminados, diasRetencion);
        return eliminados;
    }

    public File carpetaBackups() {
        return new File(carpeta).getAbsoluteFile();
    }

    public int getDiasRetencion() {
        return diasRetencion;
    }

    private String[] datosConexion() throws Exception {
        Matcher coincidencia = URL_MYSQL.matcher(url == null ? "" : url);
        if (!coincidencia.find()) {
            throw new Exception("No se pudo leer la URL de la base de datos: " + url);
        }
        String puerto = coincidencia.group(2) != null ? coincidencia.group(2) : "3306";
        return new String[] { coincidencia.group(1), puerto, coincidencia.group(3) };
    }

    private Path crearCredenciales() throws IOException {
        Path credenciales = Files.createTempFile("dolcevita-mysql", ".cnf");
        Files.write(credenciales, ("[client]\nuser=\"" + usuario + "\"\npassword=\"" + (clave == null ? "" : clave) + "\"\n")
                .getBytes(StandardCharsets.UTF_8));
        return credenciales;
    }

    private String rutaBinario(String programa) {
        boolean windows = System.getProperty("os.name", "").toLowerCase().contains("win");
        String ejecutable = windows ? programa + ".exe" : programa;
        if (mysqlBin != null && !mysqlBin.trim().isEmpty()) {
            return new File(mysqlBin.trim(), ejecutable).getAbsolutePath();
        }
        if (windows) {
            File base = new File("C:/Program Files/MySQL");
            File[] servidores = base.listFiles((dir, nombre) -> nombre.startsWith("MySQL Server"));
            if (servidores != null && servidores.length > 0) {
                Arrays.sort(servidores, Comparator.comparing(File::getName).reversed());
                for (File servidor : servidores) {
                    File candidato = new File(servidor, "bin/" + ejecutable);
                    if (candidato.exists()) {
                        return candidato.getAbsolutePath();
                    }
                }
            }
        }
        return ejecutable;
    }
}
