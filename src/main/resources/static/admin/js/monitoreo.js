const { contenido } = montarPagina({
  activo: "monitoreo",
  titulo: "Monitoreo",
  subtitulo: "Salud, rendimiento y métricas del sistema en tiempo real.",
});

const INTERVALO_MS = 5000;
const MAX_MUESTRAS = 30;
const historial = { cpu: [], memoria: [] };
let temporizador = null;

contenido.innerHTML =
  '<div class="mon-cabecera" id="mon-estado"><p class="mensaje-estado">Consultando el estado del sistema...</p></div>' +
  '<div class="mon-alertas" id="mon-alertas"></div>' +
  '<h3 class="mon-titulo">Salud de los componentes</h3>' +
  '<div class="mon-rejilla cuatro" id="mon-salud"></div>' +
  '<h3 class="mon-titulo">Rendimiento</h3>' +
  '<div class="mon-rejilla cuatro" id="mon-rendimiento"></div>' +
  '<div class="mon-rejilla dos" id="mon-graficos"></div>' +
  '<h3 class="mon-titulo">Métricas del negocio <small>desde el último arranque</small></h3>' +
  '<div class="mon-rejilla cuatro" id="mon-negocio"></div>' +
  '<p class="mon-enlaces">Datos en bruto: ' +
  '<a href="/actuator/health" target="_blank" rel="noopener">/actuator/health</a> · ' +
  '<a href="/actuator/metrics" target="_blank" rel="noopener">/actuator/metrics</a> · ' +
  '<a href="/actuator/info" target="_blank" rel="noopener">/actuator/info</a></p>';

async function leerJson(ruta) {
  try {
    const respuesta = await fetch(ruta, { headers: { Accept: "application/json" } });
    if (respuesta.status === 401) {
      location.href = "../login.html";
      return null;
    }
    const texto = await respuesta.text();
    if (!texto) return null;
    return JSON.parse(texto);
  } catch (e) {
    return null;
  }
}

async function metrica(nombre, etiqueta) {
  const ruta = "/actuator/metrics/" + nombre + (etiqueta ? "?tag=" + encodeURIComponent(etiqueta) : "");
  const datos = await leerJson(ruta);
  const valores = {};
  if (datos && Array.isArray(datos.measurements)) {
    datos.measurements.forEach((m) => { valores[m.statistic] = m.value; });
  }
  return valores;
}

function megas(bytes) {
  return (Number(bytes || 0) / (1024 * 1024)).toFixed(0) + " MB";
}

