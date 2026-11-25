package com.example.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.model.Pedido;
import com.example.service.PedidoService;

/**
 * Controlador REST de los pedidos. Expone las rutas /pedido para listar, registrar, actualizar y eliminar pedidos.
 */
@RestController
@RequestMapping("/pedido")
public class PedidoController {

    @Autowired
    private PedidoService pedidoService;

    
    /**
     * Lista todos los pedidos.
     * @return lista de pedidos
     */
    @GetMapping("/listarPedidos")
    public ResponseEntity<?> listarPedidos() {
        try {
            List<Pedido> pedidos = pedidoService.listarAll();
            return ResponseEntity.ok(pedidos);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error al listar pedidos");
        }
    }

    /**
     * Lista los pedidos de un cliente.
     * @param idUsuario identificador del cliente
     * @return pedidos del cliente
     */
    @GetMapping("/listarPorUsuario/{idUsuario}")
    public ResponseEntity<?> listarPorUsuario(@PathVariable("idUsuario") Long idUsuario) {
        try {
            List<Pedido> pedidos = pedidoService.listarPorUsuario(idUsuario);
            return ResponseEntity.ok(pedidos);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error al listar pedidos del usuario");
        }
    } 
    
    /**
     * Lista los pedidos en un estado.
     * @param estado estado buscado
     * @return pedidos en ese estado
     */
    @GetMapping("/listarEstado/{estado}")
    public ResponseEntity<?> listarPedidoPorEstado(@PathVariable("estado") String estado) {
        try {
            List<Pedido> pedidos = pedidoService.listarPorEstado(estado);
            return ResponseEntity.ok(pedidos);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error al buscar pedidos por estado");
        }
    }

    
    /**
     * Obtiene un pedido por su identificador.
     * @param id identificador del pedido
     * @return el pedido o 404 si no existe
     */
    @GetMapping("/listarId/{id}")
    public ResponseEntity<?> listarPedId(@PathVariable("id") Long id) {
        try {
            Pedido pedido = pedidoService.listarID(id);
            if (pedido != null) {
                return ResponseEntity.ok(pedido);
            }
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Pedido no encontrado con el ID: " + id);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error al buscar pedido por ID");
        }
    }

    
    /**
     * Registra un nuevo pedido.
     * @param pedido pedido con sus detalles
     * @return el pedido creado o 400 si los datos no son válidos
     */
    @PostMapping("/crear")
    public ResponseEntity<?> guardar(@RequestBody Pedido pedido) {
        try {
            Pedido nuevoPedido = pedidoService.guardar(pedido);
            return ResponseEntity.status(HttpStatus.CREATED).body(nuevoPedido);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Error al registrar el pedido: " + e.getMessage());
        }
    }

    
    /**
     * Cambia el estado de un pedido validando el rol del usuario autenticado.
     * @param id identificador del pedido
     * @param estado nuevo estado
     * @return el pedido actualizado o 400 si el cambio no está permitido
     */
    @PutMapping("/actualizarEstado/{id}")
    public ResponseEntity<?> actualizarEstado(@PathVariable Long id, @RequestParam String estado) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            boolean esMotorizado = auth != null && auth.getAuthorities().stream()
                    .anyMatch(a -> "ROLE_MOTORIZADO".equals(a.getAuthority()));
            Pedido pedidoActualizado = pedidoService.actualizarEstadoSegunRol(id, estado, esMotorizado);
            return ResponseEntity.ok(pedidoActualizado);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Error al actualizar estado: " + e.getMessage());
        }
    }

    
    /**
     * Actualiza los productos y la fecha de entrega de un pedido.
     * @param id identificador del pedido
     * @param pedido nuevos detalles
     * @return el pedido actualizado
     */
    @PutMapping("/actualizarDetalles/{id}")
    public ResponseEntity<?> actualizarDetallesYFecha(@PathVariable Long id, @RequestBody Pedido pedido) {
        try {
            Pedido pedidoActualizado = pedidoService.actualizarDetallesYFecha(id, pedido);
            return ResponseEntity.ok(pedidoActualizado);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Error al actualizar el pedido: " + e.getMessage());
        }
    }

   
    /**
     * Elimina un pedido.
     * @param id identificador del pedido
     * @return confirmación o 404 si no existe
     */
    @DeleteMapping("/eliminar/{id}")
    public ResponseEntity<?> eliminar(@PathVariable Long id) {
        try {
            boolean eliminado = pedidoService.eliminar(id);
            if (eliminado) {
                return ResponseEntity.ok("Pedido eliminado con éxito");
            }
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Pedido no encontrado con el ID: " + id);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error al eliminar el pedido: " + e.getMessage());
        }
    }
}
