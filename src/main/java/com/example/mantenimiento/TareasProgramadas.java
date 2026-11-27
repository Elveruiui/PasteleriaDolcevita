package com.example.mantenimiento;

import java.io.File;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.CompositeHealth;
import org.springframework.boot.actuate.health.HealthComponent;
import org.springframework.boot.actuate.health.HealthEndpoint;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Component;

import com.example.model.Pedido;
import com.example.repository.EntregaRepository;
import com.example.repository.PedidoRepository;

/**
 * Tareas de mantenimiento programadas con cron: backup diario, revisión de pedidos y entregas, limpieza de backups antiguos y verificación del sistema. Guarda el resultado de la última ejecución de cada tarea.
 */
@Component
public class TareasProgramadas {

    private static final Logger log = LoggerFactory.getLogger(TareasProgramadas.class);

    @Autowired
    private BackupService backupService;

    @Autowired
    private PedidoRepository pedidoRepository;

    @Autowired
    private EntregaRepository entregaRepository;

    @Autowired
    private HealthEndpoint healthEndpoint;

    @Value("${mantenimiento.cron.backup:0 0 8 * * *}")
    private String cronBackup;

    @Value("${mantenimiento.cron.revision:0 0 8 * * *}")
    private String cronRevision;

    @Value("${mantenimiento.cron.limpieza:0 30 3 * * SUN}")
    private String cronLimpieza;

    @Value("${mantenimiento.cron.verificacion:0 0 * * * *}")
    private String cronVerificacion;

    private final Map<String, Map<String, Object>> ultimasEjecuciones = new ConcurrentHashMap<>();

    /**
     * Ejecuta el backup automático según la expresión cron mantenimiento.cron.backup.
     */
    @Scheduled(cron = "${mantenimiento.cron.backup:0 0 8 * * *}")
    public void backupDiario() {
        log.info("Iniciando backup automático programado");
        ejecutarBackup();
    }

    /**
     * Ejecuta la revisión diaria de pedidos y entregas según la expresión cron mantenimiento.cron.revision.
     */
    @Scheduled(cron = "${mantenimiento.cron.revision:0 0 8 * * *}")
    public void revisionDiaria() {
        log.info("Iniciando revisión diaria programada");
        revisar();
    }

    /**
     * Elimina los backups antiguos según la expresión cron mantenimiento.cron.limpieza.
     */
    @Scheduled(cron = "${mantenimiento.cron.limpieza:0 30 3 * * SUN}")
    public void limpiezaSemanal() {
        log.info("Iniciando limpieza semanal programada");
        limpiar();
    }

    /**
     * Verifica el estado del sistema según la expresión cron mantenimiento.cron.verificacion.
     */
    @Scheduled(cron = "${mantenimiento.cron.verificacion:0 0 * * * *}")
    public void verificacionPeriodica() {
        verificar();
    }

    /**
     * Consulta el endpoint de salud de Actuator y registra si la aplicación, la base de datos, el disco y los backups están funcionando.
     * @return estado general y estado de cada componente
     */
    public Map<String, Object> verificar() {
        HealthComponent salud = healthEndpoint.health();
        String estado = salud.getStatus().getCode();
        Map<String, Object> componentes = new LinkedHashMap<>();
        List<String> conProblemas = new ArrayList<>();
        if (salud instanceof CompositeHealth) {
            ((CompositeHealth) salud).getComponents().forEach((nombre, componente) -> {
                String estadoComponente = componente.getStatus().getCode();
                componentes.put(nombre, estadoComponente);
                if ("DOWN".equals(estadoComponente) || "OUT_OF_SERVICE".equals(estadoComponente)) {
                    conProblemas.add(nombre);
                }
            });
        }
        boolean ok = "UP".equals(estado) && conProblemas.isEmpty();
        if (ok) {
            log.info("Verificación del sistema: estado {} en todos los componentes", estado);
        } else {
            log.warn("Verificación del sistema: estado {}, componentes con problemas: {}", estado, conProblemas);
        }
        Map<String, Object> resultado = new LinkedHashMap<>();
        resultado.put("ok", ok);
        resultado.put("estado", estado);
        resultado.put("componentes", componentes);
        registrar("verificacion", ok, ok
                ? "Sistema " + estado + ": " + componentes.size() + " componentes funcionando"
                : "Estado " + estado + ". Con problemas: " + String.join(", ", conProblemas));
        return resultado;
    }

    /**
     * Restaura la base de datos desde un backup y registra el resultado.
     * @param archivo nombre del backup a restaurar
     * @return resultado de la restauración
     */
    public Map<String, Object> restaurar(String archivo) {
        Map<String, Object> resultado = new LinkedHashMap<>();
        try {
            Map<String, Object> datos = backupService.restaurarBackup(archivo);
            resultado.put("ok", true);
            resultado.putAll(datos);
            registrar("restauracion", true, "Restaurado desde " + archivo + " (respaldo previo: " + datos.get("respaldoPrevio") + ")");
        } catch (Exception e) {
            resultado.put("ok", false);
            resultado.put("mensaje", String.valueOf(e.getMessage()));
            registrar("restauracion", false, String.valueOf(e.getMessage()));
        }
        return resultado;
    }

    /**
     * Devuelve el resultado de la última restauración realizada.
     * @return fecha, éxito y descripción, o null si no hubo restauraciones
     */
    public Map<String, Object> ultimaRestauracion() {
        return ultimasEjecuciones.get("restauracion");
    }

