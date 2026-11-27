package com.example.seguridad;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class SeguridadTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void sinSesion_noPuedeConsultarPedidos() throws Exception {
        mvc.perform(get("/pedido/listarPedidos")).andExpect(status().isUnauthorized());
    }

    @Test
    void sinSesion_noPuedeVerMetricas() throws Exception {
        mvc.perform(get("/actuator/metrics")).andExpect(status().isUnauthorized());
    }

    @Test
    void sinSesion_noPuedeEntrarAMantenimiento() throws Exception {
        mvc.perform(get("/mantenimiento/estado")).andExpect(status().isUnauthorized());
    }

    @Test
    void sinSesion_puedeConsultarLaSaludDelSistema() throws Exception {
        int codigo = mvc.perform(get("/actuator/health")).andReturn().getResponse().getStatus();
        assertThat(codigo).isNotIn(401, 403);
    }

    @Test
    @WithMockUser(username = "cliente@prueba.com", roles = "CLIENTE")
    void cliente_noPuedeListarUsuarios() throws Exception {
        mvc.perform(get("/usuario/listarUsuarios")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "cliente@prueba.com", roles = "CLIENTE")
    void cliente_noPuedeVerMetricas() throws Exception {
        mvc.perform(get("/actuator/metrics")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "cliente@prueba.com", roles = "CLIENTE")
    void cliente_noPuedeHacerBackups() throws Exception {
        mvc.perform(post("/mantenimiento/backup")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "cliente@prueba.com", roles = "CLIENTE")
    void cliente_noPuedeCambiarElEstadoDeUnaEntrega() throws Exception {
        mvc.perform(put("/entrega/cambiarEstado/1").contentType(MediaType.APPLICATION_JSON).content("{\"estado\":1}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "motorizado@prueba.com", roles = "MOTORIZADO")
    void motorizado_noPuedeCrearProductos() throws Exception {
        mvc.perform(post("/producto/crear")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "motorizado@prueba.com", roles = "MOTORIZADO")
    void motorizado_noPuedeRestaurarBackups() throws Exception {
        mvc.perform(post("/mantenimiento/restaurar").param("archivo", "x.sql")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "admin@prueba.com", roles = "ADMINISTRADOR")
    void administrador_puedeVerMetricas() throws Exception {
        mvc.perform(get("/actuator/metrics")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "admin@prueba.com", roles = "ADMINISTRADOR")
    void administrador_puedeVerMantenimiento() throws Exception {
        mvc.perform(get("/mantenimiento/estado")).andExpect(status().isOk());
    }

    @Test
    void login_conContrasenaIncorrectaEsRechazado() throws Exception {
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"admin@dolcevita.com\",\"contrasena\":\"ClaveIncorrecta999\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void contrasenas_seGuardanCifradasConBCrypt() {
        String cifrada = passwordEncoder.encode("Admin123");
        assertThat(cifrada).isNotEqualTo("Admin123").startsWith("$2");
        assertThat(passwordEncoder.matches("Admin123", cifrada)).isTrue();
        assertThat(passwordEncoder.matches("otraClave", cifrada)).isFalse();
    }
}
