package com.example.security;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Configuración de Spring Security. Define las rutas públicas, las rutas que requieren sesión y los permisos de cada rol: Cliente, Administrador y Motorizado.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /**
     * Codificador de contraseñas con BCrypt.
     * @return codificador BCrypt
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Define las reglas de acceso por ruta y rol, y las respuestas 401 y 403 cuando el acceso no está permitido.
     * @param http configuración de seguridad HTTP
     * @return cadena de filtros de seguridad
     * @throws Exception si la configuración no se puede construir
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf().disable()
            .authorizeRequests()

                .antMatchers(
                    "/", "/index.html", "/menu.html", "/detalle-producto.html",
                    "/carrito.html", "/login.html",
                    "/css/**", "/js/**", "/img/**", "/favicon.ico"
                ).permitAll()

                .antMatchers("/auth/**").permitAll()
                .antMatchers("/actuator/health/**", "/actuator/info").permitAll()
                .antMatchers("/actuator/**").hasRole("ADMINISTRADOR")
                .antMatchers("/mantenimiento/**").hasRole("ADMINISTRADOR")

                .antMatchers(HttpMethod.GET,
                    "/producto/listarProductos",
                    "/producto/imagenProducto",
                    "/producto/listarPorCategoria/**",
                    "/producto/listarNombre/**",
                    "/producto/listarId/**",
                    "/categoria/listarCategorias",
                    "/categoria/listarNombre/**",
                    "/categoria/listarId/**"
                ).permitAll()

                
                .antMatchers(HttpMethod.PUT, "/usuario/actualizar/**", "/usuario/cambiarContrasena/**").authenticated()

                .antMatchers("/motorizado/**").hasRole("MOTORIZADO")
                .antMatchers(HttpMethod.PUT, "/entrega/cambiarEstado/**").hasRole("MOTORIZADO")
                .antMatchers(
                    "/admin/entregas.html",
                    "/admin/admin.css",
                    "/admin/js/admin.js",
                    "/admin/js/entregas.js"
                ).hasAnyRole("ADMINISTRADOR", "MOTORIZADO")
                .antMatchers(HttpMethod.GET, "/entrega/**", "/reporte/entregas/**").hasAnyRole("ADMINISTRADOR", "MOTORIZADO")
                .antMatchers(HttpMethod.PUT, "/entrega/actualizar/**", "/pedido/actualizarEstado/**").hasAnyRole("ADMINISTRADOR", "MOTORIZADO")
                .antMatchers(HttpMethod.POST, "/entrega/**").hasRole("ADMINISTRADOR")
                .antMatchers(HttpMethod.DELETE, "/entrega/**").hasRole("ADMINISTRADOR")

                .antMatchers("/admin/**").hasRole("ADMINISTRADOR")
                .antMatchers("/producto/**").hasRole("ADMINISTRADOR")
                .antMatchers("/categoria/**").hasRole("ADMINISTRADOR")
                .antMatchers("/usuario/**", "/rol/**", "/reporte/**").hasRole("ADMINISTRADOR")
                .antMatchers(HttpMethod.DELETE, "/pedido/**").hasRole("ADMINISTRADOR")

                .antMatchers("/mis-pedidos.html", "/checkout.html", "/confirmacion.html").authenticated()
                .antMatchers("/direccion/**", "/pedido/**", "/detallepedido/**").authenticated()

                .anyRequest().authenticated()
            .and()
            .exceptionHandling()
                .authenticationEntryPoint((request, response, authException) -> {
                    if (esNavegacionHtml(request)) {
                        response.sendRedirect("/login.html");
                    } else {
                        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                        response.setContentType("text/plain;charset=UTF-8");
                        response.getWriter().write("Debes iniciar sesión para realizar esta acción.");
                    }
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    if (esNavegacionHtml(request)) {
                        response.sendRedirect("/index.html");
                    } else {
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        response.setContentType("text/plain;charset=UTF-8");
                        response.getWriter().write("No tienes permisos para acceder a esta sección.");
                    }
                });

        return http.build();
    }

    private boolean esNavegacionHtml(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String accept = request.getHeader("Accept");
        return uri.endsWith(".html") || (accept != null && accept.contains("text/html"));
    }
}