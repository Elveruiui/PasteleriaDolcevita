package com.example.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import javax.transaction.Transactional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.example.model.Producto;
import com.example.model.Resena;
import com.example.model.Usuario;
import com.example.repository.ProductoRepository;
import com.example.repository.ResenaRepository;
import com.example.repository.UsuarioRepository;

@Service
public class ResenaService {

    @Autowired
    private ResenaRepository resenaRepository;

    @Autowired
    private ProductoRepository productoRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    public Map<String, Object> listarPorProducto(Long idProducto) throws Exception {
        Producto producto = productoRepository.findById(idProducto)
                .orElseThrow(() -> new Exception("Producto no encontrado."));

        String nombreProducto = producto.getNombre() == null ? "" : producto.getNombre().trim();
        List<Resena> lista = resenaRepository.listarPorNombreProducto(nombreProducto);

        double suma = 0.0;
        List<Map<String, Object>> items = new ArrayList<>();
        for (Resena r : lista) {
            suma += r.getCalificacion();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id_resena", r.getId_resena());
            m.put("calificacion", r.getCalificacion());
            m.put("comentario", r.getComentario());
            m.put("fecha", r.getFecha());

            String autor = "Cliente";
            if (r.getUsuario() != null) {
                String nom = r.getUsuario().getNombre() != null ? r.getUsuario().getNombre() : "";
                String ape = r.getUsuario().getApellido() != null ? r.getUsuario().getApellido() : "";
                String completo = (nom + " " + ape).trim();
                if (!completo.isEmpty()) {
                    autor = completo;
                }
            }
            m.put("autor", autor);
            m.put("tamano", r.getProducto() != null ? r.getProducto().getTamano() : null);
            items.add(m);
        }

        double promedio = lista.isEmpty() ? 0.0 : suma / lista.size();

        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("promedio", Math.round(promedio * 10.0) / 10.0);
        respuesta.put("total", lista.size());
        respuesta.put("resenas", items);
        return respuesta;
    }

    public Map<String, Object> verificarElegibilidad(Long idProducto, String correoUsuario) throws Exception {
        Producto producto = productoRepository.findById(idProducto)
                .orElseThrow(() -> new Exception("Producto no encontrado."));

        Map<String, Object> res = new LinkedHashMap<>();
        if (correoUsuario == null || correoUsuario.trim().isEmpty() || "anonymousUser".equalsIgnoreCase(correoUsuario)) {
            res.put("puedeResenar", false);
            res.put("yaReseno", false);
            return res;
        }

        Usuario usuario = usuarioRepository.buscarPorCorreo(correoUsuario.trim())
                .orElseThrow(() -> new Exception("Usuario no encontrado."));

        String nombreProducto = producto.getNombre() == null ? "" : producto.getNombre().trim();
        boolean comproEntregado = resenaRepository.contarComprasEntregadas(usuario.getId_usuario(), nombreProducto) > 0;
        List<Resena> existentes = resenaRepository.buscarPorUsuarioYNombreProducto(usuario.getId_usuario(), nombreProducto);
        Resena existente = existentes.isEmpty() ? null : existentes.get(0);

        res.put("puedeResenar", comproEntregado);
        res.put("yaReseno", existente != null);
        if (existente != null) {
            res.put("calificacion", existente.getCalificacion());
            res.put("comentario", existente.getComentario());
        }
        return res;
    }

    @Transactional
    public Resena guardarResena(Long idProducto, int calificacion, String comentario, String correoUsuario) throws Exception {
        if (correoUsuario == null || correoUsuario.trim().isEmpty() || "anonymousUser".equalsIgnoreCase(correoUsuario)) {
            throw new Exception("Debes iniciar sesión para dejar una reseña.");
        }
        if (calificacion < 1 || calificacion > 5) {
            throw new Exception("La calificación debe estar entre 1 y 5 estrellas.");
        }
        String texto = comentario == null ? "" : comentario.trim();
        if (texto.length() < 4) {
            throw new Exception("Escribe un comentario de al menos 4 caracteres.");
        }
        if (texto.length() > 500) {
            texto = texto.substring(0, 500);
        }

        Producto producto = productoRepository.findById(idProducto)
                .orElseThrow(() -> new Exception("Producto no encontrado."));
        Usuario usuario = usuarioRepository.buscarPorCorreo(correoUsuario.trim())
                .orElseThrow(() -> new Exception("Usuario no encontrado."));

        String nombreProducto = producto.getNombre() == null ? "" : producto.getNombre().trim();
        long entregas = resenaRepository.contarComprasEntregadas(usuario.getId_usuario(), nombreProducto);
        if (entregas <= 0) {
            throw new Exception("Solo puedes opinar sobre productos de pedidos que ya fueron entregados.");
        }

        List<Resena> existentes = resenaRepository.buscarPorUsuarioYNombreProducto(usuario.getId_usuario(), nombreProducto);
        Resena resena = existentes.isEmpty() ? new Resena() : existentes.get(0);

        resena.setProducto(producto);
        resena.setUsuario(usuario);
        resena.setCalificacion(calificacion);
        resena.setComentario(texto);
        resena.setFecha(LocalDateTime.now());

        return resenaRepository.save(resena);
    }
}