function gigas(bytes) {
  return (Number(bytes || 0) / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}

function duracion(segundos) {
  const s = Math.floor(Number(segundos || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? h + " h " + m + " min" : m + " min " + (s % 60) + " s";
}

function estadoPill(estado) {
  const arriba = estado === "UP";
  return '<span class="mon-pill ' + (arriba ? "ok" : "mal") + '"><i class="fa-solid ' + (arriba ? "fa-circle-check" : "fa-circle-xmark") + '"></i> ' + esc(estado || "SIN DATOS") + "</span>";
}

function tarjetaSalud(icono, titulo, componente, detalle) {
  const estado = componente ? componente.status : "SIN DATOS";
  return '<div class="mon-tarjeta ' + (estado === "UP" ? "" : "alerta") + '">' +
    '<div class="mon-tarjeta-cab"><span class="mon-icono"><i class="fa-solid ' + icono + '"></i></span>' + estadoPill(estado) + "</div>" +
    "<strong>" + titulo + "</strong><small>" + detalle + "</small></div>";
}

function tarjetaValor(icono, titulo, valor, detalle, porcentaje, alerta) {
  const barra = porcentaje == null ? "" :
    '<div class="mon-barra"><span style="width:' + Math.min(100, Math.max(0, porcentaje)).toFixed(0) + '%"></span></div>';
  return '<div class="mon-tarjeta ' + (alerta ? "alerta" : "") + '">' +
    '<div class="mon-tarjeta-cab"><span class="mon-icono"><i class="fa-solid ' + icono + '"></i></span></div>' +
    '<div class="mon-valor">' + valor + "</div><strong>" + titulo + "</strong>" + barra +
    (detalle ? "<small>" + detalle + "</small>" : "") + "</div>";
}

function grafico(titulo, serie, unidad, color) {
  const ancho = 300;
  const alto = 90;
  const maximo = Math.max(100, ...serie);
  const puntos = serie.map((v, i) => {
    const x = serie.length === 1 ? ancho : (i / (MAX_MUESTRAS - 1)) * ancho;
    const y = alto - (v / maximo) * (alto - 6) - 3;
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  const ultimo = serie.length ? serie[serie.length - 1].toFixed(1) : "0";
  return '<div class="mon-tarjeta"><div class="mon-grafico-cab"><strong>' + titulo + "</strong><span>" + ultimo + unidad + "</span></div>" +
    '<svg class="mon-grafico" viewBox="0 0 ' + ancho + " " + alto + '" preserveAspectRatio="none">' +
    '<line x1="0" y1="' + (alto * 0.2) + '" x2="' + ancho + '" y2="' + (alto * 0.2) + '" class="mon-limite"></line>' +
    '<polyline points="' + puntos + '" style="stroke:' + color + '"></polyline></svg>' +
    "<small>Últimos " + MAX_MUESTRAS + " registros, cada " + INTERVALO_MS / 1000 + " s. La línea punteada marca el 80 %.</small></div>";
}

function agregarMuestra(serie, valor) {
  serie.push(valor);
  if (serie.length > MAX_MUESTRAS) serie.shift();
}

async function actualizar() {
  const [salud, info, memUsada, memMax, cpuProceso, cpuSistema, tiempoActivo, hilos, peticiones,
    creados, cancelados, entregados, rechazados, tiempoRegistro, pendientes, listos,
    asignadas, completadas, enCurso, conIncidencia, loginOk, loginFallidos] = await Promise.all([
    leerJson("/actuator/health"),
    leerJson("/actuator/info"),
    metrica("jvm.memory.used", "area:heap"),
    metrica("jvm.memory.max", "area:heap"),
    metrica("process.cpu.usage"),
    metrica("system.cpu.usage"),
    metrica("process.uptime"),
    metrica("jvm.threads.live"),
    metrica("http.server.requests"),
    metrica("dolcevita.pedidos.creados"),
    metrica("dolcevita.pedidos.cancelados"),
    metrica("dolcevita.pedidos.entregados"),
    metrica("dolcevita.pedidos.rechazados"),
    metrica("dolcevita.pedidos.tiempo_registro"),
    metrica("dolcevita.pedidos.pendientes"),
    metrica("dolcevita.pedidos.listos"),
    metrica("dolcevita.entregas.asignadas"),
    metrica("dolcevita.entregas.completadas"),
    metrica("dolcevita.entregas.en_curso"),
    metrica("dolcevita.entregas.con_incidencia"),
    metrica("dolcevita.login.exitosos"),
    metrica("dolcevita.login.fallidos"),
  ]);

  const componentes = (salud && salud.components) || {};
  const general = salud ? salud.status : "DOWN";
  const app = (info && info.app) || {};
  const ahora = new Date().toLocaleTimeString("es-PE");

  const memoriaUsada = memUsada.VALUE || 0;
  const memoriaMaxima = memMax.VALUE || 0;
  const memoriaPct = memoriaMaxima > 0 ? (memoriaUsada / memoriaMaxima) * 100 : 0;
  const cpuPct = (cpuProceso.VALUE || 0) * 100;
  const peticionesTotal = peticiones.COUNT || 0;
  const respuestaPromedio = peticionesTotal > 0 ? ((peticiones.TOTAL_TIME || 0) / peticionesTotal) * 1000 : 0;
  const respuestaMaxima = (peticiones.MAX || 0) * 1000;
  const registroPromedio = tiempoRegistro.COUNT > 0 ? ((tiempoRegistro.TOTAL_TIME || 0) / tiempoRegistro.COUNT) * 1000 : 0;
  const disco = componentes.diskSpace && componentes.diskSpace.details ? componentes.diskSpace.details : {};
  const imagenes = componentes.almacenamientoImagenes && componentes.almacenamientoImagenes.details ? componentes.almacenamientoImagenes.details : {};
  const baseDatos = componentes.db && componentes.db.details ? componentes.db.details : {};

  agregarMuestra(historial.cpu, cpuPct);
  agregarMuestra(historial.memoria, memoriaPct);

  const alertas = [];
  if (general !== "UP") alertas.push("El sistema reporta estado " + general + ". Revisa los componentes en rojo.");
  if (memoriaPct > 80) alertas.push("La memoria usada supera el 80 % (" + memoriaPct.toFixed(0) + " %).");
  if (cpuPct > 80) alertas.push("El uso de CPU supera el 80 % (" + cpuPct.toFixed(0) + " %).");
  if (disco.free != null && disco.free < 1024 * 1024 * 1024) alertas.push("Queda menos de 1 GB libre en disco.");
  if (respuestaPromedio > 2000) alertas.push("El tiempo promedio de respuesta supera los 2 segundos.");
  if (registroPromedio > 2000) alertas.push("Registrar un pedido está tardando más de 2 segundos.");
  if ((pendientes.VALUE || 0) > 10) alertas.push("Hay más de 10 pedidos pendientes de confirmar.");
  if ((conIncidencia.VALUE || 0) > 0) alertas.push("Hay " + conIncidencia.VALUE + " entrega(s) con incidencia por revisar.");
  if ((loginFallidos.COUNT || 0) > 10) alertas.push("Se registraron más de 10 inicios de sesión fallidos.");

  document.getElementById("mon-estado").innerHTML =
    '<div class="mon-general ' + (general === "UP" ? "ok" : "mal") + '">' +
    '<span class="mon-latido"><i class="fa-solid fa-heart-pulse"></i></span>' +
    "<div><small>Estado general del sistema</small><strong>" + (general === "UP" ? "Funcionando correctamente" : "Con problemas") + "</strong></div>" +
    estadoPill(general) + "</div>" +
    '<div class="mon-meta"><span><i class="fa-solid fa-tag"></i> ' + esc(app.nombre || "DOLCEVITA") + " v" + esc(app.version || "1.0.0") + "</span>" +
    '<span><i class="fa-solid fa-clock"></i> Activo hace ' + duracion(tiempoActivo.VALUE) + "</span>" +
    '<span><i class="fa-solid fa-rotate"></i> Actualizado: ' + ahora + "</span>" +
    '<button class="btn btn-borde btn-sm" id="mon-refrescar"><i class="fa-solid fa-arrows-rotate"></i> Actualizar ahora</button></div>';
  document.getElementById("mon-refrescar").addEventListener("click", reiniciarCiclo);

  document.getElementById("mon-alertas").innerHTML = alertas.length
    ? '<div class="mon-aviso mal"><strong><i class="fa-solid fa-triangle-exclamation"></i> Alertas activas</strong><ul>' + alertas.map((a) => "<li>" + esc(a) + "</li>").join("") + "</ul></div>"
    : '<div class="mon-aviso ok"><i class="fa-solid fa-circle-check"></i> Sin alertas: todas las métricas están dentro de los valores normales.</div>';

  document.getElementById("mon-salud").innerHTML =
    tarjetaSalud("fa-server", "Aplicación", componentes.ping, "Responde a las peticiones") +
    tarjetaSalud("fa-database", "Base de datos", componentes.db, esc(baseDatos.database || "MySQL") + " · pasteleriaweb") +
    tarjetaSalud("fa-hard-drive", "Disco", componentes.diskSpace, "Libre: " + gigas(disco.free) + " de " + gigas(disco.total)) +
    tarjetaSalud("fa-images", "Imágenes de productos", componentes.almacenamientoImagenes, (imagenes.imagenes != null ? imagenes.imagenes : 0) + " imágenes guardadas");

  document.getElementById("mon-rendimiento").innerHTML =
    tarjetaValor("fa-memory", "Memoria usada", megas(memoriaUsada), "Máximo disponible: " + megas(memoriaMaxima), memoriaPct, memoriaPct > 80) +
    tarjetaValor("fa-microchip", "CPU de la aplicación", cpuPct.toFixed(1) + " %", "CPU del equipo: " + ((cpuSistema.VALUE || 0) * 100).toFixed(1) + " %", cpuPct, cpuPct > 80) +
    tarjetaValor("fa-gauge-high", "Respuesta promedio", respuestaPromedio.toFixed(0) + " ms", "Máxima reciente: " + respuestaMaxima.toFixed(0) + " ms · " + peticionesTotal + " peticiones", null, respuestaPromedio > 2000) +
    tarjetaValor("fa-layer-group", "Hilos activos", String(hilos.VALUE || 0), "Hilos de la máquina virtual de Java", null, false);

  document.getElementById("mon-graficos").innerHTML =
    grafico("Uso de CPU", historial.cpu, " %", "#722f45") +
    grafico("Uso de memoria", historial.memoria, " %", "#c9915d");

  document.getElementById("mon-negocio").innerHTML =
    tarjetaValor("fa-cart-plus", "Pedidos creados", String(creados.COUNT || 0), "Registro promedio: " + registroPromedio.toFixed(0) + " ms", null, false) +
    tarjetaValor("fa-hourglass-half", "Pedidos pendientes", String(pendientes.VALUE || 0), "Listos para entregar: " + (listos.VALUE || 0), null, (pendientes.VALUE || 0) > 10) +
    tarjetaValor("fa-circle-xmark", "Pedidos cancelados", String(cancelados.COUNT || 0), "Entregados: " + (entregados.COUNT || 0), null, false) +
    tarjetaValor("fa-box-open", "Rechazados por stock", String(rechazados.COUNT || 0), "Pedidos que no se registraron", null, false) +
    tarjetaValor("fa-motorcycle", "Entregas asignadas", String(asignadas.COUNT || 0), "En camino ahora: " + (enCurso.VALUE || 0), null, false) +
    tarjetaValor("fa-flag-checkered", "Entregas completadas", String(completadas.COUNT || 0), "Por los motorizados", null, false) +
    tarjetaValor("fa-triangle-exclamation", "Entregas con incidencia", String(conIncidencia.VALUE || 0), "Pendientes de revisión", null, (conIncidencia.VALUE || 0) > 0) +
    tarjetaValor("fa-user-lock", "Inicios de sesión fallidos", String(loginFallidos.COUNT || 0), "Correctos: " + (loginOk.COUNT || 0), null, (loginFallidos.COUNT || 0) > 10);
}

async function ciclo() {
  await actualizar();
  temporizador = setTimeout(ciclo, INTERVALO_MS);
}

function reiniciarCiclo() {
  clearTimeout(temporizador);
  ciclo();
}

ciclo();
