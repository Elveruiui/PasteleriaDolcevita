const { contenido, botonPrincipal } = montarPagina({
  activo: "entregas",
  titulo: "Entregas",
  subtitulo: "Asigna un motorizado a los pedidos de delivery y sigue su avance.",
  reporte: "entregas",
});

let entregas = [];
let pedidos = [];
let usuarios = [];
let usuarioActual = null;
let esMotorizado = false;

contenido.innerHTML =
  '<section id="zona-por-asignar" style="margin-bottom:2rem" hidden><h3 style="margin-bottom:.8rem">Pedidos delivery por asignar</h3>' +
  '<div class="tabla-caja"><table class="tabla"><thead><tr><th>Pedido</th><th>Cliente</th><th>Dirección / Mapa</th><th>Entrega</th><th>Estado</th><th>Motorizado</th><th>Acciones</th></tr></thead>' +
  '<tbody id="filas-por-asignar"></tbody></table></div></section>' +
  '<h3 style="margin-bottom:.8rem">Entregas asignadas</h3>' +
  '<div class="tabla-caja"><table class="tabla"><thead><tr><th>Pedido</th><th>Cliente</th><th>Dirección / Mapa</th><th>Motorizado</th><th>Asignada</th><th>Estado</th><th style="text-align:center">Acciones</th></tr></thead>' +
  '<tbody id="filas"></tbody></table></div>';
const filas = document.getElementById("filas");
const filasPorAsignar = document.getElementById("filas-por-asignar");

const CLASES_ENTREGA = ["e-pendiente", "e-camino", "e-entregado", "e-cancelado"];

function motorizados() {
  return usuarios.filter((u) => u.rol && /motor/i.test(u.rol.nombre_rol) && Number(u.estado) === 1);
}

function celdaDireccionEntrega(dir) {
  if (!dir) return "—";
  const alias = dir.alias ? `<strong>[${esc(dir.alias)}]</strong> ` : "";
  const ref = dir.referencia ? `<br><small class="ayuda">Ref: ${esc(dir.referencia)}</small>` : "";
  const btnMapa = (dir.latitud && dir.longitud)
    ? `<br><a href="https://www.google.com/maps?q=${dir.latitud},${dir.longitud}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;margin-top:4px;color:var(--dorado-oscuro);font-weight:600;font-size:.82rem;text-decoration:underline">
         <i class="fa-solid fa-map-location-dot"></i> Abrir en Google Maps
       </a>`
    : "";
  return alias + esc(dir.direccion) + ref + btnMapa;
}

function pedidosPorAsignar() {
  const ocupados = entregas.map((e) => e.pedido && e.pedido.id_pedido);
  return pedidos.filter((p) =>
    /delivery/i.test(p.modalidad_entrega || "") && !ocupados.includes(p.id_pedido) &&
    !["CANCELADO", "ENTREGADO"].includes(String(p.estado).toUpperCase()))
    .sort((a, b) => a.id_pedido - b.id_pedido);
}

function dibujarPorAsignar() {
  const zona = document.getElementById("zona-por-asignar");
  if (esMotorizado) {
    zona.hidden = true;
    return;
  }
  zona.hidden = false;
  const lista = pedidosPorAsignar();
  if (lista.length === 0) {
    filasPorAsignar.innerHTML = '<tr><td colspan="7" class="mensaje-tabla">No hay pedidos de delivery pendientes de asignar.</td></tr>';
    return;
  }
  const opcionesMoto = '<option value="">Elige un motorizado</option>' +
    motorizados().map((m) => '<option value="' + m.id_usuario + '">' + esc(nombreCompleto(m)) + "</option>").join("");
  filasPorAsignar.innerHTML = lista.map((p) =>
    "<tr><td><strong>" + codigoPedido(p.id_pedido) + "</strong></td>" +
    "<td>" + esc(nombreCompleto(p.usuario)) + "</td>" +
    "<td>" + celdaDireccionEntrega(p.direccion) + "</td>" +
    "<td>" + fechaHora(p.fecha_entrega) + "</td>" +
    "<td>" + insigniaEstadoPedido(p.estado, p.modalidad_entrega) + "</td>" +
    '<td><select class="sel-moto">' + opcionesMoto + "</select></td>" +
    '<td><button class="btn btn-dorado btn-sm" data-asignar="' + p.id_pedido + '">Asignar</button></td></tr>').join("");
}

async function asignarRapido(boton) {
  const fila = boton.closest("tr");
  const idPedido = Number(boton.dataset.asignar);
  const idMotorizado = fila.querySelector(".sel-moto").value;
  if (!idMotorizado) {
    avisar("Elige un motorizado para el pedido " + codigoPedido(idPedido) + ".", true);
    return;
  }
  boton.disabled = true;
  try {
    await AdminApi.crearEntrega({
      pedido: { id_pedido: idPedido },
      motorizado: { id_usuario: Number(idMotorizado) },
      estado: 0,
      observacion: "",
    });
    avisar("Motorizado asignado al pedido " + codigoPedido(idPedido) + ".");
    await cargar();
  } catch (error) {
    boton.disabled = false;
    avisar("No se pudo asignar el motorizado. " + error.message, true);
  }
}

