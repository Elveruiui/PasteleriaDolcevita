const zonaCheckout = document.getElementById("zonaCheckout");
const avisoCheckout = document.getElementById("avisoCheckout");

const URL_QR_POKEAPI = "https://pokeapi.co/";
const IMG_QR_POKEAPI =
  "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=" +
  encodeURIComponent(URL_QR_POKEAPI);

let productosPedido = [];
let cliente = null;
let direccionesGuardadas = [];
let mapa = null;
let marcador = null;
let coordenadasSeleccionadas = { lat: -12.1111, lng: -76.9892 };
let pagoConfirmado = false;
let detallePagoSimulado = "";

function hoyISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function subtotalProductos() {
  return productosPedido.reduce((suma, { producto, cantidad }) => suma + producto.precio * cantidad, 0);
}

function costoDelivery(modalidad, subtotal) {
  if (modalidad !== "Delivery") return 0;
  return Math.min(15, Math.max(5, Math.round(subtotal * 5) / 100));
}

function totalActual() {
  const elegido = document.querySelector("input[name=modalidad]:checked");
  const modalidad = elegido ? elegido.value : "Recojo";
  const subtotal = subtotalProductos();
  return subtotal + costoDelivery(modalidad, subtotal);
}

function metodoPagoSeleccionado() {
  const radio = document.querySelector("input[name=metodoPago]:checked");
  return radio ? radio.value : "TARJETA";
}

