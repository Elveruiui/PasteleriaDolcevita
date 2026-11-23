DROP DATABASE IF EXISTS pasteleriaweb;
CREATE DATABASE pasteleriaweb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pasteleriaweb;

CREATE TABLE rol (
    id_rol     INT AUTO_INCREMENT PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL,
    estado     INT NOT NULL DEFAULT 1
);

CREATE TABLE usuario (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    id_rol     INT NOT NULL,
    nombre     VARCHAR(100) NOT NULL,
    apellido   VARCHAR(100) NOT NULL,
    correo     VARCHAR(100) NOT NULL UNIQUE,
    telefono   VARCHAR(15) NULL,
    contrasena VARCHAR(255) NOT NULL,
    estado     INT NOT NULL DEFAULT 1,
    FOREIGN KEY (id_rol) REFERENCES rol (id_rol)
);

CREATE TABLE direccion_usuario (
    id_direccion INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario   INT NOT NULL,
    alias        VARCHAR(60) NOT NULL DEFAULT 'Casa',
    direccion    VARCHAR(150) NOT NULL,
    referencia   VARCHAR(150) NULL,
    latitud      DOUBLE NULL,
    longitud     DOUBLE NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario) ON DELETE CASCADE
);

CREATE TABLE categoria (
    id_categoria INT AUTO_INCREMENT PRIMARY KEY,
    nombre       VARCHAR(100) NOT NULL,
    descripcion  VARCHAR(255) NOT NULL,
    estado       INT NOT NULL DEFAULT 1
);

CREATE TABLE producto (
    id_producto  INT AUTO_INCREMENT PRIMARY KEY,
    id_categoria INT NOT NULL,
    nombre       VARCHAR(100) NOT NULL,
    tamano       VARCHAR(20) NOT NULL DEFAULT 'MEDIANO',
    descripcion  VARCHAR(255) NOT NULL,
    precio       DECIMAL(10,2) NOT NULL,
    imagen       VARCHAR(255) NULL,
    stock        INT NOT NULL DEFAULT 0,
    estado       INT NOT NULL DEFAULT 1,
    FOREIGN KEY (id_categoria) REFERENCES categoria (id_categoria)
);

CREATE TABLE pedido (
    id_pedido         INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario        INT NOT NULL,
    id_direccion      INT NOT NULL,
    fecha_pedido      DATETIME NULL,
    fecha_entrega     DATETIME NULL,
    modalidad_entrega VARCHAR(255) NOT NULL,
    estado            VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    total             DECIMAL(10,2) NOT NULL,
    costo_delivery    DECIMAL(10,2) NOT NULL DEFAULT 0,
    observacion       VARCHAR(200) NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario),
    FOREIGN KEY (id_direccion) REFERENCES direccion_usuario (id_direccion)
);

CREATE TABLE detallepedido (
    id_detalle      INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido       INT NOT NULL,
    id_producto     INT NOT NULL,
    cantidad        INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal        DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (id_pedido) REFERENCES pedido (id_pedido) ON DELETE CASCADE,
    FOREIGN KEY (id_producto) REFERENCES producto (id_producto)
);

CREATE TABLE entrega (
    id_entrega       INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido        INT NOT NULL UNIQUE,
    id_motorizado    INT NOT NULL,
    fecha_asignacion DATETIME NOT NULL,
    fecha_entrega    DATETIME NULL,
    estado           INT NOT NULL DEFAULT 0,
    costo_delivery   DECIMAL(10,2) NOT NULL DEFAULT 0,
    observacion      VARCHAR(200) NULL,
    FOREIGN KEY (id_pedido) REFERENCES pedido (id_pedido) ON DELETE CASCADE,
    FOREIGN KEY (id_motorizado) REFERENCES usuario (id_usuario)
);
