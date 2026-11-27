package com.example.mantenimiento;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

@Component("backups")
public class BackupHealthIndicator implements HealthIndicator {

    @Autowired
    private BackupService backupService;

    @Override
    public Health health() {
        List<Map<String, Object>> backups = backupService.listarBackups();
        if (backups.isEmpty()) {
            return Health.unknown()
                    .withDetail("carpeta", backupService.carpetaBackups().getAbsolutePath())
                    .withDetail("mensaje", "Todavía no hay backups")
                    .build();
        }
        Map<String, Object> ultimo = backups.get(0);
        LocalDateTime fecha = LocalDateTime.parse(String.valueOf(ultimo.get("fecha")));
        long horas = Duration.between(fecha, LocalDateTime.now()).toHours();
        Health.Builder estado = horas <= 48 ? Health.up() : Health.unknown();
        return estado
                .withDetail("ultimoBackup", ultimo.get("nombre"))
                .withDetail("horasDesdeUltimoBackup", horas)
                .withDetail("cantidad", backups.size())
                .withDetail("carpeta", backupService.carpetaBackups().getAbsolutePath())
                .build();
    }
}
