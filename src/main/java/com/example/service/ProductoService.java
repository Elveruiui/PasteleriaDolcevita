package com.example.service;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.core.io.Resource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.example.model.Producto;
import com.example.repository.ProductoRepository;

@Service
public class ProductoService {
	public final String CARPETA_IMAGENES = "uploads/productos/";

    @Autowired
    private ProductoRepository productoRepository;

    public List<Producto> listarAll() {
        return productoRepository.findAll();
    }

    public List<Producto> listarporNombre(String nombre) {
        return productoRepository.findByNombre(nombre);
    }

    public List<Producto> listarProductosPorCategoria(Long idCategoria) {
        return productoRepository.listarporCategoria(idCategoria);
    }

    public Producto listarID(Long id) {
        return productoRepository.findById(id).orElse(null);
    }

    
    /*public Producto registrar(Producto producto, MultipartFile file) throws Exception {
        if (file != null && !file.isEmpty()) {
            String nombreImagen = guardarArchivo(file);
            producto.setImagen(nombreImagen);
        }
        return productoRepository.save(producto);
    }*/
    
 
    public Producto registrar(Producto producto, MultipartFile file) throws Exception {
        if (producto.getTamano() == null || producto.getTamano().trim().isEmpty()) {
            producto.setTamano("MEDIANO");
        } else {
            producto.setTamano(producto.getTamano().toUpperCase());
        }
        if (file != null && !file.isEmpty()) {
            String nombreImagen = guardarArchivo(file);
            producto.setImagen(nombreImagen);
        }
        return productoRepository.save(producto);
    }

    
    public List<Producto> registrarMultiples(List<Producto> productos, MultipartFile file) throws Exception {
        String nombreImagen = null;
        if (file != null && !file.isEmpty()) {
            nombreImagen = guardarArchivo(file);
        }
        for (Producto p : productos) {
            if (p.getTamano() == null || p.getTamano().trim().isEmpty()) {
                p.setTamano("MEDIANO");
            } else {
                p.setTamano(p.getTamano().toUpperCase());
            }
            if (nombreImagen != null) {
                p.setImagen(nombreImagen);
            }
        }
        return productoRepository.saveAll(productos);
    }

    
    public Producto actualizar(Long id, Producto detalles, MultipartFile file) throws Exception {
        Optional<Producto> optional = productoRepository.findById(id);
        if (optional.isPresent()) {
            Producto existente = optional.get();
            existente.setCategoria(detalles.getCategoria());
            existente.setNombre(detalles.getNombre());
            existente.setDescripcion(detalles.getDescripcion());
            
            existente.setPrecio(detalles.getPrecio());
            existente.setStock(detalles.getStock());
            existente.setEstado(detalles.getEstado());

            if (file != null && !file.isEmpty()) {
                String nuevaImagen = guardarArchivo(file);
                existente.setImagen(nuevaImagen);
            }
            return productoRepository.save(existente);
        }
        return null;
    }

    
    /*public Producto actualizar(Long id, Producto detalles, MultipartFile file) throws Exception {
        Optional<Producto> optional = productoRepository.findById(id);
        if (optional.isPresent()) {
            Producto existente = optional.get();
            existente.setCategoria(detalles.getCategoria());
            existente.setNombre(detalles.getNombre());
            existente.setDescripcion(detalles.getDescripcion());
            existente.setPrecio(detalles.getPrecio());
            existente.setStock(detalles.getStock());
            existente.setEstado(detalles.getEstado());

            
            if (file != null && !file.isEmpty()) {
                eliminarArchivoFisico(existente.getImagen());
                String nuevaImagen = guardarArchivo(file);
                existente.setImagen(nuevaImagen);
            }
            return productoRepository.save(existente);
        }
        return null;
    }*/

    
    public boolean eliminar(Long id) {
        Optional<Producto> optional = productoRepository.findById(id);
        if (optional.isPresent()) {
            eliminarArchivoFisico(optional.get().getImagen());
            productoRepository.deleteById(id);
            return true;
        }
        return false;
    }

    
    public Map<String, Object> obtenerImagen(String nombreImagen) throws Exception {
        Map<String, Object> resultado = new HashMap<>();
        Path directorio = Paths.get(CARPETA_IMAGENES);
        
        if (!Files.exists(directorio)) {
            Files.createDirectories(directorio);
        }

        if (nombreImagen != null && !nombreImagen.isEmpty()) {
            Path rutaArchivo = directorio.resolve(nombreImagen).toAbsolutePath();
            Resource recurso = new UrlResource(rutaArchivo.toUri());

            if (recurso.exists() && recurso.isReadable()) {
                resultado.put("imagen", recurso);
                resultado.put("imgDefault", false);
                return resultado;
            }
        }

        
        Path rutaDefault = directorio.resolve("default.png").toAbsolutePath();
        Resource recursoDefault = new UrlResource(rutaDefault.toUri());
        if (recursoDefault.exists() && recursoDefault.isReadable()) {
            resultado.put("imagen", recursoDefault);
            resultado.put("imgDefault", true);
        } else {
            resultado.put("imagen", null);
            resultado.put("imgDefault", true);
        }

        return resultado;
    }

    
    private String guardarArchivo(MultipartFile file) throws Exception {
        Path directorio = Paths.get(CARPETA_IMAGENES);
        if (!Files.exists(directorio)) {
            Files.createDirectories(directorio);
        }
        String nombreUnico = UUID.randomUUID().toString() + "_" + file.getOriginalFilename();
        Path rutaCompleta = directorio.resolve(nombreUnico);
        Files.write(rutaCompleta, file.getBytes());
        return nombreUnico;
    }

    private void eliminarArchivoFisico(String nombreImagen) {
        if (nombreImagen != null && !nombreImagen.isEmpty()) {
            try {
                Path ruta = Paths.get(CARPETA_IMAGENES).resolve(nombreImagen).toAbsolutePath();
                File archivo = ruta.toFile();
                if (archivo.exists() && archivo.isFile()) {
                    archivo.delete();
                }
            } catch (Exception e) {
                
            }
        }
    }

}
