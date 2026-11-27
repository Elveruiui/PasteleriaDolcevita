const ASIGNADA = 0;
const EN_CAMINO = 1;
const ENTREGADA = 2;
const INCIDENCIA = 3;

const TIPOS_INCIDENCIA = ["Cliente no se encontró", "Dirección incorrecta", "Problema con el pago", "Pedido dañado", "Otro"];

const panel = document.getElementById("panel");
const tarjetas = document.getElementById("tarjetas");
const toast = document.getElementById("toast");

let usuario = null;
let entregas = [];
let pestana = "activas";
let seleccion = null;
let vista = "lista";

function aFecha(valor) {
  if (!valor) return null;
  if (Array.isArray(valor)) {
    const [a, m, d, h = 0, min = 0] = valor;
    return new Date(a, m - 1, d, h, min);
  }
  const f = new Date(valor);
  return isNaN(f) ? null : f;
}

function fechaTexto(valor) {
  const f = aFecha(valor);
  if (!f) return "—";
  return f.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function horaTexto(valor) {
  const f = aFecha(valor);
  if (!f) return "—";
  return f.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

function codigo(id) {
  return "#DV-" + String(id).padStart(5, "0");
}

function nombreDe(persona) {
  return persona ? ((persona.nombre || "") + " " + (persona.apellido || "")).trim() : "—";
}

function imagen(nombre) {
  return nombre ? "/producto/imagenProducto?nombreImagen=" + encodeURIComponent(nombre) : "/img/placeholder.jpg";
}

function pedidoDe(e) {
  return e.pedido || {};
}

function pedidoListo(e) {
  return String(pedidoDe(e).estado || "").toUpperCase() === "LISTO";
}

function tipoEstado(e) {
  if (e.estado === EN_CAMINO) return { clase: "t-camino", texto: "En camino" };
  if (e.estado === ENTREGADA) return { clase: "t-entregada", texto: "Entregada" };
  if (e.estado === INCIDENCIA) return { clase: "t-incidencia", texto: "Con incidencia" };
  return pedidoListo(e) ? { clase: "t-lista", texto: "Lista para salir" } : { clase: "t-prep", texto: "En preparación" };
}

function insignia(e) {
  const t = tipoEstado(e);
  return '<span class="moto-estado ' + t.clase + '">' + t.texto + "</span>";
}

function mapaDe(dir) {
  if (!dir) return "#";
  const destino = dir.latitud && dir.longitud ? dir.latitud + "," + dir.longitud : dir.direccion || "";
  return "https://www.google.com/maps?q=" + encodeURIComponent(destino);
}

function avisar(texto, esError) {
  toast.textContent = texto;
  toast.classList.toggle("error", !!esError);
  toast.hidden = false;
  clearTimeout(avisar.temporizador);
  avisar.temporizador = setTimeout(() => { toast.hidden = true; }, 3200);
}

function activas() {
  return entregas.filter((e) => e.estado === ASIGNADA || e.estado === EN_CAMINO)
    .sort((a, b) => (aFecha(pedidoDe(a).fecha_entrega) || 0) - (aFecha(pedidoDe(b).fecha_entrega) || 0));
}

function historial() {
  return entregas.filter((e) => e.estado === ENTREGADA || e.estado === INCIDENCIA)
    .sort((a, b) => b.id_entrega - a.id_entrega);
}

function dibujarLista() {
  const lista = pestana === "activas" ? activas() : historial();
  document.querySelectorAll(".moto-tabs button").forEach((b) => b.classList.toggle("activo", b.dataset.tab === pestana));
  document.getElementById("fechaHoy").innerHTML = pestana === "activas"
    ? '<i class="fa-regular fa-calendar"></i> Hoy, ' + new Date().toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })
    : '<i class="fa-solid fa-clock-rotate-left"></i> Entregas finalizadas';
  if (lista.length === 0) {
    tarjetas.innerHTML = '<p class="moto-mensaje">' + (pestana === "activas"
      ? "No tienes entregas pendientes por ahora."
      : "Todavía no tienes entregas finalizadas.") + "</p>";
    return;
  }
  tarjetas.innerHTML = lista.map((e) => {
    const p = pedidoDe(e);
    const dir = p.direccion || {};
    return '<button type="button" class="moto-tarjeta ' + tipoEstado(e).clase + (seleccion === e.id_entrega ? " seleccionada" : "") + '" data-id="' + e.id_entrega + '">' +
      '<div class="fila"><strong>' + codigo(p.id_pedido) + "</strong>" + insignia(e) + "</div>" +
      "<small>" + fechaTexto(p.fecha_entrega) + " · " + horaTexto(p.fecha_entrega) + "</small>" +
      "<b>" + esc(nombreDe(p.usuario)) + "</b>" +
      "<small>" + esc(dir.direccion || "Sin dirección") + "</small>" +
      "</button>";
  }).join("");
}

