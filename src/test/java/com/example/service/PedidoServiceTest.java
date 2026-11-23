package com.example.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.example.model.DetallePedido;
import com.example.model.Pedido;
import com.example.model.Producto;
import com.example.repository.DetallePedidoRepository;
import com.example.repository.PedidoRepository;
import com.example.repository.ProductoRepository;

@ExtendWith(MockitoExtension.class)
class PedidoServiceTest {

    @Mock
    private PedidoRepository pedidoRepository;

    @Mock
    private ProductoRepository productoRepository;

    @Mock
    private DetallePedidoRepository detallePedidoRepository;

    @InjectMocks
    private PedidoService pedidoService;

    private Producto crearProducto(Long id, String nombre, double precio, int stock) {
        Producto producto = new Producto();
        producto.setId_producto(id);
        producto.setNombre(nombre);
        producto.setPrecio(precio);
        producto.setStock(stock);
        producto.setEstado(1);
        return producto;
    }

    private Producto referencia(Long id) {
        Producto producto = new Producto();
        producto.setId_producto(id);
        return producto;
    }

    private DetallePedido crearDetalle(Producto producto, int cantidad) {
        DetallePedido detalle = new DetallePedido();
        detalle.setProducto(producto);
        detalle.setCantidad(cantidad);
        return detalle;
    }

    private Pedido crearPedido(String estado, DetallePedido... detalles) {
        Pedido pedido = new Pedido();
        pedido.setEstado(estado);
        pedido.setDetalles(new ArrayList<>(Arrays.asList(detalles)));
        return pedido;
    }

