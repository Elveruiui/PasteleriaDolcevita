const { contenido } = montarPagina({
  activo: "inicio",
  titulo: "Panel de administración",
  subtitulo: "Resumen general, ventas, productos destacados y métricas por periodo.",
  reporte: "pedidos",
});

contenido.innerHTML = '<p class="mensaje-estado">Cargando resumen...</p>';

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

let todosLosPedidos = [];
let todosLosProductos = [];
let filtroPeriodo = "todo";
let fechaDesde = "";
let fechaHasta = "";

function isoLocal(fecha) {
  const f = new Date(fecha);
  f.setMinutes(f.getMinutes() - f.getTimezoneOffset());
  return f.toISOString().slice(0, 10);
}

function contar(pedidos, estado) {
  return pedidos.filter((p) => String(p.estado).toUpperCase() === estado).length;
}

function tarjeta(clase, icono, cifra, texto) {
  return '<div class="kpi"><span class="ic ' + clase + '"><i class="fa-solid ' + icono + '"></i></span><div><div class="num">' + cifra + "</div><small>" + texto + "</small></div></div>";
}

function filtrarPedidosPorFecha() {
  return todosLosPedidos.filter((p) => {
    const f = aFecha(p.fecha_pedido);
    if (!f) return !fechaDesde && !fechaHasta;
    const dia = isoLocal(f);
    if (fechaDesde && dia < fechaDesde) return false;
    if (fechaHasta && dia > fechaHasta) return false;
    return true;
  });
}

function pedidosPorDia(pedidos) {
  const dias = [];
  const base = fechaHasta ? new Date(fechaHasta + "T00:00:00") : new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    dias.push({ fecha: d, cantidad: 0 });
  }
  pedidos.forEach((p) => {
    const f = aFecha(p.fecha_pedido);
    if (!f) return;
    const dia = dias.find((x) => x.fecha.toDateString() === f.toDateString());
    if (dia) dia.cantidad++;
  });
  return dias;
}

function calcularTopProductos(pedidosVigentes) {
  const mapa = new Map();
  pedidosVigentes.forEach((p) => {
    (p.detalles || []).forEach((d) => {
      if (!d.producto) return;
      const tam = (d.producto.tamano || "MEDIANO").toUpperCase();
      const clave = d.producto.id_producto || (d.producto.nombre + "_" + tam);
      if (!mapa.has(clave)) {
        mapa.set(clave, {
          nombre: d.producto.nombre,
          tamano: tam,
          imagen: d.producto.imagen,
          unidades: 0,
          ingresos: 0,
        });
      }
      const item = mapa.get(clave);
      item.unidades += Number(d.cantidad || 0);
      item.ingresos += Number(d.subtotal || 0);
    });
  });
  return Array.from(mapa.values())
    .sort((a, b) => b.unidades - a.unidades || b.ingresos - a.ingresos)
    .slice(0, 5);
}

function calcularPorFormaPago(pedidosVigentes) {
  const grupos = [
    { codigo: "TARJETA", etiqueta: "Tarjeta (Crédito / Débito)", color: "var(--azul)", cantidad: 0, monto: 0 },
    { codigo: "YAPE_PLIN", etiqueta: "QR (Yape / Plin)", color: "var(--morado)", cantidad: 0, monto: 0 },
    { codigo: "CONTRA_ENTREGA", etiqueta: "Pago contra entrega", color: "var(--dorado)", cantidad: 0, monto: 0 },
  ];

  pedidosVigentes.forEach((p) => {
    const metodo = String(p.metodo_pago || "CONTRA_ENTREGA").toUpperCase();
    const destino = grupos.find((g) => g.codigo === metodo) || grupos[2];
    destino.cantidad += 1;
    destino.monto += Number(p.total || 0);
  });

  const totalVentas = grupos.reduce((s, g) => s + g.monto, 0);
  return { grupos, totalVentas };
}

function aplicarPreset(preset) {
  filtroPeriodo = preset;
  const hoy = new Date();
  if (preset === "todo") {
    fechaDesde = "";
    fechaHasta = "";
  } else if (preset === "hoy") {
    fechaDesde = isoLocal(hoy);
    fechaHasta = isoLocal(hoy);
  } else if (preset === "7d") {
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - 6);
    fechaDesde = isoLocal(inicio);
    fechaHasta = isoLocal(hoy);
  } else if (preset === "30d") {
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - 29);
    fechaDesde = isoLocal(inicio);
    fechaHasta = isoLocal(hoy);
  } else if (preset === "mes") {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    fechaDesde = isoLocal(inicio);
    fechaHasta = isoLocal(hoy);
  }
  dibujar();
}