function entregaActual() {
  return entregas.find((e) => e.id_entrega === seleccion) || null;
}

function cambiarVista(nueva) {
  vista = nueva;
  document.body.classList.toggle("ver-panel", nueva !== "lista");
  if (nueva === "lista") {
    seleccion = null;
    panel.innerHTML = '<div class="moto-vacio"><i class="fa-solid fa-motorcycle"></i><p>Selecciona una entrega para ver su detalle.</p></div>';
  } else if (nueva === "detalle") {
    dibujarDetalle();
  } else if (nueva === "estado") {
    dibujarEstado();
  } else if (nueva === "incidencia") {
    dibujarIncidencia();
  }
  dibujarLista();
  window.scrollTo(0, 0);
}

function dibujarDetalle() {
  const e = entregaActual();
  if (!e) return cambiarVista("lista");
  const p = pedidoDe(e);
  const dir = p.direccion || {};
  const cliente = p.usuario || {};
  const productos = (p.detalles || []).map((d) => {
    const prod = d.producto || {};
    return '<div class="moto-producto"><img src="' + imagen(prod.imagen) + '" alt="" onerror="this.onerror=null;this.src=\'/img/placeholder.jpg\'">' +
      "<div><span>" + esc(prod.nombre || "Producto") + (prod.tamano ? " (" + esc(prod.tamano) + ")" : "") + "</span>" +
      "<small>" + d.cantidad + (d.cantidad === 1 ? " unidad" : " unidades") + "</small></div></div>";
  }).join("");

  let accion = "";
  if (e.estado === ASIGNADA && pedidoListo(e)) {
    accion = '<button class="moto-boton" id="btnAccion"><i class="fa-solid fa-play"></i> Iniciar entrega</button>';
  } else if (e.estado === ASIGNADA) {
    accion = '<button class="moto-boton" disabled><i class="fa-solid fa-hourglass-half"></i> El pedido aún se está preparando</button>';
  } else if (e.estado === EN_CAMINO) {
    accion = '<button class="moto-boton" id="btnAccion"><i class="fa-solid fa-flag-checkered"></i> Actualizar estado</button>';
  }

  panel.innerHTML =
    '<div class="moto-cab"><h2>Pedido ' + codigo(p.id_pedido) + "</h2>" + insignia(e) + "</div>" +
    '<p class="moto-sub">Entrega: ' + fechaTexto(p.fecha_entrega) + " · " + horaTexto(p.fecha_entrega) + "</p>" +
    (e.estado === INCIDENCIA && e.observacion
      ? '<div class="moto-bloque moto-incidencia"><h3><i class="fa-solid fa-triangle-exclamation"></i> Incidencia registrada</h3><p>' + esc(e.observacion) + "</p></div>"
      : "") +
    '<div class="moto-bloque"><h3>Cliente</h3>' +
    '<div class="moto-dato"><span><i class="fa-solid fa-user"></i>' + esc(nombreDe(cliente)) + "</span></div>" +
    (cliente.telefono
      ? '<div class="moto-dato"><span><i class="fa-solid fa-phone"></i>' + esc(cliente.telefono) + '</span><a class="moto-btn-mini" href="tel:' + esc(cliente.telefono) + '"><i class="fa-solid fa-phone"></i> Llamar</a></div>'
      : "") +
    "</div>" +
    '<div class="moto-bloque"><h3>Dirección de entrega</h3>' +
    '<div class="moto-direccion">' + (dir.alias ? '<span class="moto-alias">' + esc(dir.alias) + "</span>" : "") + esc(dir.direccion || "—") +
    (dir.referencia ? "<small>Referencia: " + esc(dir.referencia) + "</small>" : "") + "</div>" +
    '<a class="moto-btn-borde" href="' + mapaDe(dir) + '" target="_blank" rel="noopener"><i class="fa-solid fa-map-location-dot"></i> Abrir en Google Maps</a>' +
    "</div>" +
    '<div class="moto-bloque"><h3>Productos</h3>' + (productos || '<p class="moto-sub">Sin productos.</p>') + "</div>" +
    (p.observacion ? '<div class="moto-bloque moto-notas"><h3>Notas del cliente</h3><p>' + esc(p.observacion) + "</p></div>" : "") +
    (function () {
      const m = String(p.metodo_pago || "CONTRA_ENTREGA").toUpperCase();
      const yaPagado = m === "TARJETA" || m === "YAPE_PLIN";
      if (yaPagado) {
        const nombreMetodo = m === "TARJETA" ? "Tarjeta" : "QR (Yape / Plin)";
        return '<div class="moto-bloque moto-cobro"><div><h3>Estado de pago</h3><small>Pagado online con ' + nombreMetodo + ' · Total ' + formatearPrecio(p.total || 0) + '</small></div>' +
          '<strong style="color:var(--verde)">PAGADO</strong></div>';
      }
      return '<div class="moto-bloque moto-cobro"><div><h3>Monto a cobrar</h3><small>Pago contra entrega' + (Number(p.costo_delivery) > 0 ? " · incluye delivery " + formatearPrecio(p.costo_delivery) : "") + "</small></div>" +
        "<strong>" + formatearPrecio(p.total || 0) + "</strong></div>";
    })() +
    "<strong>" + formatearPrecio(p.total || 0) + "</strong></div>" +
    (accion ? '<div class="moto-acciones">' + accion + "</div>" : "");

  const boton = document.getElementById("btnAccion");
  if (boton) boton.addEventListener("click", () => cambiarVista("estado"));
}

