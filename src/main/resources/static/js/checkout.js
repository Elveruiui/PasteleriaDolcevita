const zonaCheckout = document.getElementById("zonaCheckout");
const avisoCheckout = document.getElementById("avisoCheckout");

let productosPedido = [];
let cliente = null;
let direccionesGuardadas = [];
let mapa = null;
let marcador = null;
let coordenadasSeleccionadas = { lat: -12.1111, lng: -76.9892 }; // Santiago de Surco / Lima por defecto

function hoyISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function dibujarResumen() {
  let total = 0;
  const filas = productosPedido.map(({ producto, cantidad }) => {
    const linea = producto.precio * cantidad;
    total += linea;
    const tam = producto.tamano ? ` (${producto.tamano})` : "";
    return `
      <div class="item">
        <img src="${urlImagen(producto.imagen)}" alt="${esc(producto.nombre)}">
        <div class="info">
          <h3>${esc(producto.nombre)}${esc(tam)}</h3>
          <span class="ayuda">${cantidad} und. × ${formatearPrecio(producto.precio)}</span>
        </div>
        <span class="precio">${formatearPrecio(linea)}</span>
      </div>`;
  }).join("");
  return `<div class="panel"><h3>Resumen del pedido</h3>${filas}
    <div class="fila-total"><span>Total</span><span class="monto">${formatearPrecio(total)}</span></div>
    <p class="ayuda" style="margin-top:.8rem">El precio final lo confirma el sistema al registrar el pedido.</p>
    <a class="ayuda" href="carrito.html" style="text-decoration:underline">Volver al carrito</a></div>`;
}

function dibujarOpcionesDirecciones() {
  const radiosGuardadas = direccionesGuardadas.map((d, idx) => `
    <label style="display:flex;align-items:flex-start;gap:.6rem;padding:.7rem;border:1px solid #eadfce;border-radius:8px;margin-bottom:.5rem;cursor:pointer;background:#faf6f0">
      <input type="radio" name="dirSeleccionada" value="${d.id_direccion}" ${idx === 0 ? "checked" : ""} style="margin-top:4px">
      <div>
        <strong><i class="fa-solid fa-location-dot" style="color:var(--dorado-oscuro)"></i> ${esc(d.alias || "Dirección")}</strong>
        <div class="ayuda" style="margin-top:2px">${esc(d.direccion)}</div>
        ${d.referencia ? `<small class="ayuda">Ref: ${esc(d.referencia)}</small>` : ""}
      </div>
    </label>
  `).join("");

  const mostrarNuevaPorDefecto = direccionesGuardadas.length === 0;

  return `
    <div style="margin-top:.8rem">
      ${direccionesGuardadas.length > 0 ? `<label>Tus direcciones guardadas</label>${radiosGuardadas}` : ""}
      <label style="display:flex;align-items:center;gap:.6rem;padding:.7rem;border:1px dashed var(--dorado-oscuro);border-radius:8px;cursor:pointer;margin-bottom:.8rem">
        <input type="radio" name="dirSeleccionada" value="NUEVA" ${mostrarNuevaPorDefecto ? "checked" : ""}>
        <strong><i class="fa-solid fa-plus"></i> Agregar una nueva dirección</strong>
      </label>
    </div>

    <div id="formNuevaDireccion" ${mostrarNuevaPorDefecto ? "" : "hidden"} style="background:#fdfbf8;padding:1rem;border-radius:10px;border:1px solid #eadfce">
      <label for="aliasDir">Nombre para esta dirección (ej. Casa, Trabajo)</label>
      <div style="display:flex;gap:.4rem;margin-bottom:.5rem">
        <button type="button" class="chip btn-alias" data-alias="Casa">🏠 Casa</button>
        <button type="button" class="chip btn-alias" data-alias="Trabajo">🏢 Trabajo</button>
        <button type="button" class="chip btn-alias" data-alias="Pareja">❤️ Pareja</button>
      </div>
      <input type="text" id="aliasDir" value="Casa" placeholder="Ej. Casa, Oficina, Casa de mamá..." maxlength="60">

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.8rem">
        <label style="margin:0">Selecciona tu ubicación en el mapa</label>
        <button type="button" id="btnMiUbicacion" class="btn btn-borde" style="padding:4px 10px;font-size:.8rem">
          <i class="fa-solid fa-crosshairs"></i> Usar mi GPS
        </button>
      </div>
      <div id="mapaDireccion" style="height:240px;width:100%;border-radius:8px;margin:.5rem 0;border:1px solid #d5c7b8;z-index:1"></div>
      <small class="ayuda" style="display:block;margin-bottom:.6rem">Haz clic en el mapa o arrastra el marcador para autocompletar tu dirección.</small>

      <label for="direccion">Dirección de entrega</label>
      <input type="text" id="direccion" placeholder="Av. / Calle / Número / Distrito" maxlength="200">
      <label for="referencia">Referencia (opcional)</label>
      <input type="text" id="referencia" placeholder="Ej. Frente al parque, portón negro" maxlength="150">
    </div>
  `;
}

