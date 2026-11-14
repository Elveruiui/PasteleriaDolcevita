const zonaConfirmacion = document.getElementById("zonaConfirmacion");
const parametros = new URLSearchParams(location.search);
const idPedido = parametros.get("id");
const esNuevo = parametros.get("nuevo") === "1";

const CLASES_ESTADO = {
  PENDIENTE: "e-pendiente", CONFIRMADO: "e-confirmado", EN_CAMINO: "e-camino",
  ENTREGADO: "e-entregado", CANCELADO: "e-cancelado",
};

function formatearFecha(texto) {
  if (!texto) return "—";
  if (Array.isArray(texto)) {
    const [a, m, d, h = 0, min = 0] = texto;
    const dos = (n) => String(n).padStart(2, "0");
    return `${dos(d)}/${dos(m)}/${a} · ${dos(h)}:${dos(min)}`;
  }
  const [fecha, hora] = String(texto).split("T");
  const [a, m, d] = fecha.split("-");
  return d + "/" + m + "/" + a + (hora ? " · " + hora.slice(0, 5) : "");
}

function textoEstado(estado) {
  const t = String(estado || "").replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function formatearDireccionCliente(dir) {
  if (!dir) return "—";
  const alias = dir.alias
    ? `<span class="estado e-confirmado" style="margin-right:.4rem">${esc(dir.alias)}</span>`
    : "";
  const ref = dir.referencia
    ? `<div class="ayuda" style="margin-top:2px">Ref: ${esc(dir.referencia)}</div>`
    : "";
  const botonMapa = (dir.latitud && dir.longitud)
    ? `<div style="margin-top:.4rem">
         <a href="https://www.google.com/maps?q=${dir.latitud},${dir.longitud}" target="_blank" rel="noopener" class="btn btn-borde btn-sm" style="display:inline-flex;align-items:center;gap:.4rem;padding:4px 10px;font-size:.8rem">
           <i class="fa-solid fa-map-location-dot"></i> Ver ubicación en Google Maps
         </a>
       </div>`
    : "";
  return `<div>${alias}<strong>${esc(dir.direccion)}</strong>${ref}${botonMapa}</div>`;
}

async function iniciar() {
  if (!idPedido) {
    zonaConfirmacion.innerHTML = '<p class="mensaje-estado">No se indicó qué pedido mostrar. <a href="mis-pedidos.html" style="text-decoration:underline">Ir a mis pedidos</a></p>';
    return;
  }
  try {
    const p = await Api.pedido(idPedido);
    const productosHtml = (p.detalles || []).map((d) => {
      const nombre = d.producto ? esc(d.producto.nombre) : "Producto";
      const tamano = d.producto && d.producto.tamano
        ? ` <span class="estado e-confirmado" style="font-size:.75rem;padding:2px 8px">${esc(d.producto.tamano)}</span>`
        : "";
      return `<div style="margin-bottom:4px">${nombre}${tamano} <strong>× ${d.cantidad}</strong> (${formatearPrecio(d.subtotal)})</div>`;
    }).join("");

    const estado = String(p.estado || "").toUpperCase();
    const cabecera = esNuevo
      ? '<div class="check"><i class="fa-solid fa-check"></i></div><h1>¡Pedido registrado con éxito!</h1><p class="ayuda">Tu pedido ha sido registrado correctamente.</p>'
      : "<h1>Detalle de tu pedido</h1>";

    zonaConfirmacion.innerHTML = `
      ${cabecera}
      <p style="margin-top:.6rem"><strong>Número de pedido: #DV-${String(p.id_pedido).padStart(5, "0")}</strong></p>
      <div class="panel"><h3>Detalles del pedido</h3>
        <div class="fila-dato" style="align-items:flex-start"><span>Productos</span><span style="text-align:right">${productosHtml || "—"}</span></div>
        <div class="fila-dato"><span>Fecha de entrega</span><span>${formatearFecha(p.fecha_entrega)}</span></div>
        <div class="fila-dato"><span>Modalidad</span><span>${esc(p.modalidad_entrega)}</span></div>
        <div class="fila-dato" style="align-items:flex-start"><span>Dirección</span><span style="text-align:right">${formatearDireccionCliente(p.direccion)}</span></div>
        <div class="fila-dato"><span>Observaciones</span><span>${esc(p.observacion || "—")}</span></div>
        <div class="fila-dato"><span>Estado</span><span class="estado ${CLASES_ESTADO[estado] || "e-nuevo"}">${esc(textoEstado(estado))}</span></div>
        <div class="fila-total"><span>Total</span><span class="monto">${formatearPrecio(p.total)}</span></div>
      </div>
      <a class="btn btn-dorado btn-bloque" href="mis-pedidos.html">Ir a mis pedidos</a>`;
  } catch (error) {
    console.error(error);
    zonaConfirmacion.innerHTML = '<p class="mensaje-estado error">No encontramos este pedido. <a href="mis-pedidos.html" style="text-decoration:underline">Ir a mis pedidos</a></p>';
  }
}
iniciar();