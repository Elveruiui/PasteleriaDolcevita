package com.example.mantenimiento;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Controlador REST de la sección Mantenimiento del panel del Administrador. Expone las rutas /mantenimiento, accesibles solo para el rol Administrador.
 */
@RestController
@RequestMapping("/mantenimiento")
public class MantenimientoController {

    @Autowired
    private TareasProgramadas tareasProgramadas;

    @Autowired
    private BackupService backupService;

    /**
     * Devuelve las tareas programadas, los backups existentes y la configuración de retención.
     * @return estado del mantenimiento
     */
    @GetMapping("/estado")
    public ResponseEntity<?> estado() {
        Map<String, Object> datos = new LinkedHashMap<>();
        datos.put("tareas", tareasProgramadas.tareas());
        datos.put("backups", backupService.listarBackups());
        datos.put("carpeta", backupService.carpetaBackups().getAbsolutePath());
        datos.put("diasRetencion", backupService.getDiasRetencion());
        datos.put("ultimaRestauracion", tareasProgramadas.ultimaRestauracion());
        return ResponseEntity.ok(datos);
    }

    /**
     * Genera un backup de la base de datos en el momento.
     * @return resultado del backup
     */
    @PostMapping("/backup")
    public ResponseEntity<?> backup() {
        Map<String, Object> resultado = tareasProgramadas.ejecutarBackup();
        boolean ok = Boolean.TRUE.equals(resultado.get("ok"));
        return ResponseEntity.status(ok ? HttpStatus.OK : HttpStatus.INTERNAL_SERVER_ERROR).body(resultado);
    }

    /**
     * Ejecuta la revisión de pedidos y entregas.
     * @return resultado de la revisión
     */
    @PostMapping("/revision")
    public ResponseEntity<?> revision() {
        return ResponseEntity.ok(tareasProgramadas.revisar());
    }

    /**
     * Ejecuta la verificación del estado del sistema.
     * @return estado de cada componente
     */
    @PostMapping("/verificacion")
    public ResponseEntity<?> verificacion() {
        return ResponseEntity.ok(tareasProgramadas.verificar());
    }

    /**
     * Restaura la base de datos desde un backup.
     * @param archivo nombre del backup
     * @return resultado de la restauración
     */
    @PostMapping("/restaurar")
    public ResponseEntity<?> restaurar(@RequestParam("archivo") String archivo) {
        Map<String, Object> resultado = tareasProgramadas.restaurar(archivo);
        boolean ok = Boolean.TRUE.equals(resultado.get("ok"));
        return ResponseEntity.status(ok ? HttpStatus.OK : HttpStatus.INTERNAL_SERVER_ERROR).body(resultado);
    }

    /**
     * Elimina los backups antiguos.
     * @return cantidad de backups eliminados
     */
    @PostMapping("/limpieza")
    public ResponseEntity<?> limpieza() {
        return ResponseEntity.ok(tareasProgramadas.limpiar());
    }
}
