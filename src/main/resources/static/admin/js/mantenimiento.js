const { contenido } = montarPagina({
  activo: "mantenimiento",
  titulo: "Mantenimiento",
  subtitulo: "Tareas programadas, backups de la base de datos y revisiones del sistema.",
});

const DIAS_SEMANA = { SUN: "domingo", MON: "lunes", TUE: "martes", WED: "miércoles", THU: "jueves", FRI: "viernes", SAT: "sábado" };

contenido.innerHTML =
  '<div class="mant-acciones">' +
  '<button class="btn btn-dorado" id="btn-backup"><i class="fa-solid fa-database"></i> Hacer backup ahora</button>' +
  '<button class="btn btn-borde" id="btn-revision"><i class="fa-solid fa-clipboard-check"></i> Ejecutar revisión</button>' +
  '<button class="btn btn-borde" id="btn-limpieza"><i class="fa-solid fa-broom"></i> Limpiar backups antiguos</button>' +
  "</div>" +
  '<div id="mant-resultado"></div>' +
  '<h3 class="mon-titulo">Tareas programadas (cron jobs)</h3>' +
  '<div class="tabla-caja"><table class="tabla"><thead><tr><th>Tarea</th><th>Programación</th><th>Próxima ejecución</th><th>Última ejecución</th><th>Resultado</th></tr></thead><tbody id="mant-tareas"></tbody></table></div>' +
  '<h3 class="mon-titulo">Backups de la base de datos</h3>' +
  '<p class="mant-carpeta" id="mant-carpeta"></p>' +
  '<div class="tabla-caja"><table class="tabla"><thead><tr><th>Archivo</th><th>Fecha</th><th>Tamaño</th><th style="text-align:center">Acciones</th></tr></thead><tbody id="mant-backups"></tbody></table></div>';

const filasTareas = document.getElementById("mant-tareas");
const filasBackups = document.getElementById("mant-backups");
const zonaResultado = document.getElementById("mant-resultado");

function cronLegible(cron) {
  const partes = String(cron || "").trim().split(/\s+/);
  if (partes.length !== 6) return cron;
  const [, minuto, hora, diaMes, mes, diaSemana] = partes;
  if (hora === "*" && diaMes === "*" && mes === "*" && diaSemana === "*") return "Cada hora, al minuto " + String(minuto).padStart(2, "0");
  const horaTexto = String(hora).padStart(2, "0") + ":" + String(minuto).padStart(2, "0");
  if (diaMes === "*" && mes === "*" && diaSemana === "*") return "Todos los días a las " + horaTexto;
  if (diaMes === "*" && mes === "*" && DIAS_SEMANA[diaSemana.toUpperCase()]) return "Cada " + DIAS_SEMANA[diaSemana.toUpperCase()] + " a las " + horaTexto;
  return cron;
}

function insigniaResultado(tarea) {
  if (tarea.exito == null) return '<span class="estado e-nuevo">Aún no se ejecuta</span>';
  const aviso = tarea.id === "revision";
  const clase = tarea.exito ? "e-entregado" : aviso ? "e-pendiente" : "e-cancelado";
  const texto = tarea.exito ? "Correcto" : aviso ? "Con avisos" : "Con error";
  return '<span class="estado ' + clase + '">' + texto + "</span>" +
    '<small class="mant-detalle">' + esc(tarea.resultado || "") + "</small>";
}

