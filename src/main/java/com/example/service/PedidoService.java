package com.example.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.example.model.DetallePedido;
import com.example.model.Pedido;
import com.example.model.Producto;
import com.example.repository.DetallePedidoRepository;
import com.example.repository.PedidoRepository;
import com.example.repository.ProductoRepository;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;

@Service
public class PedidoService {

    private static final Logger log = LoggerFactory.getLogger(PedidoService.class);
	

	@Autowired
    private PedidoRepository pedidoRepository;

    @Autowired
    private ProductoRepository productoRepository;

    @Autowired
    private DetallePedidoRepository detallePedidoRepository;

    private static final List<String> ESTADOS_DELIVERY = Arrays.asList("PENDIENTE", "CONFIRMADO", "LISTO", "EN_CAMINO", "ENTREGADO", "CANCELADO");

    private static final BigDecimal PORCENTAJE_DELIVERY = new BigDecimal("0.05");

    private static final BigDecimal DELIVERY_MINIMO = new BigDecimal("5.00");

    private static final BigDecimal DELIVERY_MAXIMO = new BigDecimal("15.00");

    private static final List<String> ESTADOS_RECOJO = Arrays.asList("PENDIENTE", "CONFIRMADO", "LISTO", "ENTREGADO", "CANCELADO");

	    public List<Pedido> listarAll() {
	        return pedidoRepository.findAll();
	    }

	    public List<Pedido> listarPorEstado(String estado) {
	        return pedidoRepository.findByEstadoIgnoreCase(estado);
	    }

	    public List<Pedido> listarPorUsuario(Long idUsuario) {
	        return pedidoRepository.listarPorUsuario(idUsuario);
	    }

	    public Pedido listarID(Long id) {
	        return pedidoRepository.findById(id).orElse(null);
	    }