function dibujar() {
  if (entregas.length === 0) {
    const mensajeVacio = esMotorizado
      ? "No tienes entregas asignadas por el momento."
      : "Todavía no hay entregas asignadas.";
    filas.innerHTML = '<tr><td colspan="7" class="mensaje-tabla">' + mensajeVacio + "</td></tr>";
    return;
  }
  filas.innerHTML = entregas.slice().sort((a, b) => b.id_entrega - a.id_entrega).map((e) => {
    const pedido = e.pedido || {};
    const botonEliminar = esMotorizado
      ? ""
      : '<button class="ic-btn rojo" data-eliminar="' + e.id_entrega + '" title="Eliminar"><i class="fa-solid fa-trash"></i></button>';

    return "<tr><td><strong>" + codigoPedido(pedido.id_pedido) + "</strong></td>" +
      "<td>" + esc(nombreCompleto(pedido.usuario)) + "</td>" +
      "<td>" + celdaDireccionEntrega(pedido.direccion) + "</td>" +
      "<td>" + esc(nombreCompleto(e.motorizado)) + "</td>" +
      '<td style="white-space:nowrap">' + fechaHora(e.fecha_asignacion).replace(" · ", "<br>") + "</td>" +
      '<td><span class="estado ' + (CLASES_ENTREGA[e.estado] || "e-nuevo") + '">' + (ESTADOS_ENTREGA[e.estado] || "—") + "</span></td>" +
      '<td><div class="acciones" style="justify-content:center">' +
      (esMotorizado ? '<button class="ic-btn" data-editar="' + e.id_entrega + '" title="Actualizar entrega"><i class="fa-solid fa-pen"></i></button>' : "") +
      botonEliminar +
      "</div></td></tr>";
  }).join("");
}

async function cargar() {
  mostrarCargando(filas, 7);
  try {
    if (!usuarioActual) {
      usuarioActual = await llamar("/auth/me", "GET");
      const nombreRol = usuarioActual && usuarioActual.rol ? usuarioActual.rol.nombre_rol : "";
      esMotorizado = /motor/i.test(nombreRol);

      if (esMotorizado) {
        if (botonPrincipal) botonPrincipal.style.display = "none";
        const subtitulo = document.querySelector(".cab-pag p");
        if (subtitulo) subtitulo.textContent = "Consulta tus entregas asignadas y actualiza su estado.";
      }
    }

    if (esMotorizado) {
      entregas = await llamar("/entrega/listarPorMotorizado/" + usuarioActual.id_usuario, "GET");
    } else {
      [entregas, pedidos, usuarios] = await Promise.all([
        AdminApi.entregas(),
        AdminApi.pedidos(),
        AdminApi.usuarios(),
      ]);
    }
    dibujarPorAsignar();
    dibujar();
  } catch (error) {
    mostrarErrorTabla(filas, 7, error);
  }
}

async function sincronizarPedido(pedidoObj, estadoEntrega) {
  const nuevo = { 1: "EN_CAMINO", 2: "ENTREGADO" }[estadoEntrega];
  if (!nuevo || !pedidoObj || !pedidoObj.id_pedido) return;
  const estadoActual = String(pedidoObj.estado || "").toUpperCase();
  if (estadoActual === "CANCELADO" || estadoActual === nuevo) return;
  try {
    await AdminApi.cambiarEstadoPedido(pedidoObj.id_pedido, nuevo);
  } catch (error) {
    avisar("La entrega se guardó, pero no se pudo actualizar el estado del pedido.", true);
  }
}

