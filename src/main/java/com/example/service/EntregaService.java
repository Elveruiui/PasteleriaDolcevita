package com.example.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.example.model.Entrega;
import com.example.model.Pedido;
import com.example.repository.EntregaRepository;
import com.example.repository.PedidoRepository;

import io.micrometer.core.instrument.Metrics;

/**
 * Servicio que gestiona las entregas de los pedidos delivery y el flujo de trabajo del Motorizado: asignada, en camino, entregada o con incidencia.
 */
@Service
public class EntregaService {

    private static final Logger log = LoggerFactory.getLogger(EntregaService.class);

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

    /**
     * Lista todas las entregas registradas.
     * @return lista de entregas
     */
    public List<Entrega> listarAll() {
        return entregaRepository.findAll();
    }

    /**
     * Lista las entregas asignadas a un motorizado según su nombre.
     * @param nombreMotorizado nombre del motorizado
     * @return entregas encontradas
     */
    public List<Entrega> listarporNombre(String nombreMotorizado) {
        return entregaRepository.buscarPorNombreMotorizado(nombreMotorizado);
    }

    /**
     * Lista las entregas asignadas a un motorizado.
     * @param idMotorizado identificador del motorizado
     * @return entregas del motorizado
     */
    public List<Entrega> listarPorMotorizado(Long idMotorizado) {
        return entregaRepository.listarPorMotorizado(idMotorizado);
    }

    /**
     * Busca una entrega por su identificador.
     * @param id identificador de la entrega
     * @return la entrega encontrada
     */
    public Entrega listarID(Long id) {
        return entregaRepository.findById(id).orElse(null);
    }

    /**
     * Registra una entrega asignando un motorizado a un pedido delivery. El costo de la entrega se copia del costo de delivery del pedido.
     * @param entrega entrega a registrar
     * @return la entrega guardada
     */
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
        Entrega asignada = entregaRepository.save(entrega);
        Metrics.counter("dolcevita.entregas.asignadas").increment();
        log.info("Entrega asignada: pedido={}, motorizado={}, costo delivery=S/ {}",
                entrega.getPedido() != null ? entrega.getPedido().getId_pedido() : null,
                entrega.getMotorizado() != null ? entrega.getMotorizado().getId_usuario() : null,
                entrega.getCosto_delivery());
        return asignada;
    }

    /**
     * Actualiza los datos de una entrega.
     * @param id identificador de la entrega
     * @param detalles nuevos datos de la entrega
     * @return la entrega actualizada
     */
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

    /**
     * Cambia el estado de una entrega desde la interfaz del Motorizado. Solo el motorizado asignado puede hacerlo; para iniciar la entrega el pedido debe estar LISTO, para entregarla debe estar EN_CAMINO y una incidencia requiere una descripción. También actualiza el estado del pedido.
     * @param id identificador de la entrega
     * @param nuevoEstado 1 en camino, 2 entregada o 3 incidencia
     * @param observacion descripción de la incidencia o comentario
     * @param correoMotorizado correo del motorizado que realiza el cambio
     * @return la entrega actualizada
     * @throws Exception si el motorizado no es el asignado o el cambio no está permitido
     */
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
        Long idPedido = pedido != null ? pedido.getId_pedido() : null;
        if (nuevoEstado == EN_CAMINO) {
            Metrics.counter("dolcevita.entregas.iniciadas").increment();
            log.info("Entrega {} en camino: pedido={}, motorizado={}", id, idPedido, correoMotorizado);
        } else if (nuevoEstado == ENTREGADA) {
            Metrics.counter("dolcevita.entregas.completadas").increment();
            log.info("Entrega {} completada: pedido={}, motorizado={}", id, idPedido, correoMotorizado);
        } else {
            Metrics.counter("dolcevita.entregas.incidencias").increment();
            log.warn("Incidencia en la entrega {}: pedido={}, motorizado={}, detalle={}", id, idPedido, correoMotorizado, texto);
        }
        return entregaRepository.save(entrega);
    }

    /**
     * Elimina una entrega.
     * @param id identificador de la entrega
     * @return true si se eliminó, false si no existía
     */
    public boolean eliminar(Long id) {
        if (entregaRepository.existsById(id)) {
            log.warn("Entrega {} eliminada por el administrador", id);
            entregaRepository.deleteById(id);
            return true;
        }
        return false;
    }
    
    public Entrega buscarPorPedido(Long idPedido) {
        return entregaRepository.buscarPorPedido(idPedido).orElse(null);
    }
}
