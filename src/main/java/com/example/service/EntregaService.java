package com.example.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import javax.transaction.Transactional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.example.model.Entrega;
import com.example.model.Pedido;
import com.example.repository.EntregaRepository;
import com.example.repository.PedidoRepository;

@Service
public class EntregaService {

    @Autowired
    private EntregaRepository entregaRepository;

    @Autowired
    private PedidoRepository pedidoRepository;

    @Autowired
    private PedidoService pedidoService;

    public static final int ASIGNADA = 0;
    public static final int EN_CAMINO = 1;
    public static final int ENTREGADA = 2;
    public static final int INCIDENCIA = 3;

    public List<Entrega> listarAll() {
        return entregaRepository.findAll();
    }

    public List<Entrega> listarporNombre(String nombreMotorizado) {
        return entregaRepository.buscarPorNombreMotorizado(nombreMotorizado);
    }

    public List<Entrega> listarPorMotorizado(Long idMotorizado) {
        return entregaRepository.listarPorMotorizado(idMotorizado);
    }

    public Entrega listarID(Long id) {
        return entregaRepository.findById(id).orElse(null);
    }

    public Entrega guardar(Entrega entrega) {
        if (entrega.getFecha_asignacion() == null) {
            entrega.setFecha_asignacion(LocalDateTime.now());
        }
        if (entrega.getPedido() != null && entrega.getPedido().getId_pedido() != null) {
            pedidoRepository.findById(entrega.getPedido().getId_pedido())
                    .ifPresent(p -> entrega.setCosto_delivery(p.getCosto_delivery()));
        }
        if (entrega.getCosto_delivery() == null) {
            entrega.setCosto_delivery(BigDecimal.ZERO);
        }
        return entregaRepository.save(entrega);
    }

    public Entrega actualizar(Long id, Entrega detalles) {
        Optional<Entrega> optional = entregaRepository.findById(id);
        if (optional.isPresent()) {
            Entrega existente = optional.get();
            existente.setPedido(detalles.getPedido());
            existente.setMotorizado(detalles.getMotorizado());
            existente.setFecha_entrega(detalles.getFecha_entrega());
            existente.setEstado(detalles.getEstado());
            existente.setCosto_delivery(detalles.getCosto_delivery());
            existente.setObservacion(detalles.getObservacion());
            return entregaRepository.save(existente);
        }
        return null;
    }

    @Transactional
    public Entrega cambiarEstadoPorMotorizado(Long id, int nuevoEstado, String observacion, String correoMotorizado) throws Exception {
        Entrega entrega = entregaRepository.findById(id)
                .orElseThrow(() -> new Exception("Entrega no encontrada con ID: " + id));
        if (entrega.getMotorizado() == null || correoMotorizado == null
                || !correoMotorizado.equalsIgnoreCase(entrega.getMotorizado().getCorreo())) {
            throw new Exception("Esta entrega no está asignada a tu cuenta.");
        }
        int actual = entrega.getEstado();
        Pedido pedido = entrega.getPedido();
        String texto = observacion == null ? "" : observacion.trim();
        if (nuevoEstado == EN_CAMINO) {
            if (actual != ASIGNADA) {
                throw new Exception("Solo se puede iniciar una entrega que está asignada.");
            }
            if (pedido == null || !"LISTO".equalsIgnoreCase(pedido.getEstado())) {
                throw new Exception("El pedido todavía no está listo para salir.");
            }
            pedidoService.actualizarEstadoSegunRol(pedido.getId_pedido(), "EN_CAMINO", true);
        } else if (nuevoEstado == ENTREGADA) {
            if (actual != EN_CAMINO) {
                throw new Exception("Primero debes marcar la entrega como en camino.");
            }
            pedidoService.actualizarEstadoSegunRol(pedido.getId_pedido(), "ENTREGADO", true);
            entrega.setFecha_entrega(LocalDateTime.now());
        } else if (nuevoEstado == INCIDENCIA) {
            if (actual != ASIGNADA && actual != EN_CAMINO) {
                throw new Exception("No se puede registrar una incidencia en una entrega finalizada.");
            }
            if (texto.isEmpty()) {
                throw new Exception("Describe la incidencia.");
            }
        } else {
            throw new Exception("Estado de entrega no válido.");
        }
        if (!texto.isEmpty()) {
            entrega.setObservacion(texto);
        }
        entrega.setEstado(nuevoEstado);
        return entregaRepository.save(entrega);
    }

    public boolean eliminar(Long id) {
        if (entregaRepository.existsById(id)) {
            entregaRepository.deleteById(id);
            return true;
        }
        return false;
    }
}