function dibujarEstado() {
  const e = entregaActual();
  if (!e) return cambiarVista("lista");
  const p = pedidoDe(e);
  const siguiente = e.estado === ASIGNADA ? EN_CAMINO : ENTREGADA;
  const nombreSiguiente = siguiente === EN_CAMINO ? "En camino" : "Entregado";
  const paso = (titulo, detalle, clase) =>
    '<li class="' + clase + '"><span class="moto-punto"></span><div><b>' + titulo + "</b>" + (detalle ? "<small>" + detalle + "</small>" : "") + "</div></li>";

  panel.innerHTML =
    '<div class="moto-cab"><h2>Actualizar estado</h2></div>' +
    '<p class="moto-sub">Pedido ' + codigo(p.id_pedido) + " · " + esc(nombreDe(p.usuario)) + "</p>" +
    '<div class="moto-bloque"><ol class="moto-linea">' +
    paso("Pedido asignado", fechaTexto(e.fecha_asignacion) + " · " + horaTexto(e.fecha_asignacion), "hecho") +
    paso("En camino", siguiente === EN_CAMINO ? 'Estás a punto de marcar el pedido como "En camino".' : "", siguiente === EN_CAMINO ? "actual" : "hecho") +
    paso("Entregado", siguiente === ENTREGADA ? 'Estás a punto de marcar el pedido como "Entregado".' : "", siguiente === ENTREGADA ? "actual" : "") +
    "</ol></div>" +
    '<div class="moto-bloque moto-campo"><label for="obs">Observación (opcional)</label>' +
    '<textarea id="obs" maxlength="200" placeholder="' + (siguiente === EN_CAMINO ? "Ej. Me dirijo a la dirección del cliente." : "Ej. Recibido por el cliente.") + '"></textarea>' +
    '<span class="moto-contador" id="contador">0/200</span>' +
    '<div class="moto-error" id="errorEstado" hidden></div></div>' +
    '<div class="moto-acciones">' +
    '<button class="moto-boton" id="btnConfirmar"><i class="fa-solid fa-check"></i> Confirmar "' + nombreSiguiente + '"</button>' +
    '<button class="moto-boton rojo" id="btnIncidencia"><i class="fa-solid fa-triangle-exclamation"></i> Registrar incidencia</button>' +
    "</div>";

  const obs = document.getElementById("obs");
  obs.addEventListener("input", () => { document.getElementById("contador").textContent = obs.value.length + "/200"; });
  document.getElementById("btnIncidencia").addEventListener("click", () => cambiarVista("incidencia"));
  document.getElementById("btnConfirmar").addEventListener("click", async (ev) => {
    const boton = ev.currentTarget;
    const error = document.getElementById("errorEstado");
    error.hidden = true;
    boton.disabled = true;
    try {
      await enviar("/entrega/cambiarEstado/" + e.id_entrega, "PUT", { estado: siguiente, observacion: obs.value.trim() || null });
      await cargarEntregas();
      if (siguiente === ENTREGADA) {
        dibujarExito(e.id_entrega);
      } else {
        avisar("Entrega en camino. ¡Buen viaje!");
        cambiarVista("detalle");
      }
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
      boton.disabled = false;
    }
  });
}

