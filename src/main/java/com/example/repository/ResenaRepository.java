package com.example.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.example.model.Resena;

@Repository
public interface ResenaRepository extends JpaRepository<Resena, Long> {

    @Query("SELECT r FROM Resena r WHERE LOWER(TRIM(r.producto.nombre)) = LOWER(TRIM(:nombreProducto)) ORDER BY r.fecha DESC")
    List<Resena> listarPorNombreProducto(@Param("nombreProducto") String nombreProducto);

    @Query("SELECT r FROM Resena r WHERE r.usuario.id_usuario = :idUsuario AND LOWER(TRIM(r.producto.nombre)) = LOWER(TRIM(:nombreProducto)) ORDER BY r.fecha DESC")
    List<Resena> buscarPorUsuarioYNombreProducto(@Param("idUsuario") Long idUsuario,
            @Param("nombreProducto") String nombreProducto);

    @Query("SELECT COUNT(d) FROM DetallePedido d WHERE d.pedido.usuario.id_usuario = :idUsuario AND UPPER(d.pedido.estado) = 'ENTREGADO' AND LOWER(TRIM(d.producto.nombre)) = LOWER(TRIM(:nombreProducto))")
    long contarComprasEntregadas(@Param("idUsuario") Long idUsuario,
            @Param("nombreProducto") String nombreProducto);
}