package com.example.controller;

import java.time.LocalDate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.service.ReporteService;

@RestController
@RequestMapping("/reporte")
public class ReporteController {

    private static final Logger log = LoggerFactory.getLogger(ReporteController.class);

    private static final MediaType EXCEL =
            MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private static final MediaType PDF = MediaType.APPLICATION_PDF;

    @Autowired
    private ReporteService reporteService;

    @GetMapping("/pedidos")
    public ResponseEntity<?> reportePedidos() {
        try {
            return descargarExcel(reporteService.generarReportePedidos(), "reporte-pedidos");
        } catch (Exception e) {
            log.error("Error al generar el reporte de pedidos", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error al generar el reporte de pedidos");
        }
    }

    @GetMapping("/entregas")
    public ResponseEntity<?> reporteEntregas() {
        try {
            return descargarExcel(reporteService.generarReporteEntregas(), "reporte-entregas");
        } catch (Exception e) {
            log.error("Error al generar el reporte de entregas", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error al generar el reporte de entregas");
        }
    }

    @GetMapping("/productos")
    public ResponseEntity<?> reporteProductos() {
        try {
            return descargarExcel(reporteService.generarReporteProductos(), "reporte-productos");
        } catch (Exception e) {
            log.error("Error al generar el reporte de productos", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error al generar el reporte de productos");
        }
    }

    @GetMapping("/categorias")
    public ResponseEntity<?> reporteCategorias() {
        try {
            return descargarExcel(reporteService.generarReporteCategorias(), "reporte-categorias");
        } catch (Exception e) {
            log.error("Error al generar el reporte de categorías", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error al generar el reporte de categorías");
        }
    }

    @GetMapping("/usuarios")
    public ResponseEntity<?> reporteUsuarios() {
        try {
            return descargarExcel(reporteService.generarReporteUsuarios(), "reporte-usuarios");
        } catch (Exception e) {
            log.error("Error al generar el reporte de usuarios", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error al generar el reporte de usuarios");
        }
    }

    @GetMapping("/pedidos/pdf")
    public ResponseEntity<?> reportePedidosPdf() {
        try {
            return descargarPdf(reporteService.generarPdfPedidos(), "reporte-pedidos");
        } catch (Exception e) {
            log.error("Error al generar el PDF de pedidos", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error al generar el PDF de pedidos");
        }
    }

    @GetMapping("/entregas/pdf")
    public ResponseEntity<?> reporteEntregasPdf() {
        try {
            return descargarPdf(reporteService.generarPdfEntregas(), "reporte-entregas");
        } catch (Exception e) {
            log.error("Error al generar el PDF de entregas", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error al generar el PDF de entregas");
        }
    }

    @GetMapping("/productos/pdf")
    public ResponseEntity<?> reporteProductosPdf() {
        try {
            return descargarPdf(reporteService.generarPdfProductos(), "reporte-productos");
        } catch (Exception e) {
            log.error("Error al generar el PDF de productos", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error al generar el PDF de productos");
        }
    }

    @GetMapping("/categorias/pdf")
    public ResponseEntity<?> reporteCategoriasPdf() {
        try {
            return descargarPdf(reporteService.generarPdfCategorias(), "reporte-categorias");
        } catch (Exception e) {
            log.error("Error al generar el PDF de categorías", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error al generar el PDF de categorías");
        }
    }

    @GetMapping("/usuarios/pdf")
    public ResponseEntity<?> reporteUsuariosPdf() {
        try {
            return descargarPdf(reporteService.generarPdfUsuarios(), "reporte-usuarios");
        } catch (Exception e) {
            log.error("Error al generar el PDF de usuarios", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error al generar el PDF de usuarios");
        }
    }

    private ResponseEntity<byte[]> descargarExcel(byte[] contenido, String nombreBase) {
        String nombreArchivo = nombreBase + "-" + LocalDate.now() + ".xlsx";
        log.info("Reporte generado: {} ({} KB)", nombreArchivo, contenido.length / 1024);
        return ResponseEntity.ok()
                .contentType(EXCEL)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + nombreArchivo + "\"")
                .body(contenido);
    }

    private ResponseEntity<byte[]> descargarPdf(byte[] contenido, String nombreBase) {
        String nombreArchivo = nombreBase + "-" + LocalDate.now() + ".pdf";
        log.info("Reporte generado: {} ({} KB)", nombreArchivo, contenido.length / 1024);
        return ResponseEntity.ok()
                .contentType(PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + nombreArchivo + "\"")
                .body(contenido);
    }
}