function dibujar() {
  const pedidos = filtrarPedidosPorFecha();
  const vigentes = pedidos.filter((p) => String(p.estado).toUpperCase() !== "CANCELADO");
  const ventas = vigentes.reduce((suma, p) => suma + Number(p.total || 0), 0);
  const ticketPromedio = vigentes.length > 0 ? ventas / vigentes.length : 0;

  const dias = pedidosPorDia(pedidos);
  const maximo = Math.max(1, ...dias.map((d) => d.cantidad));
  const barras = dias.map((d) =>
    '<div style="height:' + Math.max(4, Math.round(d.cantidad / maximo * 100)) + '%" title="' + d.cantidad + ' pedidos"></div>').join("");
  const etiquetas = dias.map((d) => "<span>" + DIAS[d.fecha.getDay()] + "<br><b>" + d.cantidad + "</b></span>").join("");

  const delivery = pedidos.filter((p) => /delivery/i.test(p.modalidad_entrega || "")).length;
  const porcentaje = pedidos.length ? Math.round(delivery / pedidos.length * 100) : 0;

  const topProductos = calcularTopProductos(vigentes);
  const filasTop = topProductos.map((item) =>
    '<tr><td><div class="persona">' + imagenProducto(item.imagen) +
    '<span>' + esc(item.nombre) + ' <small style="display:inline;color:var(--dorado-oscuro)">(' + esc(item.tamano) + ')</small></span></div></td>' +
    '<td><strong>' + item.unidades + ' und.</strong></td>' +
    '<td>' + precio(item.ingresos) + "</td></tr>").join("");

  const { grupos: pagos, totalVentas } = calcularPorFormaPago(vigentes);
  const htmlPagos = pagos.map((g) => {
    const pct = totalVentas > 0 ? Math.round((g.monto / totalVentas) * 100) : 0;
    return '<div class="barra-pago">' +
      '<div class="barra-pago-cab"><span><strong>' + esc(g.etiqueta) + '</strong> <small class="ayuda">(' + g.cantidad + ' pedidos)</small></span>' +
      '<span><strong>' + precio(g.monto) + '</strong> · ' + pct + '%</span></div>' +
      '<div class="barra-pago-pista"><div class="barra-pago-relleno" style="width:' + pct + '%;background:' + g.color + '"></div></div>' +
      "</div>";
  }).join("");

  const recientes = pedidos.slice().sort((a, b) => b.id_pedido - a.id_pedido).slice(0, 5);
  const filasRecientes = recientes.map((p) =>
    '<tr><td><a href="pedido.html?id=' + p.id_pedido + '"><strong>' + codigoPedido(p.id_pedido) + "</strong></a></td><td>" +
    esc(nombreCompleto(p.usuario)) + "</td><td>" + precio(p.total) + "</td><td>" + insigniaEstadoPedido(p.estado, p.modalidad_entrega) + "</td></tr>").join("");

  const pocos = todosLosProductos.filter((p) => Number(p.estado) === 1 && p.stock <= 5).sort((a, b) => a.stock - b.stock).slice(0, 5);
  const filasStock = pocos.map((p) =>
    '<tr><td><div class="persona">' + imagenProducto(p.imagen) + "<span>" + esc(p.nombre) +
    ' <small style="display:inline;color:var(--dorado-oscuro)">(' + esc(p.tamano || "MEDIANO") + ')</small></span></div></td>' +
    '<td class="stock-bajo">' + p.stock + "</td></tr>").join("");

  const botonesPreset = [
    { id: "todo", texto: "Todo" },
    { id: "hoy", texto: "Hoy" },
    { id: "7d", texto: "Últimos 7 días" },
    { id: "30d", texto: "Últimos 30 días" },
    { id: "mes", texto: "Este mes" },
  ].map((b) => '<button type="button" class="pestana' + (filtroPeriodo === b.id ? " activo" : "") + '" data-preset="' + b.id + '">' + b.texto + "</button>").join("");

  contenido.innerHTML =
    '<div class="dash-filtros">' +
    '<div class="dash-rangos" id="dashPresets">' + botonesPreset + "</div>" +
    '<div class="dash-fechas">' +
    '<div><label for="d-desde">Desde</label><input type="date" id="d-desde" value="' + esc(fechaDesde) + '"></div>' +
    '<div><label for="d-hasta">Hasta</label><input type="date" id="d-hasta" value="' + esc(fechaHasta) + '"></div>' +
    "</div></div>" +
    '<div class="kpis seis">' +
    tarjeta("ic-ambar", "fa-cart-shopping", contar(pedidos, "PENDIENTE"), "Pendientes") +
    tarjeta("ic-azul", "fa-clipboard-check", contar(pedidos, "CONFIRMADO"), "Confirmados") +
    tarjeta("ic-morado", "fa-box-open", contar(pedidos, "LISTO"), "Listos") +
    tarjeta("ic-rosa", "fa-truck", contar(pedidos, "EN_CAMINO"), "En camino") +
    tarjeta("ic-verde", "fa-circle-check", contar(pedidos, "ENTREGADO"), "Entregados") +
    tarjeta("ic-rojo", "fa-circle-xmark", contar(pedidos, "CANCELADO"), "Cancelados") +
    "</div>" +
    '<div class="resumen-ventas">' +
    '<div><span>Ventas del periodo (sin cancelados)</span><br><small class="ayuda">' + vigentes.length + ' pedidos vigentes · Ticket promedio: ' + precio(ticketPromedio) + "</small></div>" +
    "<strong>" + precio(ventas) + "</strong></div>" +
    '<div class="graficos">' +
    '<section class="panel"><h3>Pedidos por día (ventana de 7 días)</h3><div class="barras">' + barras + '</div><div class="barras-etq">' + etiquetas + "</div></section>" +
    '<section class="panel"><h3>Modalidad de entrega</h3><div class="dona" style="background:conic-gradient(var(--dorado) 0 ' + porcentaje + '%, var(--rosa-claro) ' + porcentaje + '% 100%)"><span>' + porcentaje + '%<small>Delivery</small></span></div>' +
    '<div class="leyenda">Delivery ' + porcentaje + "% · Recojo en el local " + (pedidos.length ? 100 - porcentaje : 0) + "%</div></section></div>" +
    '<div class="rejilla-2">' +
    '<section class="panel"><h3>Top 5 productos y tamaños más vendidos</h3><div class="tabla-caja" style="box-shadow:none"><table class="tabla"><thead><tr><th>Producto / Tamaño</th><th>Vendidos</th><th>Ingresos</th></tr></thead><tbody>' +
    (filasTop || '<tr><td colspan="3" class="mensaje-tabla">No hay ventas registradas en este periodo.</td></tr>') + "</tbody></table></div></section>" +
    '<section class="panel"><h3>Ingresos por forma de pago</h3>' + htmlPagos + "</section></div>" +
    '<div class="rejilla-2">' +
    '<section class="panel"><h3>Últimos pedidos del periodo</h3><div class="tabla-caja" style="box-shadow:none"><table class="tabla"><thead><tr><th>Código</th><th>Cliente</th><th>Total</th><th>Estado</th></tr></thead><tbody>' +
    (filasRecientes || '<tr><td colspan="4" class="mensaje-tabla">No hay pedidos en este periodo.</td></tr>') + "</tbody></table></div></section>" +
    '<section class="panel"><h3>Productos con poco stock</h3><div class="tabla-caja" style="box-shadow:none"><table class="tabla"><thead><tr><th>Producto</th><th>Stock</th></tr></thead><tbody>' +
    (filasStock || '<tr><td colspan="2" class="mensaje-tabla">Todos los productos tienen stock suficiente.</td></tr>') + "</tbody></table></div></section></div>";

  document.getElementById("dashPresets").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-preset]");
    if (btn) aplicarPreset(btn.dataset.preset);
  });

  document.getElementById("d-desde").addEventListener("change", (e) => {
    fechaDesde = e.target.value;
    filtroPeriodo = "personalizado";
    dibujar();
  });

  document.getElementById("d-hasta").addEventListener("change", (e) => {
    fechaHasta = e.target.value;
    filtroPeriodo = "personalizado";
    dibujar();
  });
}

Promise.all([AdminApi.pedidos(), AdminApi.productos()])
  .then(([pedidos, productos]) => {
    todosLosPedidos = pedidos || [];
    todosLosProductos = productos || [];
    dibujar();
  })
  .catch((error) => {
    contenido.innerHTML = '<p class="mensaje-estado error">No se pudo cargar el resumen. ' + esc(error.message) + "</p>";
  });