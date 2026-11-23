package com.example.monitoreo;

import java.io.File;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

@Component("almacenamientoImagenes")
public class ImagenesHealthIndicator implements HealthIndicator {

    private static final String CARPETA = "uploads/productos/";

    @Override
    public Health health() {
        File carpeta = new File(CARPETA);
        if (!carpeta.exists() || !carpeta.isDirectory()) {
            return Health.down().withDetail("carpeta", CARPETA).withDetail("motivo", "La carpeta de imagenes no existe").build();
        }
        if (!carpeta.canWrite()) {
            return Health.down().withDetail("carpeta", CARPETA).withDetail("motivo", "No se puede escribir en la carpeta").build();
        }
        String[] archivos = carpeta.list();
        return Health.up()
                .withDetail("carpeta", CARPETA)
                .withDetail("imagenes", archivos == null ? 0 : archivos.length)
                .withDetail("espacioLibreMB", carpeta.getUsableSpace() / (1024 * 1024))
                .build();
    }
}