function dibujarExito(idEntrega) {
  vista = "exito";
  const e = entregas.find((x) => x.id_entrega === idEntrega);
  const p = e ? pedidoDe(e) : {};
  const dir = p.direccion || {};
  const proxima = activas()[0];
  panel.innerHTML =
    '<div class="moto-exito"><div class="check"><i class="fa-solid fa-check"></i></div>' +
    "<h2>¡Entrega realizada con éxito!</h2>" +
    "<p><strong>Pedido " + codigo(p.id_pedido) + "</strong></p>" +
    '<div class="moto-bloque">' +
    '<div class="moto-dato"><span><i class="fa-solid fa-user"></i>' + esc(nombreDe(p.usuario)) + "</span></div>" +
    '<div class="moto-dato"><span><i class="fa-solid fa-location-dot"></i>' + esc(dir.direccion || "—") + "</span></div>" +
    '<div class="moto-dato"><span><i class="fa-regular fa-calendar"></i>' + fechaTexto(e && e.fecha_entrega) + " · " + horaTexto(e && e.fecha_entrega) + "</span></div>" +
    "</div></div>" +
    '<div class="moto-acciones">' +
    (proxima ? '<button class="moto-boton borde" id="btnSiguiente">Ver siguiente entrega</button>' : "") +
    '<button class="moto-boton" id="btnVolverLista">Volver a mis entregas</button>' +
    "</div>";
  dibujarLista();
  if (proxima) {
    document.getElementById("btnSiguiente").addEventListener("click", () => {
      seleccion = proxima.id_entrega;
      cambiarVista("detalle");
    });
  }
  document.getElementById("btnVolverLista").addEventListener("click", () => cambiarVista("lista"));
}

