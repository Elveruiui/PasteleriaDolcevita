const { contenido } = montarPagina({
  activo: "pedidos",
  titulo: "Detalle del pedido",
  subtitulo: "Consulta los datos y cambia el estado.",
  reporte: "pedidos",
});

const idPedido = new URLSearchParams(location.search).get("id");

function formatearDireccionAdmin(dir) {
  if (!dir) return "—";
  const etiquetaAlias = dir.alias
    ? `<span class="estado e-confirmado" style="margin-right:.4rem"><i class="fa-solid fa-house"></i> ${esc(dir.alias)}</span>`
    : "";
  const textoRef = dir.referencia
    ? `<div class="ayuda" style="margin-top:3px"><strong>Referencia:</strong> ${esc(dir.referencia)}</div>`
    : "";
  const botonMapa = (dir.latitud && dir.longitud)
    ? `<div style="margin-top:.5rem">
         <a href="https://www.google.com/maps?q=${dir.latitud},${dir.longitud}" target="_blank" rel="noopener" class="btn btn-borde btn-sm" style="display:inline-flex;align-items:center;gap:.4rem">
           <i class="fa-solid fa-map-location-dot" style="color:var(--dorado-oscuro)"></i> Abrir ubicación en Google Maps
         </a>
       </div>`
    : "";
  return `<div style="text-align:right">${etiquetaAlias}<span>${esc(dir.direccion)}</span>${textoRef}${botonMapa}</div>`;
}

function lineaDeTiempo(p, estadoActual) {
  const pasos = estadosPorModalidad(p.modalidad_entrega).filter((e) => e !== "CANCELADO");
  const cancelado = estadoActual === "CANCELADO";
  const completo = estadoActual === "ENTREGADO";
  const posicion = pasos.indexOf(estadoActual);
  const items = pasos.map((e, i) => {
    const hecho = !cancelado && (i < posicion || (completo && i === posicion));
    const actual = !cancelado && !completo && i === posicion;
    const clase = hecho ? " hecho" : actual ? " actual" : "";
    const contenidoPunto = hecho ? '<i class="fa-solid fa-check"></i>' : String(i + 1);
    return '<li class="paso-seg' + clase + '"><span class="punto">' + contenidoPunto + '</span><span class="etq">' + esc(etiquetaEstado(e, p.modalidad_entrega)) + "</span></li>";
  }).join("");
  return '<section class="panel" style="margin-top:1.2rem"><h3>Seguimiento del pedido</h3>' +
    (cancelado ? '<p class="ayuda-campo" style="color:var(--rojo)">Este pedido fue cancelado.</p>' : "") +
    '<ol class="seguimiento' + (cancelado ? " cancelado" : "") + '">' + items + "</ol></section>";
}