    @Test
    void guardar_calculaElTotalDelPedido() throws Exception {
        Producto torta = crearProducto(1L, "Royal Blue Cake", 50.0, 10);
        Producto brownie = crearProducto(2L, "Brownie clasico", 30.0, 10);
        when(productoRepository.findById(1L)).thenReturn(Optional.of(torta));
        when(productoRepository.findById(2L)).thenReturn(Optional.of(brownie));
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));

        Pedido pedido = crearPedido(null, crearDetalle(referencia(1L), 2), crearDetalle(referencia(2L), 1));
        Pedido resultado = pedidoService.guardar(pedido);

        assertEquals(0, new BigDecimal("130").compareTo(resultado.getTotal()));
    }

    @Test
    void guardar_calculaElSubtotalDeCadaDetalle() throws Exception {
        Producto torta = crearProducto(1L, "Royal Blue Cake", 50.0, 10);
        when(productoRepository.findById(1L)).thenReturn(Optional.of(torta));
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));

        Pedido resultado = pedidoService.guardar(crearPedido(null, crearDetalle(referencia(1L), 3)));

        DetallePedido detalle = resultado.getDetalles().get(0);
        assertEquals(0, new BigDecimal("50").compareTo(detalle.getPrecio_unitario()));
        assertEquals(0, new BigDecimal("150").compareTo(detalle.getSubtotal()));
    }

    @Test
    void guardar_descuentaElStockDelProducto() throws Exception {
        Producto torta = crearProducto(1L, "Royal Blue Cake", 50.0, 10);
        when(productoRepository.findById(1L)).thenReturn(Optional.of(torta));
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));

        pedidoService.guardar(crearPedido(null, crearDetalle(referencia(1L), 2)));

        assertEquals(8, torta.getStock());
        verify(productoRepository).save(torta);
    }

    @Test
    void guardar_dejaElPedidoEnEstadoPendiente() throws Exception {
        Producto torta = crearProducto(1L, "Royal Blue Cake", 50.0, 10);
        when(productoRepository.findById(1L)).thenReturn(Optional.of(torta));
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));

        Pedido resultado = pedidoService.guardar(crearPedido("ENTREGADO", crearDetalle(referencia(1L), 1)));

        assertEquals("PENDIENTE", resultado.getEstado());
        assertNotNull(resultado.getFecha_pedido());
    }

    @Test
    void guardar_rechazaStockInsuficiente() {
        Producto torta = crearProducto(1L, "Royal Blue Cake", 50.0, 1);
        when(productoRepository.findById(1L)).thenReturn(Optional.of(torta));

        Exception error = assertThrows(Exception.class,
                () -> pedidoService.guardar(crearPedido(null, crearDetalle(referencia(1L), 3))));

        assertTrue(error.getMessage().contains("Stock insuficiente"));
        assertEquals(1, torta.getStock());
        verify(pedidoRepository, never()).save(any(Pedido.class));
    }

    @Test
    void guardar_rechazaPedidoSinProductos() {
        Exception error = assertThrows(Exception.class,
                () -> pedidoService.guardar(crearPedido(null)));

        assertTrue(error.getMessage().contains("al menos un producto"));
        verify(pedidoRepository, never()).save(any(Pedido.class));
    }

    @Test
    void guardar_rechazaCantidadCero() {
        Producto torta = crearProducto(1L, "Royal Blue Cake", 50.0, 10);
        when(productoRepository.findById(1L)).thenReturn(Optional.of(torta));

        Exception error = assertThrows(Exception.class,
                () -> pedidoService.guardar(crearPedido(null, crearDetalle(referencia(1L), 0))));

        assertTrue(error.getMessage().contains("mayor a 0"));
        assertEquals(10, torta.getStock());
    }

    @Test
    void actualizarEstado_cancelarDevuelveElStock() throws Exception {
        Producto torta = crearProducto(1L, "Royal Blue Cake", 50.0, 8);
        Pedido pedido = crearPedido("PENDIENTE", crearDetalle(torta, 2));
        when(pedidoRepository.findById(1L)).thenReturn(Optional.of(pedido));
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));

        Pedido resultado = pedidoService.actualizarEstado(1L, "cancelado");

        assertEquals("CANCELADO", resultado.getEstado());
        assertEquals(10, torta.getStock());
    }

    @Test
    void actualizarEstado_cancelarDosVecesNoDevuelveElStockOtraVez() throws Exception {
        Producto torta = crearProducto(1L, "Royal Blue Cake", 50.0, 10);
        Pedido pedido = crearPedido("CANCELADO", crearDetalle(torta, 2));
        when(pedidoRepository.findById(1L)).thenReturn(Optional.of(pedido));
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));

        pedidoService.actualizarEstado(1L, "CANCELADO");

        assertEquals(10, torta.getStock());
    }

    @Test
    void actualizarEstado_cambiarAConfirmadoNoAfectaElStock() throws Exception {
        Producto torta = crearProducto(1L, "Royal Blue Cake", 50.0, 8);
        Pedido pedido = crearPedido("PENDIENTE", crearDetalle(torta, 2));
        when(pedidoRepository.findById(1L)).thenReturn(Optional.of(pedido));
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));

        Pedido resultado = pedidoService.actualizarEstado(1L, "confirmado");

        assertEquals("CONFIRMADO", resultado.getEstado());
        assertEquals(8, torta.getStock());
    }

    @Test
    void actualizarEstado_rechazaPedidoInexistente() {
        when(pedidoRepository.findById(99L)).thenReturn(Optional.empty());

        Exception error = assertThrows(Exception.class,
                () -> pedidoService.actualizarEstado(99L, "CONFIRMADO"));

        assertTrue(error.getMessage().contains("no encontrado"));
    }

    private Pedido crearPedidoConModalidad(String estado, String modalidad) {
        Pedido pedido = crearPedido(estado);
        pedido.setModalidad_entrega(modalidad);
        return pedido;
    }

    @Test
    void actualizarEstado_deliveryAceptaListoYEnCamino() throws Exception {
        Pedido pedido = crearPedidoConModalidad("CONFIRMADO", "Delivery");
        when(pedidoRepository.findById(1L)).thenReturn(Optional.of(pedido));
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));

        assertEquals("LISTO", pedidoService.actualizarEstado(1L, "listo").getEstado());
        assertEquals("EN_CAMINO", pedidoService.actualizarEstado(1L, "en_camino").getEstado());
    }

    @Test
    void actualizarEstado_recojoAceptaListo() throws Exception {
        Pedido pedido = crearPedidoConModalidad("CONFIRMADO", "Recojo");
        when(pedidoRepository.findById(1L)).thenReturn(Optional.of(pedido));
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));

        assertEquals("LISTO", pedidoService.actualizarEstado(1L, "LISTO").getEstado());
    }

    @Test
    void actualizarEstado_recojoRechazaEnCamino() {
        Pedido pedido = crearPedidoConModalidad("LISTO", "Recojo");
        when(pedidoRepository.findById(1L)).thenReturn(Optional.of(pedido));

        Exception error = assertThrows(Exception.class,
                () -> pedidoService.actualizarEstado(1L, "EN_CAMINO"));

        assertTrue(error.getMessage().contains("EN_CAMINO"));
        verify(pedidoRepository, never()).save(any(Pedido.class));
    }

    @Test
    void actualizarEstado_recojoAceptaEntregado() throws Exception {
        Pedido pedido = crearPedidoConModalidad("LISTO", "Recojo");
        when(pedidoRepository.findById(1L)).thenReturn(Optional.of(pedido));
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));

        assertEquals("ENTREGADO", pedidoService.actualizarEstado(1L, "ENTREGADO").getEstado());
    }

    @Test
    void actualizarEstado_noPermiteRegresarAUnEstadoAnterior() {
        Pedido pedido = crearPedidoConModalidad("LISTO", "Delivery");
        when(pedidoRepository.findById(1L)).thenReturn(Optional.of(pedido));

        Exception error = assertThrows(Exception.class,
                () -> pedidoService.actualizarEstado(1L, "CONFIRMADO"));

        assertTrue(error.getMessage().contains("regresar"));
        verify(pedidoRepository, never()).save(any(Pedido.class));
    }

    @Test
    void actualizarEstado_noPermiteCancelarUnPedidoEntregado() {
        Pedido pedido = crearPedidoConModalidad("ENTREGADO", "Recojo");
        when(pedidoRepository.findById(1L)).thenReturn(Optional.of(pedido));

        assertThrows(Exception.class, () -> pedidoService.actualizarEstado(1L, "CANCELADO"));
        verify(pedidoRepository, never()).save(any(Pedido.class));
    }

    @Test
    void actualizarEstado_permiteCancelarDesdeListo() throws Exception {
        Pedido pedido = crearPedidoConModalidad("LISTO", "Delivery");
        when(pedidoRepository.findById(1L)).thenReturn(Optional.of(pedido));
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));

        assertEquals("CANCELADO", pedidoService.actualizarEstado(1L, "CANCELADO").getEstado());
    }

    @Test
    void actualizarEstadoSegunRol_adminNoPuedePonerEnCaminoUnDelivery() {
        Pedido pedido = crearPedidoConModalidad("LISTO", "Delivery");
        when(pedidoRepository.findById(1L)).thenReturn(Optional.of(pedido));

        Exception error = assertThrows(Exception.class,
                () -> pedidoService.actualizarEstadoSegunRol(1L, "EN_CAMINO", false));

        assertTrue(error.getMessage().contains("motorizado"));
        verify(pedidoRepository, never()).save(any(Pedido.class));
    }

    @Test
    void actualizarEstadoSegunRol_motorizadoPuedePonerEnCaminoUnDelivery() throws Exception {
        Pedido pedido = crearPedidoConModalidad("LISTO", "Delivery");
        when(pedidoRepository.findById(1L)).thenReturn(Optional.of(pedido));
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));

        assertEquals("EN_CAMINO", pedidoService.actualizarEstadoSegunRol(1L, "EN_CAMINO", true).getEstado());
    }

    @Test
    void actualizarEstadoSegunRol_adminPuedeEntregarUnRecojo() throws Exception {
        Pedido pedido = crearPedidoConModalidad("LISTO", "Recojo");
        when(pedidoRepository.findById(1L)).thenReturn(Optional.of(pedido));
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));

        assertEquals("ENTREGADO", pedidoService.actualizarEstadoSegunRol(1L, "ENTREGADO", false).getEstado());
    }

    @Test
    void calcularCostoDelivery_aplicaElMinimo() {
        assertEquals(0, new BigDecimal("5.00").compareTo(PedidoService.calcularCostoDelivery("Delivery", new BigDecimal("28.00"))));
    }

    @Test
    void calcularCostoDelivery_aplicaElCincoPorCiento() {
        assertEquals(0, new BigDecimal("7.50").compareTo(PedidoService.calcularCostoDelivery("Delivery", new BigDecimal("150.00"))));
    }

    @Test
    void calcularCostoDelivery_aplicaElMaximo() {
        assertEquals(0, new BigDecimal("15.00").compareTo(PedidoService.calcularCostoDelivery("Delivery", new BigDecimal("470.00"))));
    }

    @Test
    void calcularCostoDelivery_recojoNoCobra() {
        assertEquals(0, BigDecimal.ZERO.compareTo(PedidoService.calcularCostoDelivery("Recojo", new BigDecimal("150.00"))));
    }

    @Test
    void guardar_deliverySumaElCostoAlTotal() throws Exception {
        Producto torta = crearProducto(1L, "Blooming Celebration", 150.0, 5);
        when(productoRepository.findById(1L)).thenReturn(Optional.of(torta));
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));

        Pedido pedido = crearPedido(null, crearDetalle(referencia(1L), 1));
        pedido.setModalidad_entrega("Delivery");
        Pedido resultado = pedidoService.guardar(pedido);

        assertEquals(0, new BigDecimal("7.50").compareTo(resultado.getCosto_delivery()));
        assertEquals(0, new BigDecimal("157.50").compareTo(resultado.getTotal()));
    }
}