	    @Transactional
	    public Pedido guardar(Pedido pedido) throws Exception {
	        if (pedido.getDetalles() == null || pedido.getDetalles().isEmpty()) {
	            throw new Exception("El pedido debe incluir al menos un producto en el detalle.");
	        }

	        Timer.Sample muestra = Timer.start(Metrics.globalRegistry);
	        pedido.setFecha_pedido(LocalDateTime.now());
	        pedido.setEstado("PENDIENTE");

	        BigDecimal totalCalculado = BigDecimal.ZERO;

	        for (DetallePedido detalle : pedido.getDetalles()) {
	            Long idProd = detalle.getProducto().getId_producto();
	            Producto productoBD = productoRepository.findById(idProd)
	                    .orElseThrow(() -> new Exception("Producto no encontrado con ID: " + idProd));

	            if (detalle.getCantidad() <= 0) {
	                throw new Exception("La cantidad para " + productoBD.getNombre() + " debe ser mayor a 0.");
	            }

	            
	            if (productoBD.getStock() < detalle.getCantidad()) {
	                log.warn("Pedido rechazado por stock insuficiente: producto={}, solicitado={}, disponible={}",
	                        productoBD.getNombre(), detalle.getCantidad(), productoBD.getStock());
	                Metrics.counter("dolcevita.pedidos.rechazados").increment();
	                throw new Exception("Stock insuficiente para el producto: " + productoBD.getNombre()
	                        + " (Stock disponible: " + productoBD.getStock() + ")");
	            }

	          
	            productoBD.setStock(productoBD.getStock() - detalle.getCantidad());
	            productoRepository.save(productoBD);

	            detalle.setProducto(productoBD);
	            
	       
	            BigDecimal precioUnitario = new BigDecimal(productoBD.getPrecio());
	            detalle.setPrecio_unitario(precioUnitario);

	            BigDecimal subtotal = precioUnitario.multiply(new BigDecimal(detalle.getCantidad()));
	            detalle.setSubtotal(subtotal);
	            detalle.setPedido(pedido);

	            totalCalculado = totalCalculado.add(subtotal);
	        }

	        BigDecimal costoDelivery = calcularCostoDelivery(pedido.getModalidad_entrega(), totalCalculado);
	        pedido.setCosto_delivery(costoDelivery);
	        pedido.setTotal(totalCalculado.add(costoDelivery));
	        Pedido registrado = pedidoRepository.save(pedido);
	        muestra.stop(Metrics.timer("dolcevita.pedidos.tiempo_registro"));
	        Metrics.counter("dolcevita.pedidos.creados", "modalidad", String.valueOf(pedido.getModalidad_entrega())).increment();
	        log.info("Pedido {} registrado: usuario={}, modalidad={}, productos={}, total=S/ {}",
	                registrado != null ? registrado.getId_pedido() : null,
	                pedido.getUsuario() != null ? pedido.getUsuario().getId_usuario() : null,
	                pedido.getModalidad_entrega(), pedido.getDetalles().size(), pedido.getTotal());
	        return registrado;
	    }

	   
	    @Transactional
	    public Pedido actualizarEstado(Long id, String nuevoEstado) throws Exception {
	        Pedido pedido = pedidoRepository.findById(id)
	                .orElseThrow(() -> new Exception("Pedido no encontrado con ID: " + id));

	        String estadoActual = pedido.getEstado();
	        String nuevoEstadoUpper = nuevoEstado.toUpperCase();

	        List<String> permitidos = estadosPermitidos(pedido.getModalidad_entrega());
	        if (!permitidos.contains(nuevoEstadoUpper)) {
	            throw new Exception("El estado " + nuevoEstadoUpper + " no es válido para pedidos con modalidad " + pedido.getModalidad_entrega() + ".");
	        }

	        String actualUpper = estadoActual == null ? "" : estadoActual.toUpperCase();
	        if (!actualUpper.equals(nuevoEstadoUpper)) {
	            if ("CANCELADO".equals(actualUpper)) {
	                throw new Exception("Un pedido cancelado ya no se puede reactivar.");
	            }
	            if ("ENTREGADO".equals(actualUpper)) {
	                throw new Exception("Un pedido entregado ya no se puede modificar.");
	            }
	            int posicionActual = permitidos.indexOf(actualUpper);
	            if (!"CANCELADO".equals(nuevoEstadoUpper) && posicionActual >= 0 && permitidos.indexOf(nuevoEstadoUpper) < posicionActual) {
	                throw new Exception("No se puede regresar el pedido de " + actualUpper + " a " + nuevoEstadoUpper + ".");
	            }
	        }

	     
	        if ("CANCELADO".equals(nuevoEstadoUpper) && !"CANCELADO".equalsIgnoreCase(estadoActual)) {
	            devolverStockProductos(pedido);
	        }

	        pedido.setEstado(nuevoEstadoUpper);
	        if (!nuevoEstadoUpper.equalsIgnoreCase(estadoActual)) {
	            log.info("Pedido {} cambio de estado: {} -> {}", id, estadoActual, nuevoEstadoUpper);
	            if ("CANCELADO".equals(nuevoEstadoUpper)) {
	                Metrics.counter("dolcevita.pedidos.cancelados").increment();
	            } else if ("ENTREGADO".equals(nuevoEstadoUpper)) {
	                Metrics.counter("dolcevita.pedidos.entregados").increment();
	            }
	        }
	        return pedidoRepository.save(pedido);
	    }

	    
	    @Transactional
	    public Pedido actualizarDetallesYFecha(Long id, Pedido detallesNuevos) throws Exception {
	        Pedido pedidoExistente = pedidoRepository.findById(id)
	                .orElseThrow(() -> new Exception("Pedido no encontrado con ID: " + id));

	        if (!"PENDIENTE".equalsIgnoreCase(pedidoExistente.getEstado())) {
	            throw new Exception("No se pueden modificar los productos porque el pedido ya está en estado: " + pedidoExistente.getEstado());
	        }

	        if (detallesNuevos.getFecha_entrega() != null) {
	            pedidoExistente.setFecha_entrega(detallesNuevos.getFecha_entrega());
	        }
	        if (detallesNuevos.getObservacion() != null) {
	            pedidoExistente.setObservacion(detallesNuevos.getObservacion());
	        }

	        if (detallesNuevos.getDetalles() != null && !detallesNuevos.getDetalles().isEmpty()) {
	            
	            
	            devolverStockProductos(pedidoExistente);
	            detallePedidoRepository.deleteAll(pedidoExistente.getDetalles());
	            pedidoExistente.getDetalles().clear();

	            BigDecimal totalCalculado = BigDecimal.ZERO;

	            for (DetallePedido nuevoDetalle : detallesNuevos.getDetalles()) {
	                Long idProd = nuevoDetalle.getProducto().getId_producto();
	                Producto productoBD = productoRepository.findById(idProd)
	                        .orElseThrow(() -> new Exception("Producto no encontrado con ID: " + idProd));

	                if (nuevoDetalle.getCantidad() <= 0) {
	                    throw new Exception("La cantidad debe ser mayor a 0.");
	                }

	                if (productoBD.getStock() < nuevoDetalle.getCantidad()) {
	                    throw new Exception("Stock insuficiente para: " + productoBD.getNombre()
	                            + " (Disponible: " + productoBD.getStock() + ")");
	                }

	                
	                productoBD.setStock(productoBD.getStock() - nuevoDetalle.getCantidad());
	                productoRepository.save(productoBD);

	                nuevoDetalle.setProducto(productoBD);
	                
	                BigDecimal precioUnitario = new BigDecimal(productoBD.getPrecio());
	                nuevoDetalle.setPrecio_unitario(precioUnitario);
	                
	                BigDecimal subtotal = precioUnitario.multiply(new BigDecimal(nuevoDetalle.getCantidad()));
	                nuevoDetalle.setSubtotal(subtotal);
	                nuevoDetalle.setPedido(pedidoExistente);

	                pedidoExistente.getDetalles().add(nuevoDetalle);
	                totalCalculado = totalCalculado.add(subtotal);
	            }

	            BigDecimal costoDelivery = calcularCostoDelivery(pedidoExistente.getModalidad_entrega(), totalCalculado);
	            pedidoExistente.setCosto_delivery(costoDelivery);
	            pedidoExistente.setTotal(totalCalculado.add(costoDelivery));
	        }

	        return pedidoRepository.save(pedidoExistente);
	    }

	    
	    @Transactional
	    public boolean eliminar(Long id) {
	        Optional<Pedido> optional = pedidoRepository.findById(id);
	        if (optional.isPresent()) {
	            Pedido pedido = optional.get();
	            
	            if (!"CANCELADO".equalsIgnoreCase(pedido.getEstado())) {
	                devolverStockProductos(pedido);
	            }
	            log.warn("Pedido {} eliminado (estado: {})", id, pedido.getEstado());
	            pedidoRepository.deleteById(id);
	            return true;
	        }
	        return false;
	    }

	    
	    @Transactional
	    public Pedido actualizarEstadoSegunRol(Long id, String nuevoEstado, boolean esMotorizado) throws Exception {
	        Pedido pedido = pedidoRepository.findById(id)
	                .orElseThrow(() -> new Exception("Pedido no encontrado con ID: " + id));
	        if (!esMotorizado && soloMotorizado(pedido.getModalidad_entrega(), nuevoEstado)) {
	            log.warn("Intento rechazado de marcar el pedido {} como {} sin rol de motorizado", id, nuevoEstado.toUpperCase());
	            throw new Exception("En los pedidos delivery, solo el motorizado puede marcar el estado " + nuevoEstado.toUpperCase() + ".");
	        }
	        return actualizarEstado(id, nuevoEstado);
	    }