function dibujarFormulario() {
  return `
    <form class="panel" id="formReserva" novalidate>
      <h3>Datos de entrega</h3>
      <p class="ayuda">Pedido a nombre de: <strong>${esc(cliente.nombre)} ${esc(cliente.apellido)}</strong></p>
      <label for="fecha">Fecha de entrega</label>
      <input type="date" id="fecha" min="${hoyISO()}" required>
      <label for="hora">Hora aproximada</label>
      <input type="time" id="hora" value="10:00" required>
      <label>Modalidad de entrega</label>
      <div class="fila-radio">
        <label><input type="radio" name="modalidad" value="Recojo" checked> Recojo en el local</label>
        <label><input type="radio" name="modalidad" value="Delivery"> Delivery a domicilio</label>
      </div>
      <div id="bloqueDireccion" hidden>
        ${dibujarOpcionesDirecciones()}
      </div>
      <label for="obs" style="margin-top:.8rem;display:block">Observaciones del pedido (opcional)</label>
      <textarea id="obs" maxlength="200" placeholder="Mensaje para la torta, dedicatoria, etc."></textarea>
      <p class="aviso-carrito" id="errorForm" hidden></p>
      <button class="btn btn-dorado btn-bloque" id="confirmar" type="submit" style="margin-top:1.4rem">Confirmar pedido</button>
    </form>`;
}

function inicializarMapa() {
  const contenedorMapa = document.getElementById("mapaDireccion");
  if (!contenedorMapa || typeof L === "undefined") return;

  if (mapa) {
    setTimeout(() => mapa.invalidateSize(), 150);
    return;
  }

  mapa = L.map("mapaDireccion").setView([coordenadasSeleccionadas.lat, coordenadasSeleccionadas.lng], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
  }).addTo(mapa);

  marcador = L.marker([coordenadasSeleccionadas.lat, coordenadasSeleccionadas.lng], { draggable: true }).addTo(mapa);

  async function actualizarDireccionDesdeCoordenadas(lat, lng) {
    coordenadasSeleccionadas = { lat, lng };
    const inputDir = document.getElementById("direccion");
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.display_name) {
          inputDir.value = data.display_name.slice(0, 190);
        }
      }
    } catch (e) {
      console.warn("No se pudo autocompletar el nombre de la calle:", e);
    }
  }

  mapa.on("click", (e) => {
    marcador.setLatLng(e.latlng);
    actualizarDireccionDesdeCoordenadas(e.latlng.lat, e.latlng.lng);
  });

  marcador.on("dragend", () => {
    const pos = marcador.getLatLng();
    actualizarDireccionDesdeCoordenadas(pos.lat, pos.lng);
  });

  const btnGps = document.getElementById("btnMiUbicacion");
  if (btnGps && navigator.geolocation) {
    btnGps.addEventListener("click", () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          mapa.setView([latitude, longitude], 17);
          marcador.setLatLng([latitude, longitude]);
          actualizarDireccionDesdeCoordenadas(latitude, longitude);
        },
        () => mostrarError("No pudimos acceder a tu ubicación GPS. Asegúrate de dar permiso en el navegador.")
      );
    });
  }
}

function mostrarError(mensaje) {
  const caja = document.getElementById("errorForm");
  caja.textContent = mensaje;
  caja.hidden = !mensaje;
}

async function obtenerIdDireccion(modalidad) {
  if (modalidad === "Delivery") {
    const radioSel = document.querySelector('input[name="dirSeleccionada"]:checked');
    const valorSel = radioSel ? radioSel.value : "NUEVA";

    if (valorSel !== "NUEVA") {
      return Number(valorSel);
    }

    const alias = (document.getElementById("aliasDir").value || "Casa").trim();
    const textoDireccion = document.getElementById("direccion").value.trim();
    const referencia = document.getElementById("referencia").value.trim();

    if (textoDireccion.length < 5) {
      throw new Error("Escribe una dirección de entrega válida o selecciónala en el mapa.");
    }

    const nueva = await Api.crearDireccion({
      usuario: { id_usuario: cliente.id_usuario },
      alias: alias || "Casa",
      direccion: textoDireccion,
      referencia: referencia || null,
      latitud: coordenadasSeleccionadas.lat,
      longitud: coordenadasSeleccionadas.lng,
    });
    return nueva.id_direccion;
  }

  // Si es Recojo en el local
  const recojoExistente = direccionesGuardadas.find((d) => /recojo/i.test(d.direccion));
  if (recojoExistente) return recojoExistente.id_direccion;

  const nueva = await Api.crearDireccion({
    usuario: { id_usuario: cliente.id_usuario },
    alias: "Local",
    direccion: "Recojo en el local",
  });
  return nueva.id_direccion;
}