function dibujarIncidencia() {
  const e = entregaActual();
  if (!e) return cambiarVista("lista");
  const p = pedidoDe(e);
  panel.innerHTML =
    '<div class="moto-cab"><h2>Registrar incidencia</h2></div>' +
    '<p class="moto-sub">Pedido ' + codigo(p.id_pedido) + " · " + esc(nombreDe(p.usuario)) + "</p>" +
    '<div class="moto-bloque moto-campo"><label>Tipo de incidencia</label><div class="moto-opciones">' +
    TIPOS_INCIDENCIA.map((t, i) => '<label><input type="radio" name="tipo" value="' + esc(t) + '"' + (i === 0 ? " checked" : "") + "> " + esc(t) + "</label>").join("") +
    "</div>" +
    '<label for="desc">Descripción</label>' +
    '<textarea id="desc" maxlength="200" placeholder="Describe lo ocurrido..."></textarea>' +
    '<span class="moto-contador" id="contadorDesc">0/200</span>' +
    '<div class="moto-error" id="errorIncidencia" hidden></div></div>' +
    '<div class="moto-acciones">' +
    '<button class="moto-boton" id="btnEnviarIncidencia"><i class="fa-solid fa-paper-plane"></i> Enviar incidencia</button>' +
    '<button class="moto-boton borde" id="btnCancelarIncidencia">Volver</button>' +
    "</div>";

  const desc = document.getElementById("desc");
  desc.addEventListener("input", () => { document.getElementById("contadorDesc").textContent = desc.value.length + "/200"; });
  document.getElementById("btnCancelarIncidencia").addEventListener("click", () => cambiarVista("estado"));
  document.getElementById("btnEnviarIncidencia").addEventListener("click", async (ev) => {
    const boton = ev.currentTarget;
    const error = document.getElementById("errorIncidencia");
    const tipo = document.querySelector("input[name=tipo]:checked").value;
    const texto = desc.value.trim();
    error.hidden = true;
    if (tipo === "Otro" && !texto) {
      error.textContent = "Describe lo ocurrido.";
      error.hidden = false;
      return;
    }
    boton.disabled = true;
    try {
      await enviar("/entrega/cambiarEstado/" + e.id_entrega, "PUT", {
        estado: INCIDENCIA,
        observacion: (tipo + (texto ? ": " + texto : "")).slice(0, 200),
      });
      await cargarEntregas();
      avisar("Incidencia registrada. El administrador será informado.");
      cambiarVista("detalle");
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
      boton.disabled = false;
    }
  });
}

async function cargarEntregas() {
  entregas = (await pedir("/entrega/listarPorMotorizado/" + usuario.id_usuario)) || [];
}

function volver() {
  if (vista === "estado" || vista === "incidencia") cambiarVista(vista === "incidencia" ? "estado" : "detalle");
  else cambiarVista("lista");
}

tarjetas.addEventListener("click", (ev) => {
  const tarjeta = ev.target.closest("[data-id]");
  if (!tarjeta) return;
  seleccion = Number(tarjeta.dataset.id);
  cambiarVista("detalle");
});

document.querySelectorAll(".moto-tabs button").forEach((b) =>
  b.addEventListener("click", () => {
    pestana = b.dataset.tab;
    dibujarLista();
  }));

document.getElementById("btnVolver").addEventListener("click", volver);

document.getElementById("btnSalir").addEventListener("click", async () => {
  try {
    await Api.logout();
  } catch (e) {}
  Sesion.guardarCache(null);
  location.href = "../login.html";
});

async function iniciar() {
  usuario = await Sesion.obtener();
  if (!usuario) {
    location.href = "../login.html";
    return;
  }
  if (!Sesion.rolDe(usuario).includes("MOTOR")) {
    location.href = "../index.html";
    return;
  }
  document.getElementById("saludo").innerHTML = "Hola, <strong>" + esc(nombreDe(usuario)) + "</strong>";
  try {
    await cargarEntregas();
    dibujarLista();
  } catch (err) {
    tarjetas.innerHTML = '<p class="moto-mensaje">No se pudieron cargar tus entregas. ' + esc(err.message) + "</p>";
  }
}

iniciar();
