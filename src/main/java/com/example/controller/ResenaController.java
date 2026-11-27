package com.example.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.service.ResenaService;

@RestController
@RequestMapping("/resena")
public class ResenaController {

    @Autowired
    private ResenaService resenaService;

    @GetMapping("/producto/{idProducto}")
    public ResponseEntity<?> listarPorProducto(@PathVariable Long idProducto) {
        try {
            return ResponseEntity.ok(resenaService.listarPorProducto(idProducto));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    @GetMapping("/elegibilidad/{idProducto}")
    public ResponseEntity<?> verificarElegibilidad(@PathVariable Long idProducto) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            String correo = auth != null ? auth.getName() : null;
            return ResponseEntity.ok(resenaService.verificarElegibilidad(idProducto, correo));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    @PostMapping("/guardar")
    public ResponseEntity<?> guardar(@RequestBody Map<String, Object> body) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            String correo = auth != null ? auth.getName() : null;
            Long idProducto = Long.valueOf(String.valueOf(body.get("idProducto")));
            int calificacion = Integer.parseInt(String.valueOf(body.get("calificacion")));
            String comentario = body.get("comentario") == null ? "" : String.valueOf(body.get("comentario"));
            resenaService.guardarResena(idProducto, calificacion, comentario, correo);
            return ResponseEntity.status(HttpStatus.CREATED).body("Reseña guardada correctamente.");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }
}