function abrirFormulario(entrega) {
  const esNueva = !entrega;
  if (esNueva && esMotorizado) return;

  const ocupados = entregas.map((e) => e.pedido && e.pedido.id_pedido);
  const disponibles = pedidos.filter((p) =>
    /delivery/i.test(p.modalidad_entrega || "") && !ocupados.includes(p.id_pedido) &&
    !["CANCELADO", "ENTREGADO"].includes(String(p.estado).toUpperCase()));

  if (esNueva && disponibles.length === 0) {
    avisar("No hay pedidos de Delivery pendientes de asignar.", true);
    return;
  }

  const e = entrega || { motorizado: null, estado: 0, costo_delivery: "", observacion: "" };
  const campoPedido = esNueva
    ? '<label for="m-pedido">Pedido</label><select id="m-pedido"><option value="">Elige un pedido</option>' +
      disponibles.map((p) => '<option value="' + p.id_pedido + '">' + codigoPedido(p.id_pedido) + " · " + esc(nombreCompleto(p.usuario)) + "</option>").join("") + "</select>"
    : '<label>Pedido</label><input type="text" value="' + codigoPedido(e.pedido.id_pedido) + '" disabled>';

  const campoMotorizado = esMotorizado
    ? '<label>Motorizado</label><input type="text" value="' + esc(nombreCompleto(e.motorizado)) + '" disabled>'
    : '<label for="m-motorizado">Motorizado</label><select id="m-motorizado"><option value="">Elige un motorizado</option>' +
      motorizados().map((m) => '<option value="' + m.id_usuario + '"' + (e.motorizado && e.motorizado.id_usuario === m.id_usuario ? " selected" : "") + ">" + esc(nombreCompleto(m)) + "</option>").join("") + "</select>";

  const atributoCosto = " disabled";

  abrirModal(esNueva ? "Asignar entrega" : (esMotorizado ? "Actualizar estado de entrega" : "Editar entrega"),
    campoPedido +
    campoMotorizado +
    '<div class="dos-campos"><div><label for="m-costo">Costo de delivery (S/)</label><input type="number" id="m-costo" step="0.01" min="0" value="' + esc(e.costo_delivery) + '"' + atributoCosto + '></div>' +
    '<div><label for="m-estado">Estado</label><select id="m-estado">' +
    ESTADOS_ENTREGA.map((t, i) => '<option value="' + i + '"' + (e.estado === i ? " selected" : "") + (!esMotorizado && (i === 1 || i === 2) && e.estado !== i ? " disabled" : "") + ">" + t + "</option>").join("") + "</select></div></div>" +
    '<label for="m-obs">Observación</label><textarea id="m-obs" maxlength="300">' + esc(e.observacion) + "</textarea>" +
    '<p class="ayuda-campo">' + (esMotorizado
      ? 'Al marcar la entrega como "En camino" o "Entregada", el pedido cambia de estado automáticamente.'
      : 'Los estados "En camino" y "Entregada" solo los puede marcar el motorizado.') + "</p>",
    async (f) => {
      const idPedido = esNueva ? Number(f.querySelector("#m-pedido").value) : e.pedido.id_pedido;
      const idMotorizado = esMotorizado
        ? (e.motorizado && e.motorizado.id_usuario)
        : f.querySelector("#m-motorizado").value;
      const costo = e.costo_delivery == null ? 0 : e.costo_delivery;
      const estado = Number(f.querySelector("#m-estado").value);

      if (!idPedido) throw new Error("Elige un pedido.");
      if (!idMotorizado) throw new Error("Elige un motorizado.");
      if (costo === "" || Number(costo) < 0) throw new Error("Escribe el costo de delivery (puede ser 0).");

      const pedidoActual = esNueva
        ? pedidos.find((p) => p.id_pedido === idPedido)
        : e.pedido;

      const datos = {
        pedido: { id_pedido: idPedido },
        motorizado: { id_usuario: Number(idMotorizado) },
        estado,
        costo_delivery: Number(costo),
        observacion: f.querySelector("#m-obs").value.trim(),
        fecha_entrega: estado === 2 ? fechaParaBackend(new Date()) : (e.fecha_entrega || null),
      };
      if (esNueva) await AdminApi.crearEntrega(datos);
      else await AdminApi.actualizarEntrega(e.id_entrega, datos);
      await sincronizarPedido(pedidoActual, estado);
      avisar(esNueva ? "Entrega asignada." : "Entrega actualizada.");
      await cargar();
    });
}

async function eliminar(id) {
  if (esMotorizado) return;
  const entrega = entregas.find((x) => x.id_entrega === id);
  const seguro = await confirmar("Eliminar entrega",
    "¿Quitar la entrega del pedido " + codigoPedido(entrega.pedido.id_pedido) + "? El pedido no se elimina.", "Eliminar");
  if (!seguro) return;
  try {
    await AdminApi.eliminarEntrega(id);
    avisar("Entrega eliminada.");
    await cargar();
  } catch (error) {
    avisar("No se pudo eliminar la entrega. " + error.message, true);
  }
}

filasPorAsignar.addEventListener("click", (ev) => {
  const boton = ev.target.closest("[data-asignar]");
  if (boton) asignarRapido(boton);
});

filas.addEventListener("click", (ev) => {
  const editar = ev.target.closest("[data-editar]");
  const borrar = ev.target.closest("[data-eliminar]");
  if (editar && esMotorizado) abrirFormulario(entregas.find((x) => x.id_entrega === Number(editar.dataset.editar)));
  if (borrar && !esMotorizado) eliminar(Number(borrar.dataset.eliminar));
});
if (botonPrincipal) {
  botonPrincipal.addEventListener("click", () => abrirFormulario(null));
}

cargar();