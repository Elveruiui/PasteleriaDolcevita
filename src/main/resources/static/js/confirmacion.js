const zonaConfirmacion = document.getElementById("zonaConfirmacion");
const parametros = new URLSearchParams(location.search);
const idPedido = parametros.get("id");
const esNuevo = parametros.get("nuevo") === "1";

const CLASES_ESTADO = {
  PENDIENTE: "e-pendiente", CONFIRMADO: "e-confirmado", LISTO: "e-listo", EN_CAMINO: "e-camino",
  ENTREGADO: "e-entregado", CANCELADO: "e-cancelado",
};

function esRecojo(modalidad) {
  return String(modalidad || "").toLowerCase().includes("recojo");
}

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

function textoEstado(estado, modalidad) {
  if (estado === "LISTO" && esRecojo(modalidad)) return "Listo para recojo";
  const t = String(estado || "").replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function etiquetaMetodoPago(metodo) {
  const m = String(metodo || "CONTRA_ENTREGA").toUpperCase();
  if (m === "TARJETA") return '<span class="estado e-entregado">Tarjeta · Pagado</span>';
  if (m === "YAPE_PLIN") return '<span class="estado e-entregado">QR (Yape / Plin) · Pagado</span>';
  return "Pago contra entrega";
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

function dibujarLineaSeguimiento(p, entrega) {
  const estadoActual = String(p.estado || "").toUpperCase();
  const pasos = esRecojo(p.modalidad_entrega)
    ? ["PENDIENTE", "CONFIRMADO", "LISTO", "ENTREGADO"]
    : ["PENDIENTE", "CONFIRMADO", "LISTO", "EN_CAMINO", "ENTREGADO"];

  const cancelado = estadoActual === "CANCELADO";
  const completo = estadoActual === "ENTREGADO";
  const posicion = pasos.indexOf(estadoActual);

  const items = pasos.map((e, i) => {
    const hecho = !cancelado && (i < posicion || (completo && i === posicion));
    const actual = !cancelado && !completo && i === posicion;
    const clase = hecho ? " hecho" : actual ? " actual" : "";
    const punto = hecho ? '<i class="fa-solid fa-check"></i>' : String(i + 1);
    return `<li class="paso-seg${clase}"><span class="punto">${punto}</span><span class="etq">${esc(textoEstado(e, p.modalidad_entrega))}</span></li>`;
  }).join("");

  const infoMotorizado = entrega && entrega.motorizado && !cancelado
    ? `<div style="margin-top:1rem;padding:.75rem 1rem;border-radius:12px;background:var(--crema-oscuro);display:flex;align-items:center;justify-content:space-between;gap:.8rem;flex-wrap:wrap;font-size:.86rem">
         <span><i class="fa-solid fa-motorcycle" style="color:var(--vino);margin-right:.4rem"></i> Repartidor asignado: <strong>${esc(entrega.motorizado)}</strong></span>
         ${entrega.telefono ? `<a href="tel:${esc(entrega.telefono)}" style="color:var(--dorado-oscuro);font-weight:600"><i class="fa-solid fa-phone"></i> ${esc(entrega.telefono)}</a>` : ""}
       </div>`
    : "";

  return `
    <div class="panel">
      <h3>Seguimiento de tu pedido</h3>
      ${cancelado ? '<p class="ayuda" style="color:var(--rojo);font-weight:600">Este pedido fue cancelado.</p>' : ""}
      <ol class="seguimiento${cancelado ? " cancelado" : ""}">${items}</ol>
      ${infoMotorizado}
    </div>`;
}

async function iniciar() {
  if (!idPedido) {
    zonaConfirmacion.innerHTML = '<p class="mensaje-estado">No se indicó qué pedido mostrar. <a href="mis-pedidos.html" style="text-decoration:underline">Ir a mis pedidos</a></p>';
    return;
  }
  try {
    const [p, entrega] = await Promise.all([
      Api.pedido(idPedido),
      Api.entregaDePedido(idPedido).catch(() => null),
    ]);

    const productosHtml = (p.detalles || []).map((d) => {
      const nombre = d.producto ? esc(d.producto.nombre) : "Producto";
      const tamano = d.producto && d.producto.tamano
        ? ` <span class="estado e-confirmado" style="font-size:.75rem;padding:2px 8px">${esc(d.producto.tamano)}</span>`
        : "";
      return `<div style="margin-bottom:4px">${nombre}${tamano} <strong>× ${d.cantidad}</strong> (${formatearPrecio(d.subtotal)})</div>`;
    }).join("");

    const estado = String(p.estado || "").toUpperCase();
    const esPendiente = estado === "PENDIENTE";
    const cabecera = esNuevo
      ? '<div class="check"><i class="fa-solid fa-check"></i></div><h1>¡Pedido registrado con éxito!</h1><p class="ayuda">Tu pedido ha sido registrado correctamente.</p>'
      : "<h1>Detalle de tu pedido</h1>";

    zonaConfirmacion.innerHTML = `
      ${cabecera}
      <p style="margin-top:.6rem"><strong>Número de pedido: #DV-${String(p.id_pedido).padStart(5, "0")}</strong></p>
      ${dibujarLineaSeguimiento(p, entrega)}
      <div class="panel"><h3>Detalles del pedido</h3>
        <div class="fila-dato" style="align-items:flex-start"><span>Productos</span><span style="text-align:right">${productosHtml || "—"}</span></div>
        <div class="fila-dato"><span>Fecha de entrega</span><span>${formatearFecha(p.fecha_entrega)}</span></div>
        <div class="fila-dato"><span>Modalidad</span><span>${esc(p.modalidad_entrega)}</span></div>
        <div class="fila-dato"><span>Forma de pago</span><span>${etiquetaMetodoPago(p.metodo_pago)}</span></div>
        <div class="fila-dato" style="align-items:flex-start"><span>Dirección</span><span style="text-align:right">${formatearDireccionCliente(p.direccion)}</span></div>
        <div class="fila-dato"><span>Observaciones</span><span>${esc(p.observacion || "—")}</span></div>
        <div class="fila-dato"><span>Estado</span><span class="estado ${CLASES_ESTADO[estado] || "e-nuevo"}">${esc(textoEstado(estado, p.modalidad_entrega))}</span></div>
        ${Number(p.costo_delivery) > 0 ? `<div class="fila-dato"><span>Subtotal productos</span><span>${formatearPrecio(Number(p.total) - Number(p.costo_delivery))}</span></div><div class="fila-dato"><span>Delivery</span><span>${formatearPrecio(p.costo_delivery)}</span></div>` : ""}
        <div class="fila-total"><span>Total</span><span class="monto">${formatearPrecio(p.total)}</span></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:.6rem">
        <a class="btn btn-borde btn-bloque" href="/pedido/comprobante/${p.id_pedido}">
          <i class="fa-solid fa-file-pdf"></i> Descargar boleta PDF
        </a>
        ${esPendiente ? `<button type="button" class="btn btn-peligro btn-bloque" id="btnCancelarPedido"><i class="fa-solid fa-ban"></i> Cancelar pedido</button>` : ""}
        <a class="btn btn-dorado btn-bloque" href="mis-pedidos.html">Ir a mis pedidos</a>
      </div>`;

    const btnCancelar = document.getElementById("btnCancelarPedido");
    if (btnCancelar) {
      btnCancelar.addEventListener("click", async () => {
        if (!confirm("¿Seguro que deseas cancelar este pedido? El stock se devolverá y no podrás reactivarlo.")) return;
        btnCancelar.disabled = true;
        try {
          await Api.cancelarPedidoCliente(p.id_pedido);
          await iniciar();
        } catch (err) {
          alert(err.message || "No se pudo cancelar el pedido.");
          btnCancelar.disabled = false;
        }
      });
    }
  } catch (error) {
    console.error(error);
    zonaConfirmacion.innerHTML = '<p class="mensaje-estado error">No encontramos este pedido. <a href="mis-pedidos.html" style="text-decoration:underline">Ir a mis pedidos</a></p>';
  }
}
iniciar();