async function cargar() {
  mostrarCargando(filasTareas, 5);
  mostrarCargando(filasBackups, 4);
  try {
    const estado = await llamar("/mantenimiento/estado", "GET");
    filasTareas.innerHTML = estado.tareas.map((t) =>
      "<tr><td><strong>" + esc(t.nombre) + "</strong><small class=\"mant-detalle\">" + esc(t.descripcion) + "</small></td>" +
      "<td>" + esc(cronLegible(t.cron)) + '<small class="mant-detalle"><code>' + esc(t.cron) + "</code></small></td>" +
      "<td>" + fechaHora(t.proxima) + "</td>" +
      "<td>" + (t.ultima ? fechaHora(t.ultima) : "—") + "</td>" +
      "<td>" + insigniaResultado(t) + "</td></tr>").join("");

    document.getElementById("mant-carpeta").innerHTML =
      '<i class="fa-solid fa-folder-open"></i> Carpeta: <code>' + esc(estado.carpeta) + "</code> · Se conservan los últimos " + estado.diasRetencion + " días";

    filasBackups.innerHTML = estado.backups.length
      ? estado.backups.map((b) =>
        '<tr><td><i class="fa-solid fa-file-code mant-icono"></i> ' + esc(b.nombre) + "</td><td>" + fechaHora(b.fecha) + "</td><td>" + b.tamanoKB + " KB</td>" +
        '<td><div class="acciones" style="justify-content:center"><button class="btn btn-borde btn-sm" data-restaurar="' + esc(b.nombre) + '"><i class="fa-solid fa-clock-rotate-left"></i> Restaurar</button></div></td></tr>').join("")
      : '<tr><td colspan="4" class="mensaje-tabla">Todavía no hay backups. Pulsa "Hacer backup ahora" para crear el primero.</td></tr>';
  } catch (error) {
    mostrarErrorTabla(filasTareas, 5, error);
    mostrarErrorTabla(filasBackups, 4, error);
  }
}

function mostrarResultado(ok, texto) {
  zonaResultado.innerHTML = '<div class="mon-aviso ' + (ok ? "ok" : "mal") + '"><i class="fa-solid ' + (ok ? "fa-circle-check" : "fa-triangle-exclamation") + '"></i> ' + texto + "</div>";
}

async function ejecutar(boton, ruta, describir) {
  boton.disabled = true;
  const textoOriginal = boton.innerHTML;
  boton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
  try {
    const respuesta = await fetch(ruta, { method: "POST" });
    const datos = await respuesta.json().catch(() => ({}));
    const ok = respuesta.ok && datos.ok !== false;
    mostrarResultado(ok, describir(datos, ok));
    avisar(ok ? "Tarea ejecutada correctamente." : "La tarea terminó con un error.", !ok);
  } catch (error) {
    mostrarResultado(false, esc(error.message));
  } finally {
    boton.disabled = false;
    boton.innerHTML = textoOriginal;
    cargar();
  }
}

document.getElementById("btn-backup").addEventListener("click", (ev) =>
  ejecutar(ev.currentTarget, "/mantenimiento/backup", (d, ok) => ok
    ? "Backup creado: <strong>" + esc(d.archivo) + "</strong> (" + d.tamanoKB + " KB)."
    : "No se pudo crear el backup: " + esc(d.mensaje || "error desconocido")));

filasBackups.addEventListener("click", async (ev) => {
  const boton = ev.target.closest("[data-restaurar]");
  if (!boton) return;
  const archivo = boton.dataset.restaurar;
  const seguro = await confirmar("Restaurar backup",
    "¿Restaurar la base de datos desde <strong>" + esc(archivo) + "</strong>? Los datos actuales serán reemplazados por los de ese backup. Antes de restaurar se creará automáticamente un respaldo del estado actual.",
    "Restaurar");
  if (!seguro) return;
  ejecutar(boton, "/mantenimiento/restaurar?archivo=" + encodeURIComponent(archivo), (d, ok) => ok
    ? "Base de datos restaurada desde <strong>" + esc(d.archivo) + "</strong>. Antes se guardó un respaldo del estado anterior: <strong>" + esc(d.respaldoPrevio) + "</strong>."
    : "No se pudo restaurar el backup: " + esc(d.mensaje || "error desconocido"));
});

document.getElementById("btn-revision").addEventListener("click", (ev) =>
  ejecutar(ev.currentTarget, "/mantenimiento/revision", (d) =>
    "Revisión completada: <strong>" + d.pendientesAntiguos + "</strong> pedido(s) pendientes desde hace más de 24 h, <strong>" +
    d.pedidosAtrasados + "</strong> pedido(s) atrasados y <strong>" + d.entregasConIncidencia + "</strong> entrega(s) con incidencia."));

document.getElementById("btn-limpieza").addEventListener("click", (ev) =>
  ejecutar(ev.currentTarget, "/mantenimiento/limpieza", (d) =>
    "Limpieza completada: <strong>" + d.eliminados + "</strong> backup(s) antiguos eliminados."));

cargar();