function actualizarTotales() {
  const elegido = document.querySelector("input[name=modalidad]:checked");
  const modalidad = elegido ? elegido.value : "Recojo";
  const subtotal = subtotalProductos();
  const delivery = costoDelivery(modalidad, subtotal);
  const total = subtotal + delivery;

  document.getElementById("resSubtotal").textContent = formatearPrecio(subtotal);
  document.getElementById("resDelivery").textContent = formatearPrecio(delivery);
  document.getElementById("filaDelivery").style.display = modalidad === "Delivery" ? "" : "none";
  document.getElementById("resTotal").textContent = formatearPrecio(total);

  const montoTarjeta = document.getElementById("montoTarjeta");
  const montoQr = document.getElementById("montoQr");
  if (montoTarjeta) montoTarjeta.textContent = formatearPrecio(total);
  if (montoQr) montoQr.textContent = formatearPrecio(total);
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
    <div class="fila-dato"><span>Productos</span><span id="resSubtotal">${formatearPrecio(total)}</span></div>
    <div class="fila-dato" id="filaDelivery" style="display:none"><span>Delivery</span><span id="resDelivery">${formatearPrecio(0)}</span></div>
    <div class="fila-total"><span>Total</span><span class="monto" id="resTotal">${formatearPrecio(total)}</span></div>
    <p class="ayuda" style="margin-top:.8rem">El delivery cuesta el 5% del pedido, con un mínimo de S/ 5.00 y un máximo de S/ 15.00.</p>
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

function dibujarSeccionPago() {
  const monto = formatearPrecio(subtotalProductos());
  return `
    <div style="margin-top:1.4rem;padding-top:1.2rem;border-top:1px solid var(--gris-borde)">
      <h3 style="font-size:1.15rem;margin-bottom:.6rem">Forma de pago</h3>
      <div class="fila-radio" style="margin-bottom:1rem">
        <label><input type="radio" name="metodoPago" value="TARJETA" checked> <i class="fa-regular fa-credit-card"></i> Tarjeta</label>
        <label><input type="radio" name="metodoPago" value="YAPE_PLIN"> <i class="fa-solid fa-qrcode"></i> QR (Yape / Plin)</label>
        <label><input type="radio" name="metodoPago" value="CONTRA_ENTREGA"> <i class="fa-solid fa-money-bill-wave"></i> Contra entrega</label>
      </div>

      <!-- BLOQUE PAGO CON TARJETA (SIMULACIÓN) -->
      <div id="bloquePagoTarjeta" style="background:#fdfbf8;padding:1rem;border-radius:12px;border:1px solid #eadfce">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem;flex-wrap:wrap;gap:.4rem">
          <strong><i class="fa-solid fa-lock" style="color:var(--dorado-oscuro)"></i> Pago con tarjeta (Simulación)</strong>
          <span class="ayuda">Monto a pagar: <strong id="montoTarjeta">${monto}</strong></span>
        </div>
        <label for="cardNumero">Número de tarjeta</label>
        <input type="text" id="cardNumero" inputmode="numeric" maxlength="19" placeholder="4557 8801 2345 6789" autocomplete="off">

        <label for="cardTitular">Nombre del titular</label>
        <input type="text" id="cardTitular" maxlength="80" placeholder="Como aparece en la tarjeta" value="${esc((cliente.nombre || "") + " " + (cliente.apellido || "")).trim()}">

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem">
          <div>
            <label for="cardVencimiento">Vencimiento (MM/AA)</label>
            <input type="text" id="cardVencimiento" inputmode="numeric" maxlength="5" placeholder="08/29" autocomplete="off">
          </div>
          <div>
            <label for="cardCvv">CVV</label>
            <input type="password" id="cardCvv" inputmode="numeric" maxlength="4" placeholder="123" autocomplete="off">
          </div>
        </div>
        <p class="ayuda" style="margin-top:.5rem">Modo simulación: puedes ingresar cualquier tarjeta de 16 dígitos para probar.</p>
        <p class="aviso-carrito" id="errorPagoTarjeta" hidden style="margin-top:.7rem;margin-bottom:0"></p>
        <button type="button" class="btn btn-borde btn-bloque" id="btnConfirmarPagoTarjeta" style="margin-top:.9rem">
          <i class="fa-solid fa-shield-check"></i> Confirmar pago
        </button>
      </div>

      <!-- BLOQUE PAGO CON QR YAPE / PLIN (SIMULACIÓN) -->
      <div id="bloquePagoQr" hidden style="background:#fdfbf8;padding:1rem;border-radius:12px;border:1px solid #eadfce;text-align:center">
        <div style="display:flex;justify-content:center;gap:.5rem;margin-bottom:.6rem">
          <span style="background:#742284;color:#fff;padding:.2rem .8rem;border-radius:999px;font-size:.78rem;font-weight:600">Yape</span>
          <span style="background:#00b8a9;color:#fff;padding:.2rem .8rem;border-radius:999px;font-size:.78rem;font-weight:600">Plin</span>
        </div>
        <p style="font-size:.9rem;margin-bottom:.4rem">Escanea el código QR para pagar <strong id="montoQr" style="color:var(--dorado-oscuro)">${monto}</strong></p>
        <a href="${URL_QR_POKEAPI}" target="_blank" rel="noopener" title="Abrir enlace del QR (PokéAPI)" style="display:inline-block;background:#fff;padding:.6rem;border-radius:14px;border:2px solid #eadfce;margin:.5rem auto">
          <img src="${IMG_QR_POKEAPI}" alt="Código QR de pago simulado (PokéAPI)" width="210" height="210" style="margin:0 auto;border-radius:8px">
        </a>
        <p class="ayuda" style="margin-top:.3rem">
          Simulación QR · Destino: <a href="${URL_QR_POKEAPI}" target="_blank" rel="noopener" style="color:var(--vino);text-decoration:underline">pokeapi.co</a>
        </p>
        <button type="button" class="btn btn-borde btn-bloque" id="btnConfirmarPagoQr" style="margin-top:.9rem">
          <i class="fa-solid fa-check-double"></i> Confirmar pago
        </button>
      </div>

      <!-- AVISO PAGO CONTRA ENTREGA -->
      <div id="bloquePagoContraEntrega" hidden style="background:#faf6f0;padding:.85rem 1rem;border-radius:12px;border:1px solid #eadfce">
        <p class="ayuda" style="margin:0"><i class="fa-solid fa-circle-info" style="color:var(--dorado-oscuro)"></i> Pagarás al momento de recibir o recoger tu pedido (efectivo, Yape o Plin).</p>
      </div>

      <!-- BANNER DE PAGO EXITOSO -->
      <div id="bannerPagoExitoso" class="aviso-ok" hidden style="display:none;align-items:center;gap:.6rem;font-weight:500">
        <i class="fa-solid fa-circle-check" style="font-size:1.2rem"></i>
        <span id="textoPagoExitoso">Pago confirmado con éxito.</span>
      </div>
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

      ${dibujarSeccionPago()}

      <p class="aviso-carrito" id="errorForm" hidden style="margin-top:1rem;margin-bottom:0"></p>
      <button class="btn btn-dorado btn-bloque" id="confirmar" type="submit" style="margin-top:1.4rem">Confirmar pedido</button>
    </form>`;
}

function reiniciarEstadoPago() {
  pagoConfirmado = false;
  detallePagoSimulado = "";

  const banner = document.getElementById("bannerPagoExitoso");
  if (banner) {
    banner.hidden = true;
    banner.style.display = "none";
  }

  ["cardNumero", "cardTitular", "cardVencimiento", "cardCvv"].forEach((id) => {
    const campo = document.getElementById(id);
    if (campo) campo.disabled = false;
  });

  const btnTarjeta = document.getElementById("btnConfirmarPagoTarjeta");
  if (btnTarjeta) {
    btnTarjeta.disabled = false;
    btnTarjeta.innerHTML = '<i class="fa-solid fa-shield-check"></i> Confirmar pago';
  }

  const btnQr = document.getElementById("btnConfirmarPagoQr");
  if (btnQr) {
    btnQr.disabled = false;
    btnQr.innerHTML = '<i class="fa-solid fa-check-double"></i> Confirmar pago';
  }

  const errTarjeta = document.getElementById("errorPagoTarjeta");
  if (errTarjeta) errTarjeta.hidden = true;
}

function mostrarExitoPago(texto) {
  pagoConfirmado = true;
  detallePagoSimulado = texto;
  const banner = document.getElementById("bannerPagoExitoso");
  const span = document.getElementById("textoPagoExitoso");
  if (span) span.textContent = texto;
  if (banner) {
    banner.hidden = false;
    banner.style.display = "flex";
  }
  mostrarError("");
}

function configurarEventosPago() {
  const inputNumero = document.getElementById("cardNumero");
  const inputVenc = document.getElementById("cardVencimiento");
  const inputCvv = document.getElementById("cardCvv");

  // Formato automático de tarjeta: 0000 0000 0000 0000
  inputNumero.addEventListener("input", () => {
    const digitos = inputNumero.value.replace(/\D/g, "").slice(0, 16);
    inputNumero.value = digitos.replace(/(.{4})/g, "$1 ").trim();
  });

  // Formato automático de vencimiento: MM/AA
  inputVenc.addEventListener("input", () => {
    const digitos = inputVenc.value.replace(/\D/g, "").slice(0, 4);
    inputVenc.value = digitos.length > 2 ? digitos.slice(0, 2) + "/" + digitos.slice(2) : digitos;
  });

  // Solo números en CVV
  inputCvv.addEventListener("input", () => {
    inputCvv.value = inputCvv.value.replace(/\D/g, "").slice(0, 4);
  });

  // Cambiar entre Tarjeta, QR y Contra entrega
  document.querySelectorAll("input[name=metodoPago]").forEach((radio) =>
    radio.addEventListener("change", () => {
      const metodo = metodoPagoSeleccionado();
      document.getElementById("bloquePagoTarjeta").hidden = metodo !== "TARJETA";
      document.getElementById("bloquePagoQr").hidden = metodo !== "YAPE_PLIN";
      document.getElementById("bloquePagoContraEntrega").hidden = metodo !== "CONTRA_ENTREGA";
      reiniciarEstadoPago();
      mostrarError("");
    })
  );

  // Botón "Confirmar pago" para TARJETA
  document.getElementById("btnConfirmarPagoTarjeta").addEventListener("click", () => {
    const err = document.getElementById("errorPagoTarjeta");
    err.hidden = true;

    const numero = inputNumero.value.replace(/\s+/g, "");
    const titular = document.getElementById("cardTitular").value.trim();
    const venc = inputVenc.value.trim();
    const cvv = inputCvv.value.trim();

    if (!/^\d{16}$/.test(numero)) {
      err.textContent = "Ingresa un número de tarjeta válido de 16 dígitos.";
      err.hidden = false;
      return;
    }
    if (titular.length < 3) {
      err.textContent = "Ingresa el nombre del titular de la tarjeta.";
      err.hidden = false;
      return;
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(venc)) {
      err.textContent = "Ingresa la fecha de vencimiento en formato MM/AA (ej. 08/29).";
      err.hidden = false;
      return;
    }
    if (!/^\d{3,4}$/.test(cvv)) {
      err.textContent = "Ingresa un código CVV válido de 3 o 4 dígitos.";
      err.hidden = false;
      return;
    }

    const btn = document.getElementById("btnConfirmarPagoTarjeta");
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando pago...';

    setTimeout(() => {
      ["cardNumero", "cardTitular", "cardVencimiento", "cardCvv"].forEach((id) => {
        document.getElementById(id).disabled = true;
      });
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Pago confirmado';
      const ultimos4 = numero.slice(-4);
      mostrarExitoPago(
        `¡Pago exitoso con tarjeta •••• ${ultimos4} por ${formatearPrecio(totalActual())}! Ahora presiona "Confirmar pedido".`
      );
    }, 650);
  });

  // Botón "Confirmar pago" para QR (YAPE / PLIN)
  document.getElementById("btnConfirmarPagoQr").addEventListener("click", () => {
    const btn = document.getElementById("btnConfirmarPagoQr");
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando pago QR...';

    setTimeout(() => {
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Pago confirmado';
      mostrarExitoPago(
        `¡Pago exitoso con QR (Yape / Plin) por ${formatearPrecio(totalActual())}! Ahora presiona "Confirmar pedido".`
      );
    }, 650);
  });
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
  const metodoPago = metodoPagoSeleccionado();

  if (!fecha) return mostrarError("Elige la fecha de entrega.");
  if (fecha < hoyISO()) return mostrarError("La fecha de entrega no puede ser anterior a hoy.");

  if ((metodoPago === "TARJETA" || metodoPago === "YAPE_PLIN") && !pagoConfirmado) {
    return mostrarError('Primero presiona el botón "Confirmar pago" para validar tu pago antes de registrar el pedido.');
  }

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
      metodo_pago: metodoPago,
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
    actualizarTotales();
    configurarEventosPago();

    const formulario = document.getElementById("formReserva");
    formulario.addEventListener("submit", registrarPedido);
    formulario.addEventListener("input", () => mostrarError(""));

    document.querySelectorAll("input[name=modalidad]").forEach((radio) =>
      radio.addEventListener("change", () => {
        const esDelivery = document.querySelector("input[name=modalidad]:checked").value === "Delivery";
        document.getElementById("bloqueDireccion").hidden = !esDelivery;
        actualizarTotales();
        if (pagoConfirmado) {
          reiniciarEstadoPago();
          mostrarError("El monto total cambió por la modalidad de entrega. Vuelve a presionar 'Confirmar pago'.");
        }
        if (esDelivery && !document.getElementById("formNuevaDireccion").hidden) {
          inicializarMapa();
        }
      })
    );

    document.querySelectorAll('input[name="dirSeleccionada"]').forEach((radio) =>
      radio.addEventListener("change", () => {
        const esNueva = document.querySelector('input[name="dirSeleccionada"]:checked').value === "NUEVA";
        document.getElementById("formNuevaDireccion").hidden = !esNueva;
        if (esNueva) inicializarMapa();
      })
    );

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