async function registrarPedido(evento) {
  evento.preventDefault();
  mostrarError("");
  const fecha = document.getElementById("fecha").value;
  const hora = document.getElementById("hora").value || "10:00";
  const modalidad = document.querySelector("input[name=modalidad]:checked").value;

  if (!fecha) return mostrarError("Elige la fecha de entrega.");
  if (fecha < hoyISO()) return mostrarError("La fecha de entrega no puede ser anterior a hoy.");

  const boton = document.getElementById("confirmar");
  boton.disabled = true;
  boton.textContent = "Registrando...";
  try {
    const idDireccion = await obtenerIdDireccion(modalidad);
    const notas = document.getElementById("obs").value.trim();

    const pedido = await Api.crearPedido({
      usuario: { id_usuario: cliente.id_usuario },
      direccion: { id_direccion: idDireccion },
      fecha_entrega: fecha + "T" + hora + ":00",
      modalidad_entrega: modalidad,
      observacion: notas || null,
      detalles: productosPedido.map(({ producto, cantidad }) => ({
        producto: { id_producto: producto.id_producto },
        cantidad: cantidad,
      })),
    });
    Carrito.vaciar();
    location.href = "confirmacion.html?nuevo=1&id=" + pedido.id_pedido;
  } catch (error) {
    console.error(error);
    mostrarError(error.message.replace(/^Error al registrar el pedido:\s*/, "No se pudo registrar el pedido: "));
    boton.disabled = false;
    boton.textContent = "Confirmar pedido";
  }
}

async function iniciar() {
  const items = Carrito.leer();
  if (items.length === 0) {
    zonaCheckout.innerHTML = '<div class="panel carrito-vacio"><p>Tu carrito está vacío.</p><a class="btn btn-dorado" href="menu.html">Ver el menú</a></div>';
    return;
  }
  try {
    const resultados = await Promise.allSettled(items.map((i) => Api.producto(i.id)));
    resultados.forEach((r, n) => {
      if (r.status === "fulfilled" && r.value.estado === 1 && r.value.stock > 0) {
        productosPedido.push({ producto: r.value, cantidad: Math.min(items[n].cantidad, r.value.stock) });
      }
    });
    if (productosPedido.length === 0) {
      zonaCheckout.innerHTML = '<div class="panel carrito-vacio"><p>Los productos de tu carrito ya no están disponibles.</p><a class="btn btn-dorado" href="menu.html">Ver el menú</a></div>';
      return;
    }
    cliente = await Sesion.clienteActual();
    const todasLasDirecciones = await Api.direccionesDe(cliente.id_usuario);
    direccionesGuardadas = todasLasDirecciones.filter((d) => !/recojo en el local/i.test(d.direccion));

    zonaCheckout.innerHTML = dibujarFormulario() + dibujarResumen();
    zonaCheckout.querySelectorAll(".item img").forEach(conRespaldo);

    const formulario = document.getElementById("formReserva");
    formulario.addEventListener("submit", registrarPedido);
    formulario.addEventListener("input", () => mostrarError(""));

    // Mostrar/ocultar bloque de Delivery y mapa
    document.querySelectorAll("input[name=modalidad]").forEach((radio) =>
      radio.addEventListener("change", () => {
        const esDelivery = document.querySelector("input[name=modalidad]:checked").value === "Delivery";
        document.getElementById("bloqueDireccion").hidden = !esDelivery;
        if (esDelivery && !document.getElementById("formNuevaDireccion").hidden) {
          inicializarMapa();
        }
      })
    );

    // Cambiar entre una dirección guardada y "+ Agregar una nueva dirección"
    document.querySelectorAll('input[name="dirSeleccionada"]').forEach((radio) =>
      radio.addEventListener("change", () => {
        const esNueva = document.querySelector('input[name="dirSeleccionada"]:checked').value === "NUEVA";
        document.getElementById("formNuevaDireccion").hidden = !esNueva;
        if (esNueva) inicializarMapa();
      })
    );

    // Botones rápidos para el alias ("Casa", "Trabajo", "Pareja")
    document.querySelectorAll(".btn-alias").forEach((btn) =>
      btn.addEventListener("click", () => {
        document.getElementById("aliasDir").value = btn.dataset.alias;
      })
    );
  } catch (error) {
    console.error(error);
    zonaCheckout.innerHTML = '<p class="mensaje-estado error">No pudimos preparar tu reserva. ' + esc(error.message) + "</p>";
  }
}
iniciar();