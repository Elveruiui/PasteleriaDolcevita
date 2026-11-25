package com.example.controller;

import java.text.Normalizer;
import java.util.Collections;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.model.Usuario;
import com.example.service.UsuarioService;

import io.micrometer.core.instrument.Metrics;

/**
 * Controlador de autenticación. Gestiona el inicio y cierre de sesión, el registro de clientes y la consulta del usuario autenticado.
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private static final String ATRIBUTO_USUARIO = "USUARIO_SESION_ID";

    @Autowired
    private UsuarioService usuarioService;

    /**
     * Inicia sesión con correo y contraseña y registra la sesión en Spring Security.
     * @param credenciales correo y contraseña
     * @param request solicitud HTTP donde se guarda la sesión
     * @return el usuario autenticado o 401 si las credenciales no son correctas
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credenciales, HttpServletRequest request) {
        try {
            String correo = credenciales.get("correo");
            String contrasena = credenciales.get("contrasena");
            Usuario usuario = usuarioService.autenticar(correo, contrasena);
            iniciarSesionSpring(usuario, request);
            Metrics.counter("dolcevita.login.exitosos").increment();
            log.info("Inicio de sesion correcto: {} ({})", correo, usuario.getRol() != null ? usuario.getRol().getNombre_rol() : "sin rol");
            return ResponseEntity.ok(usuario);
        } catch (Exception e) {
            Metrics.counter("dolcevita.login.fallidos").increment();
            log.warn("Intento de inicio de sesion fallido: {}", credenciales.get("correo"));
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        }
    }

    /**
     * Registra un nuevo cliente e inicia su sesión.
     * @param datos datos del cliente
     * @param request solicitud HTTP donde se guarda la sesión
     * @return el cliente creado o 400 si los datos no son válidos
     */
    @PostMapping("/registro")
    public ResponseEntity<?> registro(@RequestBody Usuario datos, HttpServletRequest request) {
        try {
            Usuario creado = usuarioService.registrarCliente(datos);
            log.info("Nuevo cliente registrado: {}", creado.getCorreo());
            iniciarSesionSpring(creado, request);
            return ResponseEntity.status(HttpStatus.CREATED).body(creado);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    /**
     * Devuelve el usuario que tiene la sesión iniciada.
     * @param request solicitud HTTP con la sesión
     * @return el usuario o 401 si no hay sesión
     */
    @GetMapping("/me")
    public ResponseEntity<?> usuarioActual(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            return ResponseEntity.noContent().build();
        }
        Object idObj = session.getAttribute(ATRIBUTO_USUARIO);
        if (!(idObj instanceof Long)) {
            return ResponseEntity.noContent().build();
        }
        Usuario usuario = usuarioService.listarID((Long) idObj);
        if (usuario == null || usuario.getEstado() != 1) {
            session.invalidate();
            SecurityContextHolder.clearContext();
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(usuario);
    }

    /**
     * Cierra la sesión del usuario.
     * @param request solicitud HTTP con la sesión
     * @return confirmación del cierre de sesión
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok("Sesión cerrada correctamente");
    }

    private void iniciarSesionSpring(Usuario usuario, HttpServletRequest request) {
        String nombreRol = usuario.getRol() != null ? usuario.getRol().getNombre_rol() : "CLIENTE";
        String rolNormalizado = Normalizer.normalize(nombreRol, Normalizer.Form.NFD)
                .replaceAll("[\\p{InCombiningDiacriticalMarks}]", "")
                .trim()
                .toUpperCase()
                .replace(' ', '_');

        SimpleGrantedAuthority authority = new SimpleGrantedAuthority("ROLE_" + rolNormalizado);
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                usuario.getCorreo(), null, Collections.singletonList(authority));

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);

        HttpSession session = request.getSession(true);
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
        session.setAttribute(ATRIBUTO_USUARIO, usuario.getId_usuario());
    }
}