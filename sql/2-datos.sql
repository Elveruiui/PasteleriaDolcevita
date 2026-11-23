USE pasteleriaweb;

INSERT INTO rol (nombre_rol, estado) VALUES
('Administrador', 1),
('Cliente', 1),
('Motorizado', 1);

INSERT INTO usuario (id_rol, nombre, apellido, correo, telefono, contrasena, estado) VALUES
((SELECT id_rol FROM rol WHERE nombre_rol = 'Cliente'), 'Lucía', 'Paredes', 'lucia.paredes@correo.com', '987654321', 'Cliente123', 1),
((SELECT id_rol FROM rol WHERE nombre_rol = 'Administrador'), 'Admin', 'Principal', 'admin@dolcevita.com', '900000001', 'Admin123', 1),
((SELECT id_rol FROM rol WHERE nombre_rol = 'Motorizado'), 'Marco', 'Huamán', 'marco.huaman@dolcevita.com', '900000002', 'Moto123', 1);

INSERT INTO direccion_usuario (id_usuario, alias, direccion, referencia, latitud, longitud) VALUES
((SELECT id_usuario FROM usuario WHERE correo = 'lucia.paredes@correo.com'), 'Casa', 'Av. Primavera 123, Santiago de Surco', 'Frente al parque', -12.1119, -76.9794);

INSERT INTO categoria (nombre, descripcion, estado) VALUES
('Tortas personalizadas', 'Diseños creados especialmente para cada celebración', 1),
('Tortas clásicas', 'Sabores tradicionales para compartir en familia', 1),
('Postres', 'Postres individuales y para compartir', 1),
('Bocaditos', 'Alfajores, brownies y más', 1),
('Keke artesanales', 'Keke de sabores variados', 1);

INSERT INTO producto (id_categoria, nombre, tamano, descripcion, precio, imagen, stock, estado) VALUES
((SELECT id_categoria FROM categoria WHERE nombre = 'Tortas personalizadas'), 'Blooming Celebration', 'GRANDE', 'Torta personalizada floral elaborada artesanalmente para celebraciones especiales.', 150.00, 'torta-floral.jpg', 5, 1),
((SELECT id_categoria FROM categoria WHERE nombre = 'Tortas personalizadas'), 'Golden Butterfly Cake', 'GRANDE', 'Torta con mariposas doradas, ideal para cumpleaños y ocasiones únicas.', 165.00, 'torta-mariposas.jpg', 4, 1),
((SELECT id_categoria FROM categoria WHERE nombre = 'Tortas personalizadas'), 'Royal Blue Cake', 'GRANDE', 'Torta azul con detalles dorados elaborada artesanalmente.', 155.00, 'torta-azul.jpg', 6, 1),
((SELECT id_categoria FROM categoria WHERE nombre = 'Tortas clásicas'), 'Chocolate Supreme', 'GRANDE', 'Torta clásica de chocolate para compartir en familia.', 85.00, 'clasica-chocolate.jpg', 10, 1),
((SELECT id_categoria FROM categoria WHERE nombre = 'Tortas clásicas'), 'Strawberry Delight', 'MEDIANO', 'Bizcocho suave con crema y fresas frescas.', 80.00, 'clasica-fresa.jpg', 8, 1),
((SELECT id_categoria FROM categoria WHERE nombre = 'Tortas clásicas'), 'Carrot Delight', 'MEDIANO', 'Torta de zanahoria con crema y nueces.', 78.00, 'clasica-zanahoria.jpg', 7, 1),
((SELECT id_categoria FROM categoria WHERE nombre = 'Postres'), 'Oreo Cheesecake', 'MEDIANO', 'Cheesecake cremoso con base de galleta Oreo.', 75.00, 'postre-oreo.jpg', 9, 1),
((SELECT id_categoria FROM categoria WHERE nombre = 'Postres'), 'Classic Tiramisu', 'MEDIANO', 'Tiramisú clásico de café y cacao.', 68.00, 'postre-tiramisu.jpg', 6, 1),
((SELECT id_categoria FROM categoria WHERE nombre = 'Postres'), 'Tartaleta de fresa', 'PEQUEÑO', 'Tartaletas con crema pastelera y fresas.', 55.00, 'postre-tartaleta.jpg', 12, 1),
((SELECT id_categoria FROM categoria WHERE nombre = 'Bocaditos'), 'Brownie clásico', 'PEQUEÑO', 'Brownie de chocolate húmedo y suave.', 30.00, 'bocadito-brownie.jpg', 20, 1),
((SELECT id_categoria FROM categoria WHERE nombre = 'Bocaditos'), 'Alfajor clásico', 'PEQUEÑO', 'Alfajores rellenos de manjar blanco.', 28.00, 'bocadito-alfajor.jpg', 25, 1),
((SELECT id_categoria FROM categoria WHERE nombre = 'Keke artesanales'), 'Keke de arándanos', 'MEDIANO', 'Keke casero con arándanos, textura suave.', 28.00, 'keke-arandanos.jpg', 10, 1),
((SELECT id_categoria FROM categoria WHERE nombre = 'Keke artesanales'), 'Keke de naranja', 'MEDIANO', 'Keke artesanal con ralladura de naranja.', 26.00, 'keke-naranja.jpg', 10, 1);