	    public static BigDecimal calcularCostoDelivery(String modalidad, BigDecimal subtotal) {
	        if (modalidad == null || subtotal == null || !modalidad.toLowerCase().contains("delivery")) {
	            return BigDecimal.ZERO.setScale(2);
	        }
	        BigDecimal costo = subtotal.multiply(PORCENTAJE_DELIVERY).setScale(2, RoundingMode.HALF_UP);
	        if (costo.compareTo(DELIVERY_MINIMO) < 0) {
	            return DELIVERY_MINIMO;
	        }
	        if (costo.compareTo(DELIVERY_MAXIMO) > 0) {
	            return DELIVERY_MAXIMO;
	        }
	        return costo;
	    }

	    public static boolean soloMotorizado(String modalidad, String estado) {
	        boolean recojo = modalidad != null && modalidad.toLowerCase().contains("recojo");
	        String valor = estado == null ? "" : estado.toUpperCase();
	        return !recojo && ("EN_CAMINO".equals(valor) || "ENTREGADO".equals(valor));
	    }

	    public static List<String> estadosPermitidos(String modalidad) {
	        boolean recojo = modalidad != null && modalidad.toLowerCase().contains("recojo");
	        return recojo ? ESTADOS_RECOJO : ESTADOS_DELIVERY;
	    }

	    private void devolverStockProductos(Pedido pedido) {
	        if (pedido.getDetalles() != null) {
	            for (DetallePedido detalle : pedido.getDetalles()) {
	                Producto producto = detalle.getProducto();
	                if (producto != null) {
	                    producto.setStock(producto.getStock() + detalle.getCantidad());
	                    productoRepository.save(producto);
	                }
	            }
	        }
	    }

}