    /**
     * Genera un backup y registra el resultado.
     * @return nombre y tamaño del backup, o el mensaje de error
     */
    public Map<String, Object> ejecutarBackup() {
        Map<String, Object> resultado = new LinkedHashMap<>();
        try {
            File archivo = backupService.generarBackup();
            resultado.put("ok", true);
            resultado.put("archivo", archivo.getName());
            resultado.put("tamanoKB", archivo.length() / 1024);
            registrar("backup", true, "Backup " + archivo.getName() + " (" + archivo.length() / 1024 + " KB)");
        } catch (Exception e) {
            resultado.put("ok", false);
            resultado.put("mensaje", String.valueOf(e.getMessage()));
            registrar("backup", false, String.valueOf(e.getMessage()));
        }
        return resultado;
    }

    /**
     * Revisa los pedidos pendientes desde hace más de 24 horas, los pedidos atrasados y las entregas con incidencia, y deja avisos en los logs.
     * @return cantidad encontrada de cada caso
     */
    public Map<String, Object> revisar() {
        LocalDateTime ahora = LocalDateTime.now();
        List<Pedido> pedidos = pedidoRepository.findAll();
        long pendientesAntiguos = pedidos.stream()
                .filter(p -> "PENDIENTE".equalsIgnoreCase(p.getEstado()))
                .filter(p -> p.getFecha_pedido() != null && p.getFecha_pedido().isBefore(ahora.minusHours(24)))
                .count();
        long atrasados = pedidos.stream()
                .filter(p -> p.getFecha_entrega() != null && p.getFecha_entrega().isBefore(ahora))
                .filter(p -> !"ENTREGADO".equalsIgnoreCase(p.getEstado()) && !"CANCELADO".equalsIgnoreCase(p.getEstado()))
                .count();
        long incidencias = entregaRepository.findAll().stream().filter(e -> e.getEstado() == 3).count();

        if (pendientesAntiguos > 0) {
            log.warn("Revisión: {} pedido(s) siguen pendientes desde hace más de 24 horas", pendientesAntiguos);
        }
        if (atrasados > 0) {
            log.warn("Revisión: {} pedido(s) pasaron su fecha de entrega sin completarse", atrasados);
        }
        if (incidencias > 0) {
            log.warn("Revisión: {} entrega(s) tienen una incidencia sin resolver", incidencias);
        }
        log.info("Revisión completada: pendientes antiguos={}, atrasados={}, incidencias={}", pendientesAntiguos, atrasados, incidencias);

        Map<String, Object> resultado = new LinkedHashMap<>();
        resultado.put("ok", true);
        resultado.put("pendientesAntiguos", pendientesAntiguos);
        resultado.put("pedidosAtrasados", atrasados);
        resultado.put("entregasConIncidencia", incidencias);
        boolean todoBien = pendientesAntiguos == 0 && atrasados == 0 && incidencias == 0;
        registrar("revision", todoBien, todoBien
                ? "Sin pendientes antiguos, atrasos ni incidencias"
                : pendientesAntiguos + " pendiente(s) antiguos, " + atrasados + " atrasado(s), " + incidencias + " incidencia(s)");
        return resultado;
    }

    /**
     * Elimina los backups antiguos y registra el resultado.
     * @return cantidad de backups eliminados
     */
    public Map<String, Object> limpiar() {
        int eliminados = backupService.eliminarBackupsAntiguos();
        Map<String, Object> resultado = new LinkedHashMap<>();
        resultado.put("ok", true);
        resultado.put("eliminados", eliminados);
        registrar("limpieza", true, eliminados + " backup(s) antiguos eliminados");
        return resultado;
    }

    /**
     * Lista las tareas programadas con su expresión cron, la próxima ejecución y el resultado de la última.
     * @return información de cada tarea
     */
    public List<Map<String, Object>> tareas() {
        List<Map<String, Object>> lista = new ArrayList<>();
        lista.add(tarea("backup", "Backup de la base de datos", "Copia completa de pasteleriaweb con mysqldump", cronBackup));
        lista.add(tarea("revision", "Revisión de pedidos y entregas", "Avisa de pedidos pendientes antiguos, atrasados e incidencias", cronRevision));
        lista.add(tarea("limpieza", "Limpieza de backups antiguos", "Elimina backups con más de " + backupService.getDiasRetencion() + " días", cronLimpieza));
        lista.add(tarea("verificacion", "Verificación del sistema", "Revisa que la aplicación, la base de datos, el disco y los backups estén funcionando", cronVerificacion));
        return lista;
    }

    private Map<String, Object> tarea(String id, String nombre, String descripcion, String cron) {
        Map<String, Object> datos = new LinkedHashMap<>();
        datos.put("id", id);
        datos.put("nombre", nombre);
        datos.put("descripcion", descripcion);
        datos.put("cron", cron);
        LocalDateTime proxima = CronExpression.parse(cron).next(LocalDateTime.now());
        datos.put("proxima", proxima != null ? proxima.toString() : null);
        Map<String, Object> ultima = ultimasEjecuciones.get(id);
        datos.put("ultima", ultima != null ? ultima.get("fecha") : null);
        datos.put("exito", ultima != null ? ultima.get("exito") : null);
        datos.put("resultado", ultima != null ? ultima.get("resultado") : null);
        return datos;
    }

    private void registrar(String id, boolean exito, String resultado) {
        Map<String, Object> datos = new LinkedHashMap<>();
        datos.put("fecha", LocalDateTime.now().toString());
        datos.put("exito", exito);
        datos.put("resultado", resultado);
        ultimasEjecuciones.put(id, datos);
    }
}