function dibujar(p) {
  const estadoActual = String(p.estado || "").toUpperCase();
  const cancelado = estadoActual === "CANCELADO";
  const entregado = estadoActual === "ENTREGADO";
  const finalizado = cancelado || entregado;
  const lista = estadosPorModalidad(p.modalidad_entrega);
  const opciones = lista.includes(estadoActual) ? lista : [estadoActual].concat(lista);
  const posicionActual = lista.indexOf(estadoActual);
  const esDelivery = !esRecojo(p.modalidad_entrega);
  const soloMotorizado = (e) => esDelivery && (e === "EN_CAMINO" || e === "ENTREGADO");
  const bloqueado = (e) => {
    if (e !== estadoActual && soloMotorizado(e)) return true;
    if (posicionActual < 0) return false;
    if (e === estadoActual) return false;
    if (e === "CANCELADO") return entregado;
    return lista.indexOf(e) < posicionActual;
  };
  const textoOpcion = (e, elegido) => (e === elegido && e !== estadoActual && e !== "CANCELADO" ? etiquetaEstado(estadoActual, p.modalidad_entrega) + " → " : "") + etiquetaEstado(e, p.modalidad_entrega);
  const siguiente = finalizado ? estadoActual : (lista.slice(posicionActual + 1).find((e) => e !== "CANCELADO" && !bloqueado(e)) || estadoActual);
  const detalles = p.detalles || [];

  const filasProductos = detalles.map((d) => {
    const prod = d.producto || {};
    const tamano = prod.tamano || "MEDIANO";
    return "<tr>" +
      "<td><strong>" + esc(prod.nombre || "—") + "</strong></td>" +
      '<td><span class="estado e-confirmado">' + esc(tamano) + "</span></td>" +
      "<td>" + d.cantidad + "</td>" +
      "<td>" + precio(d.precio_unitario) + "</td>" +
      "<td>" + precio(d.subtotal) + "</td>" +
      "</tr>";
  }).join("");

  contenido.innerHTML =
    '<a class="enlace-volver" href="pedidos.html"><i class="fa-solid fa-arrow-left"></i> Volver a pedidos</a>' +
    '<div class="detalle-admin ajustado">' +
    '<section class="panel"><h3>Pedido ' + codigoPedido(p.id_pedido) + "</h3>" +
    '<div class="fila-dato"><span>Estado</span><span>' + insigniaEstadoPedido(p.estado, p.modalidad_entrega) + "</span></div>" +
    '<div class="fila-dato"><span>Cliente</span><span>' + esc(nombreCompleto(p.usuario)) + "</span></div>" +
    '<div class="fila-dato"><span>Correo</span><span>' + esc(p.usuario ? p.usuario.correo : "—") + "</span></div>" +
    '<div class="fila-dato"><span>Teléfono</span><span>' + esc(p.usuario && p.usuario.telefono ? p.usuario.telefono : "—") + "</span></div>" +
    '<div class="fila-dato"><span>Modalidad</span><span>' + esc(p.modalidad_entrega || "—") + "</span></div>" +
    '<div class="fila-dato" style="align-items:flex-start"><span>Dirección</span>' + formatearDireccionAdmin(p.direccion) + "</div>" +
    '<div class="fila-dato"><span>Fecha del pedido</span><span>' + fechaHora(p.fecha_pedido) + "</span></div>" +
    '<div class="fila-dato"><span>Fecha de entrega</span><span>' + fechaHora(p.fecha_entrega) + "</span></div>" +
    '<div class="fila-dato"><span>Observaciones</span><span>' + esc(p.observacion || "—") + "</span></div>" +
    "</section>" +
    '<div>' +
    '<section class="panel"><h3>Productos del pedido</h3>' +
    '<div class="tabla-caja" style="box-shadow:none"><table class="tabla"><thead><tr><th>Producto</th><th>Tamaño</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>' +
    (filasProductos || '<tr><td colspan="5" class="mensaje-tabla">Sin productos.</td></tr>') +
    '</tbody></table></div>' +
    (Number(p.costo_delivery) > 0
      ? '<div class="fila-dato"><span>Productos</span><span>' + precio(Number(p.total) - Number(p.costo_delivery)) + "</span></div>" +
        '<div class="fila-dato"><span>Delivery</span><span>' + precio(p.costo_delivery) + "</span></div>"
      : "") +
    '<div class="total-fila"><span>Total</span><span>' + precio(p.total) + "</span></div></section>" +
    '<section class="panel" style="margin-top:1.2rem"><h3>Actualizar estado</h3>' +
    '<label for="nuevo-estado">Estado del pedido</label>' +
    '<select id="nuevo-estado"' + (finalizado ? " disabled" : "") + ">" +
    opciones.map((e) => '<option value="' + e + '"' + (e === siguiente ? " selected" : "") + (bloqueado(e) ? " disabled" : "") + ">" + esc(textoOpcion(e, siguiente)) + "</option>").join("") +
    "</select>" +
    '<p class="ayuda-campo">' + (cancelado
      ? "Un pedido cancelado ya no se puede reactivar."
      : entregado
        ? "Un pedido entregado ya no se puede modificar."
        : (esDelivery ? "En camino y Entregado los actualiza el motorizado. " : "") + "Los estados anteriores quedan bloqueados. Al cancelar un pedido, el stock de sus productos se devuelve automáticamente.") + "</p>" +
    '<div id="error-estado" class="error-form" hidden></div>' +
    '<div class="acciones-estado">' +
    '<button class="btn btn-dorado" id="guardar-estado"' + (finalizado || siguiente === estadoActual ? " disabled" : "") + '>Actualizar estado</button>' +
    '<button class="btn btn-rojo" id="cancelar-pedido" style="display:none">Cancelar pedido</button>' +
    "</div>" +
    "</section></div></div>" +
    lineaDeTiempo(p, estadoActual);

  if (!finalizado) {
    const selector = document.getElementById("nuevo-estado");
    const conFlecha = () => selector.querySelectorAll("option").forEach((o) => { o.textContent = textoOpcion(o.value, selector.value); });
    const sinFlecha = () => selector.querySelectorAll("option").forEach((o) => { o.textContent = etiquetaEstado(o.value, p.modalidad_entrega); });
    selector.addEventListener("mousedown", sinFlecha);
    selector.addEventListener("focus", sinFlecha);
    const guardar = document.getElementById("guardar-estado");
    const botonCancelar = document.getElementById("cancelar-pedido");
    selector.addEventListener("change", () => {
      conFlecha();
      const esCancelar = selector.value === "CANCELADO";
      botonCancelar.style.display = esCancelar ? "" : "none";
      guardar.disabled = esCancelar || selector.value === estadoActual;
    });
    botonCancelar.addEventListener("click", () => guardarEstado(p, estadoActual));
    selector.addEventListener("blur", conFlecha);
  }
  if (!cancelado) {
    document.getElementById("guardar-estado").addEventListener("click", () => {
      if (document.getElementById("nuevo-estado").value === "CANCELADO") return;
      guardarEstado(p, estadoActual);
    });
  }
}

async function guardarEstado(pedido, estadoActual) {
  const nuevo = document.getElementById("nuevo-estado").value;
  const error = document.getElementById("error-estado");
  error.hidden = true;
  if (nuevo === estadoActual) {
    error.textContent = "Elige un estado distinto al actual.";
    error.hidden = false;
    return;
  }
  if (nuevo === "CANCELADO") {
    const seguro = await confirmar("Cancelar pedido",
      "¿Cancelar el pedido " + codigoPedido(pedido.id_pedido) + "? Se devolverá el stock de sus productos y no podrá reactivarse.", "Cancelar pedido");
    if (!seguro) return;
  }
  try {
    await AdminApi.cambiarEstadoPedido(pedido.id_pedido, nuevo);
    avisar("Estado actualizado a " + etiquetaEstado(nuevo, pedido.modalidad_entrega) + ".");
    await cargar();
  } catch (e) {
    error.textContent = e.message;
    error.hidden = false;
  }
}

async function cargar() {
  if (!idPedido) {
    contenido.innerHTML = '<p class="mensaje-estado">No se indicó qué pedido mostrar. <a href="pedidos.html">Volver a pedidos</a></p>';
    return;
  }
  try {
    dibujar(await AdminApi.pedido(idPedido));
  } catch (error) {
    contenido.innerHTML = '<p class="mensaje-estado error">No se pudo cargar el pedido. ' + esc(error.message) + ' <a href="pedidos.html">Volver a pedidos</a></p>';
  }
}

cargar();