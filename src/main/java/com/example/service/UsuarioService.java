package com.example.service;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.example.model.Rol;
import com.example.model.Usuario;
import com.example.repository.RolRepository;
import com.example.repository.UsuarioRepository;

@Service
public class UsuarioService {

    @Autowired
    private UsuarioRepository usuarioR;

    @Autowired
    private RolRepository rolRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    public List<Usuario> listarAll() {
        return usuarioR.findAll();
    }

    public List<Usuario> listarporNombre(String nombre) {
        return usuarioR.findByNombre(nombre);
    }

    public Usuario listarID(Long id) {
        return usuarioR.findById(id).orElse(null);
    }

    public Optional<Usuario> buscarPorCorreo(String correo) {
        return usuarioR.buscarPorCorreo(correo);
    }

    public Usuario guardar(Usuario usuario) {
        if (usuario.getContrasena() != null && !esBCrypt(usuario.getContrasena())) {
            usuario.setContrasena(passwordEncoder.encode(usuario.getContrasena()));
        }
        return usuarioR.save(usuario);
    }

    public Usuario actualizar(Long id, Usuario detalles) throws Exception {
        Optional<Usuario> optional = usuarioR.findById(id);
        if (optional.isPresent()) {
            Usuario existente = optional.get();

            
            if (detalles.getCorreo() != null && !detalles.getCorreo().trim().equalsIgnoreCase(existente.getCorreo())) {
                String nuevoCorreo = detalles.getCorreo().trim();
                Optional<Usuario> ocupado = usuarioR.buscarPorCorreo(nuevoCorreo);
                if (ocupado.isPresent() && !ocupado.get().getId_usuario().equals(id)) {
                    throw new Exception("Ya existe una cuenta registrada con ese correo.");
                }
                existente.setCorreo(nuevoCorreo);
            }

            if (detalles.getRol() != null) {
                existente.setRol(detalles.getRol());
            }
            if (detalles.getNombre() != null) {
                existente.setNombre(detalles.getNombre().trim());
            }
            if (detalles.getApellido() != null) {
                existente.setApellido(detalles.getApellido().trim());
            }
            if (detalles.getTelefono() != null) {
                existente.setTelefono(detalles.getTelefono().trim());
            }
            if (detalles.getContrasena() != null && !detalles.getContrasena().trim().isEmpty()) {
                String nuevaClave = detalles.getContrasena().trim();
                existente.setContrasena(esBCrypt(nuevaClave) ? nuevaClave : passwordEncoder.encode(nuevaClave));
            }
            if (detalles.getEstado() == 0 || detalles.getEstado() == 1) {
                existente.setEstado(detalles.getEstado());
            }
            return usuarioR.save(existente);
        }
        return null;
    }

    
    public void cambiarContrasena(Long id, String contrasenaActual, String contrasenaNueva) throws Exception {
        Usuario usuario = usuarioR.findById(id)
                .orElseThrow(() -> new Exception("Usuario no encontrado."));

        if (contrasenaActual == null || contrasenaActual.isEmpty()) {
            throw new Exception("Debes ingresar tu contraseña actual.");
        }

        String guardada = usuario.getContrasena() == null ? "" : usuario.getContrasena();
        boolean coincide;
        if (esBCrypt(guardada)) {
            coincide = passwordEncoder.matches(contrasenaActual, guardada);
        } else {
            coincide = guardada.equals(contrasenaActual);
        }

        if (!coincide) {
            throw new Exception("La contraseña actual que ingresaste no es correcta.");
        }

        if (contrasenaNueva == null || contrasenaNueva.trim().length() < 6) {
            throw new Exception("La nueva contraseña debe tener al menos 6 caracteres.");
        }

        
        usuario.setContrasena(passwordEncoder.encode(contrasenaNueva.trim()));
        usuarioR.save(usuario);
    }

    public boolean eliminar(Long id) {
        if (usuarioR.existsById(id)) {
            usuarioR.deleteById(id);
            return true;
        }
        return false;
    }

    public Usuario autenticar(String correo, String contrasenaPlana) throws Exception {
        Usuario usuario = usuarioR.buscarPorCorreo(correo == null ? "" : correo.trim())
                .orElseThrow(() -> new Exception("Correo o contraseña incorrectos."));

        if (usuario.getEstado() != 1) {
            throw new Exception("Tu cuenta se encuentra inactiva. Contacta al administrador.");
        }

        String guardada = usuario.getContrasena() == null ? "" : usuario.getContrasena();
        boolean coincide;
        if (esBCrypt(guardada)) {
            coincide = passwordEncoder.matches(contrasenaPlana, guardada);
        } else {
            coincide = guardada.equals(contrasenaPlana);
            if (coincide) {
                usuario.setContrasena(passwordEncoder.encode(contrasenaPlana));
                usuarioR.save(usuario);
            }
        }

        if (!coincide) {
            throw new Exception("Correo o contraseña incorrectos.");
        }
        return usuario;
    }

    public Usuario registrarCliente(Usuario nuevo) throws Exception {
        String correo = nuevo.getCorreo() == null ? "" : nuevo.getCorreo().trim();
        if (correo.isEmpty()) {
            throw new Exception("El correo es obligatorio.");
        }
        if (usuarioR.buscarPorCorreo(correo).isPresent()) {
            throw new Exception("Ya existe una cuenta registrada con ese correo.");
        }
        if (nuevo.getContrasena() == null || nuevo.getContrasena().length() < 6) {
            throw new Exception("La contraseña debe tener al menos 6 caracteres.");
        }

        Rol rolCliente = rolRepository.buscarPorNombre("Cliente")
                .orElseThrow(() -> new Exception("No se encontró el rol Cliente en la base de datos."));

        nuevo.setCorreo(correo);
        nuevo.setRol(rolCliente);
        nuevo.setEstado(1);
        nuevo.setContrasena(passwordEncoder.encode(nuevo.getContrasena()));
        return usuarioR.save(nuevo);
    }

    private boolean esBCrypt(String texto) {
        return texto != null && (texto.startsWith("$2a$") || texto.startsWith("$2b$") || texto.startsWith("$2y$"));
    }
}