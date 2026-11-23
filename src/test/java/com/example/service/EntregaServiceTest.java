package com.example.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.example.model.Entrega;
import com.example.model.Pedido;
import com.example.model.Usuario;
import com.example.repository.EntregaRepository;
import com.example.repository.PedidoRepository;

@ExtendWith(MockitoExtension.class)
class EntregaServiceTest {

    private static final String CORREO = "marco.huaman@dolcevita.com";

    @Mock
    private EntregaRepository entregaRepository;

    @Mock
    private PedidoRepository pedidoRepository;

    @Mock
    private PedidoService pedidoService;

    @InjectMocks
    private EntregaService entregaService;

    private Entrega crearEntrega(int estado, String estadoPedido) {
        Usuario motorizado = new Usuario();
        motorizado.setCorreo(CORREO);
        Pedido pedido = new Pedido();
        pedido.setId_pedido(7L);
        pedido.setEstado(estadoPedido);
        pedido.setModalidad_entrega("Delivery");
        Entrega entrega = new Entrega();
        entrega.setMotorizado(motorizado);
        entrega.setPedido(pedido);
        entrega.setEstado(estado);
        return entrega;
    }

    @Test
    void iniciarEntrega_conPedidoListoPasaAEnCamino() throws Exception {
        Entrega entrega = crearEntrega(EntregaService.ASIGNADA, "LISTO");
        when(entregaRepository.findById(1L)).thenReturn(Optional.of(entrega));
        when(entregaRepository.save(any(Entrega.class))).thenAnswer(i -> i.getArgument(0));

        Entrega resultado = entregaService.cambiarEstadoPorMotorizado(1L, EntregaService.EN_CAMINO, null, CORREO);

        assertEquals(EntregaService.EN_CAMINO, resultado.getEstado());
        verify(pedidoService).actualizarEstadoSegunRol(7L, "EN_CAMINO", true);
    }

    @Test
    void iniciarEntrega_rechazaPedidoQueNoEstaListo() throws Exception {
        Entrega entrega = crearEntrega(EntregaService.ASIGNADA, "CONFIRMADO");
        when(entregaRepository.findById(1L)).thenReturn(Optional.of(entrega));

        Exception error = assertThrows(Exception.class,
                () -> entregaService.cambiarEstadoPorMotorizado(1L, EntregaService.EN_CAMINO, null, CORREO));

        assertTrue(error.getMessage().contains("listo"));
        verify(entregaRepository, never()).save(any(Entrega.class));
        verify(pedidoService, never()).actualizarEstadoSegunRol(anyLong(), anyString(), anyBoolean());
    }

    @Test
    void entregar_sinPasarPorEnCaminoEsRechazado() {
        Entrega entrega = crearEntrega(EntregaService.ASIGNADA, "LISTO");
        when(entregaRepository.findById(1L)).thenReturn(Optional.of(entrega));

        assertThrows(Exception.class,
                () -> entregaService.cambiarEstadoPorMotorizado(1L, EntregaService.ENTREGADA, null, CORREO));
        verify(entregaRepository, never()).save(any(Entrega.class));
    }

    @Test
    void entregar_desdeEnCaminoRegistraLaFechaYActualizaElPedido() throws Exception {
        Entrega entrega = crearEntrega(EntregaService.EN_CAMINO, "EN_CAMINO");
        when(entregaRepository.findById(1L)).thenReturn(Optional.of(entrega));
        when(entregaRepository.save(any(Entrega.class))).thenAnswer(i -> i.getArgument(0));

        Entrega resultado = entregaService.cambiarEstadoPorMotorizado(1L, EntregaService.ENTREGADA, "Recibido por el cliente", CORREO);

        assertEquals(EntregaService.ENTREGADA, resultado.getEstado());
        assertNotNull(resultado.getFecha_entrega());
        assertEquals("Recibido por el cliente", resultado.getObservacion());
        verify(pedidoService).actualizarEstadoSegunRol(7L, "ENTREGADO", true);
    }

    @Test
    void incidencia_sinDescripcionEsRechazada() {
        Entrega entrega = crearEntrega(EntregaService.EN_CAMINO, "EN_CAMINO");
        when(entregaRepository.findById(1L)).thenReturn(Optional.of(entrega));

        assertThrows(Exception.class,
                () -> entregaService.cambiarEstadoPorMotorizado(1L, EntregaService.INCIDENCIA, "  ", CORREO));
        verify(entregaRepository, never()).save(any(Entrega.class));
    }

    @Test
    void incidencia_conDescripcionNoCambiaElPedido() throws Exception {
        Entrega entrega = crearEntrega(EntregaService.EN_CAMINO, "EN_CAMINO");
        when(entregaRepository.findById(1L)).thenReturn(Optional.of(entrega));
        when(entregaRepository.save(any(Entrega.class))).thenAnswer(i -> i.getArgument(0));

        Entrega resultado = entregaService.cambiarEstadoPorMotorizado(1L, EntregaService.INCIDENCIA, "Dirección incorrecta: no existe el número", CORREO);

        assertEquals(EntregaService.INCIDENCIA, resultado.getEstado());
        verify(pedidoService, never()).actualizarEstadoSegunRol(anyLong(), anyString(), anyBoolean());
    }

    @Test
    void otroMotorizadoNoPuedeCambiarLaEntrega() {
        Entrega entrega = crearEntrega(EntregaService.ASIGNADA, "LISTO");
        when(entregaRepository.findById(1L)).thenReturn(Optional.of(entrega));

        Exception error = assertThrows(Exception.class,
                () -> entregaService.cambiarEstadoPorMotorizado(1L, EntregaService.EN_CAMINO, null, "otro@dolcevita.com"));

        assertTrue(error.getMessage().contains("asignada"));
        verify(entregaRepository, never()).save(any(Entrega.class));
    }
}
