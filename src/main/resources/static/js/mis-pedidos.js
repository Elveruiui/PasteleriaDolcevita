const listaPedidos = document.getElementById("listaPedidos");
const pestanas = document.getElementById("pestanas");

const GRUPOS = [
  { id: "todos", texto: "Todos", estados: null },
  { id: "proceso", texto: "En proceso", estados: ["PENDIENTE", "CONFIRMADO", "LISTO"] },
  { id: "camino", texto: "En camino", estados: ["EN_CAMINO"] },
  { id: "entregados", texto: "Entregados", estados: ["ENTREGADO"] },
  { id: "cancelados", texto: "Cancelados", estados: ["CANCELADO"] },
  { id: "direcciones", texto: "📍 Mis direcciones", estados: null },
  { id: "perfil", texto: "👤 Mis datos", estados: null },
];

const CLASES_ESTADO = {
  PENDIENTE: "e-pendiente", CONFIRMADO: "e-confirmado", LISTO: "e-listo", EN_CAMINO: "e-camino",
  ENTREGADO: "e-entregado", CANCELADO: "e-cancelado",
};

let clienteActual = null;
let pedidos = [];
let direcciones = [];
let grupoActivo = "todos";

let mapaModal = null;
let marcadorModal = null;
let coordsActuales = { lat: -12.1111, lng: -76.9892 };

function estadoDe(pedido) {
  return String(pedido.estado || "").toUpperCase();
}

function textoEstado(estado, modalidad) {
  if (estado === "LISTO" && String(modalidad || "").toLowerCase().includes("recojo")) return "Listo para recojo";
  const t = estado.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function fechaCorta(valor) {
  if (!valor) return "—";
  const [a, m, d] = String(valor).split("T")[0].split("-");
  return d + "/" + m + "/" + a;
}

function codigo(id) {
  return "#DV-" + String(id).padStart(5, "0");
}

function dibujarPestanas() {
  pestanas.innerHTML = GRUPOS.map((g) =>
    '<button class="pestana' + (g.id === grupoActivo ? " activo" : "") + '" data-grupo="' + g.id + '">' + g.texto + "</button>"
  ).join("");
}

function dibujarVista() {
  if (grupoActivo === "direcciones") {
    dibujarDirecciones();
  } else if (grupoActivo === "perfil") {
    dibujarPerfilUsuario();
  } else {
    dibujarListaPedidos();
  }
}

function dibujarListaPedidos() {
  const grupo = GRUPOS.find((g) => g.id === grupoActivo);
  const visibles = pedidos.filter((p) => !grupo.estados || grupo.estados.includes(estadoDe(p)));

  if (visibles.length === 0) {
    listaPedidos.innerHTML = pedidos.length === 0
      ? '<div class="carrito-vacio"><p>Todavía no tienes pedidos.</p><a class="btn btn-dorado" href="menu.html">Ver el menú</a></div>'
      : '<p class="mensaje-estado">No tienes pedidos en esta categoría.</p>';
    return;
  }

  listaPedidos.innerHTML = visibles.map((p) => {
    const detalles = p.detalles || [];
    const primero = detalles[0] && detalles[0].producto;
    const tamanoPrimero = primero && primero.tamano ? ` (${primero.tamano})` : "";
    const cantidad = detalles.length;
    const estado = estadoDe(p);
    return '<div class="pedido">' +
      "<div><strong>" + codigo(p.id_pedido) + "</strong><small>" + fechaCorta(p.fecha_pedido) + "</small></div>" +
      '<div class="prod"><img src="' + urlImagen(primero ? primero.imagen : null) + '" alt="">' +
      "<div>" + esc(primero ? primero.nombre + tamanoPrimero : "Pedido") + "<small>" + cantidad + (cantidad === 1 ? " producto" : " productos") + "</small></div></div>" +
      '<div><span class="estado ' + (CLASES_ESTADO[estado] || "e-nuevo") + '">' + esc(textoEstado(estado, p.modalidad_entrega)) + "</span></div>" +
      '<div><a class="btn btn-borde btn-sm" href="confirmacion.html?id=' + p.id_pedido + '">Ver detalle</a></div></div>';
  }).join("");
  listaPedidos.querySelectorAll("img").forEach(conRespaldo);
}

/* ==================== SECCIÓN MIS DIRECCIONES ==================== */

function dibujarDirecciones() {
  const tarjetas = direcciones.map((d) => `
    <div class="pedido" style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
      <div>
        <strong style="font-size:1.05rem">
          <i class="fa-solid fa-location-dot" style="color:var(--dorado-oscuro)"></i> ${esc(d.alias || "Casa")}
        </strong>
        <div style="margin-top:4px">${esc(d.direccion)}</div>
        ${d.referencia ? `<small class="ayuda">Referencia: ${esc(d.referencia)}</small>` : ""}
        ${d.latitud && d.longitud ? `<div style="margin-top:4px"><a href="https://www.google.com/maps?q=${d.latitud},${d.longitud}" target="_blank" rel="noopener" style="font-size:.8rem;color:var(--dorado-oscuro);text-decoration:underline"><i class="fa-solid fa-map-location-dot"></i> Ver en Google Maps</a></div>` : ""}
      </div>
      <div style="display:flex;gap:.5rem">
        <button type="button" class="btn btn-borde btn-sm" data-editar-dir="${d.id_direccion}">
          <i class="fa-solid fa-pen"></i> Editar
        </button>
        <button type="button" class="btn btn-borde btn-sm" style="color:var(--rojo,#c0392b);border-color:var(--rojo,#c0392b)" data-eliminar-dir="${d.id_direccion}">
          <i class="fa-solid fa-trash"></i> Eliminar
        </button>
      </div>
    </div>
  `).join("");

  listaPedidos.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">
      <p class="ayuda" style="margin:0">Guarda tus direcciones frecuentes para elegirlas con un clic al hacer un pedido.</p>
      <button type="button" class="btn btn-dorado btn-sm" id="btnNuevaDireccion">
        <i class="fa-solid fa-plus"></i> Nueva dirección
      </button>
    </div>
    <div id="contenedorFormDireccion" hidden style="margin-bottom:1.5rem"></div>
    ${direcciones.length > 0 ? tarjetas : '<div class="carrito-vacio"><p>Aún no tienes direcciones guardadas.</p></div>'}
  `;

  document.getElementById("btnNuevaDireccion").addEventListener("click", () => abrirFormularioDireccion(null));
}

function abrirFormularioDireccion(dirEditar) {
  const contenedor = document.getElementById("contenedorFormDireccion");
  const d = dirEditar || { alias: "Casa", direccion: "", referencia: "", latitud: -12.1111, longitud: -76.9892 };
  coordsActuales = {
    lat: d.latitud || -12.1111,
    lng: d.longitud || -76.9892,
  };

  contenedor.hidden = false;
  contenedor.innerHTML = `
    <form class="panel" id="formDirUsuario" style="background:#fdfbf8;border:1px solid #eadfce">
      <h3>${dirEditar ? "Editar dirección (" + esc(d.alias) + ")" : "Agregar nueva dirección"}</h3>
      
      <label for="fAlias">Nombre de la dirección (ej. Casa, Trabajo)</label>
      <div style="display:flex;gap:.4rem;margin-bottom:.5rem;flex-wrap:wrap">
        <button type="button" class="chip btn-alias-rapido" data-alias="Casa">🏠 Casa</button>
        <button type="button" class="chip btn-alias-rapido" data-alias="Trabajo">🏢 Trabajo</button>
        <button type="button" class="chip btn-alias-rapido" data-alias="Casa de Mamá">💐 Casa de Mamá</button>
      </div>
      <input type="text" id="fAlias" value="${esc(d.alias || "Casa")}" maxlength="60" required>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.8rem">
        <label style="margin:0">Ubicación en el mapa</label>
        <button type="button" id="btnGpsModal" class="btn btn-borde btn-sm" style="padding:4px 10px;font-size:.8rem">
          <i class="fa-solid fa-crosshairs"></i> Usar mi GPS
        </button>
      </div>
      <div id="mapaMisDirecciones" style="height:230px;width:100%;border-radius:8px;margin:.5rem 0;border:1px solid #d5c7b8;z-index:1"></div>
      <small class="ayuda" style="display:block;margin-bottom:.6rem">Haz clic en el mapa o arrastra el marcador para autocompletar la calle.</small>

      <label for="fDireccion">Dirección exacta</label>
      <input type="text" id="fDireccion" value="${esc(d.direccion || "")}" placeholder="Av. / Calle / Número / Distrito" maxlength="200" required>

      <label for="fReferencia">Referencia (opcional)</label>
      <input type="text" id="fReferencia" value="${esc(d.referencia || "")}" placeholder="Ej. Frente al parque, piso 2" maxlength="150">

      <p class="aviso-carrito" id="errorFormDir" hidden></p>

      <div style="display:flex;gap:.6rem;margin-top:1rem">
        <button type="submit" class="btn btn-dorado" id="btnGuardarDir">${dirEditar ? "Guardar cambios" : "Guardar dirección"}</button>
        <button type="button" class="btn btn-borde" id="btnCancelarDir">Cancelar</button>
      </div>
    </form>
  `;

  contenedor.querySelectorAll(".btn-alias-rapido").forEach((b) =>
    b.addEventListener("click", () => {
      document.getElementById("fAlias").value = b.dataset.alias;
    })
  );

  document.getElementById("btnCancelarDir").addEventListener("click", () => {
    if (mapaModal) {
      mapaModal.remove();
      mapaModal = null;
    }
    contenedor.hidden = true;
    contenedor.innerHTML = "";
  });

  document.getElementById("formDirUsuario").addEventListener("submit", async (e) => {
    e.preventDefault();
    const alias = document.getElementById("fAlias").value.trim() || "Casa";
    const textoDir = document.getElementById("fDireccion").value.trim();
    const ref = document.getElementById("fReferencia").value.trim();
    const errCaja = document.getElementById("errorFormDir");

    if (textoDir.length < 5) {
      errCaja.textContent = "Escribe una dirección válida o selecciónala en el mapa.";
      errCaja.hidden = false;
      return;
    }

    const payload = {
      usuario: { id_usuario: clienteActual.id_usuario },
      alias,
      direccion: textoDir,
      referencia: ref || null,
      latitud: coordsActuales.lat,
      longitud: coordsActuales.lng,
    };

    try {
      if (dirEditar) {
        await Api.actualizarDireccion(dirEditar.id_direccion, payload);
      } else {
        await Api.crearDireccion(payload);
      }
      if (mapaModal) {
        mapaModal.remove();
        mapaModal = null;
      }
      await recargarDirecciones();
      dibujarDirecciones();
    } catch (err) {
      errCaja.textContent = err.message || "No se pudo guardar la dirección.";
      errCaja.hidden = false;
    }
  });

  iniciarMapaFormulario();
}

function iniciarMapaFormulario() {
  if (typeof L === "undefined") return;
  if (mapaModal) {
    mapaModal.remove();
    mapaModal = null;
  }

  mapaModal = L.map("mapaMisDirecciones").setView([coordsActuales.lat, coordsActuales.lng], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
  }).addTo(mapaModal);

  marcadorModal = L.marker([coordsActuales.lat, coordsActuales.lng], { draggable: true }).addTo(mapaModal);

  async function geocodificarInverso(lat, lng) {
    coordsActuales = { lat, lng };
    const inputDir = document.getElementById("fDireccion");
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.display_name) {
          inputDir.value = data.display_name.slice(0, 190);
        }
      }
    } catch (e) {}
  }

  mapaModal.on("click", (e) => {
    marcadorModal.setLatLng(e.latlng);
    geocodificarInverso(e.latlng.lat, e.latlng.lng);
  });

  marcadorModal.on("dragend", () => {
    const pos = marcadorModal.getLatLng();
    geocodificarInverso(pos.lat, pos.lng);
  });

  const btnGps = document.getElementById("btnGpsModal");
  if (btnGps && navigator.geolocation) {
    btnGps.addEventListener("click", () => {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        mapaModal.setView([latitude, longitude], 17);
        marcadorModal.setLatLng([latitude, longitude]);
        geocodificarInverso(latitude, longitude);
      });
    });
  }
}

async function recargarDirecciones() {
  const todas = await Api.direccionesDe(clienteActual.id_usuario);
  direcciones = todas.filter((d) => !/recojo en el local/i.test(d.direccion));
}



function dibujarPerfilUsuario() {
  listaPedidos.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem">
      <form class="panel" id="formDatosPersonales" novalidate style="box-shadow:none;border:1px solid var(--gris-borde)">
        <h3>Datos personales</h3>
        <label for="pNombre">Nombre</label>
        <input type="text" id="pNombre" value="${esc(clienteActual.nombre || "")}" maxlength="60" required>

        <label for="pApellido">Apellido</label>
        <input type="text" id="pApellido" value="${esc(clienteActual.apellido || "")}" maxlength="60" required>

        <label for="pCorreo">Correo electrónico</label>
        <input type="email" id="pCorreo" value="${esc(clienteActual.correo || "")}" maxlength="100" required>

        <label for="pTelefono">Teléfono (9 dígitos)</label>
        <input type="tel" id="pTelefono" value="${esc(clienteActual.telefono || "")}" maxlength="9">

        <p class="aviso-carrito" id="msgDatosError" hidden style="margin-top:1rem;margin-bottom:0"></p>
        <p class="aviso-ok" id="msgDatosOk" hidden></p>

        <button type="submit" class="btn btn-dorado btn-bloque" style="margin-top:1.2rem">Guardar mis datos</button>
      </form>

      <form class="panel" id="formCambiarClave" novalidate style="box-shadow:none;border:1px solid var(--gris-borde)">
        <h3>Cambiar contraseña</h3>
        <label for="pClaveActual">Contraseña actual</label>
        <input type="password" id="pClaveActual" placeholder="Ingresa tu contraseña actual" required>

        <label for="pClaveNueva">Nueva contraseña</label>
        <input type="password" id="pClaveNueva" placeholder="Mínimo 6 caracteres" required>

        <label for="pClaveConfirmar">Confirmar nueva contraseña</label>
        <input type="password" id="pClaveConfirmar" placeholder="Repite la nueva contraseña" required>

        <p class="aviso-carrito" id="msgClaveError" hidden style="margin-top:1rem;margin-bottom:0"></p>
        <p class="aviso-ok" id="msgClaveOk" hidden></p>

        <button type="submit" class="btn btn-borde btn-bloque" style="margin-top:1.2rem">Actualizar contraseña</button>
      </form>
    </div>
  `;

  document.getElementById("formDatosPersonales").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("msgDatosError");
    const ok = document.getElementById("msgDatosOk");
    err.hidden = true;
    ok.hidden = true;

    const nombre = document.getElementById("pNombre").value.trim();
    const apellido = document.getElementById("pApellido").value.trim();
    const correo = document.getElementById("pCorreo").value.trim();
    const telefono = document.getElementById("pTelefono").value.trim();

    if (!nombre || !apellido) {
      err.textContent = "Completa tu nombre y apellido.";
      err.hidden = false;
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
      err.textContent = "Ingresa un correo electrónico válido.";
      err.hidden = false;
      return;
    }
    if (telefono && !/^\d{9}$/.test(telefono)) {
      err.textContent = "El teléfono debe tener 9 dígitos numéricos.";
      err.hidden = false;
      return;
    }

    try {
      const actualizado = await Api.actualizarUsuario(clienteActual.id_usuario, {
        nombre,
        apellido,
        correo,
        telefono,
        estado: clienteActual.estado,
        rol: clienteActual.rol,
      });
      clienteActual = actualizado;
      Sesion.guardarCache(actualizado);
      if (typeof actualizarBarraSesion === "function") {
        actualizarBarraSesion();
      }
      ok.textContent = "Tus datos personales fueron actualizados con éxito.";
      ok.hidden = false;
    } catch (error) {
      err.textContent = error.message || "No se pudieron actualizar tus datos.";
      err.hidden = false;
    }
  });

  document.getElementById("formCambiarClave").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("msgClaveError");
    const ok = document.getElementById("msgClaveOk");
    err.hidden = true;
    ok.hidden = true;

    const actual = document.getElementById("pClaveActual").value;
    const nueva = document.getElementById("pClaveNueva").value;
    const confirmar = document.getElementById("pClaveConfirmar").value;

    if (!actual) {
      err.textContent = "Ingresa tu contraseña actual.";
      err.hidden = false;
      return;
    }
    if (nueva.length < 6) {
      err.textContent = "La nueva contraseña debe tener al menos 6 caracteres.";
      err.hidden = false;
      return;
    }
    if (nueva !== confirmar) {
      err.textContent = "La nueva contraseña y su confirmación no coinciden.";
      err.hidden = false;
      return;
    }

    try {
      await Api.cambiarContrasena(clienteActual.id_usuario, actual, nueva);
      e.target.reset();
      ok.textContent = "Tu contraseña se actualizó correctamente.";
      ok.hidden = false;
    } catch (error) {
      err.textContent = error.message || "Error al cambiar la contraseña.";
      err.hidden = false;
    }
  });
}

listaPedidos.addEventListener("click", async (e) => {
  const btnEditar = e.target.closest("[data-editar-dir]");
  const btnEliminar = e.target.closest("[data-eliminar-dir]");

  if (btnEditar) {
    const id = Number(btnEditar.dataset.editarDir);
    const encontrada = direcciones.find((d) => d.id_direccion === id);
    if (encontrada) abrirFormularioDireccion(encontrada);
  }

  if (btnEliminar) {
    const id = Number(btnEliminar.dataset.eliminarDir);
    const encontrada = direcciones.find((d) => d.id_direccion === id);
    if (!encontrada) return;
    if (!confirm(`¿Seguro que deseas eliminar la dirección "${encontrada.alias || encontrada.direccion}"?`)) return;
    try {
      await Api.eliminarDireccion(id);
      await recargarDirecciones();
      dibujarDirecciones();
    } catch (err) {
      alert(err.message || "No se pudo eliminar la dirección porque está asociada a un pedido realizado.");
    }
  }
});

async function iniciar() {
  dibujarPestanas();
  try {
    clienteActual = await Sesion.clienteActual();
    const [listaPed] = await Promise.all([
      pedir("/pedido/listarPorUsuario/" + clienteActual.id_usuario),
      recargarDirecciones(),
    ]);
    pedidos = listaPed.sort((a, b) => b.id_pedido - a.id_pedido);
    dibujarVista();
  } catch (error) {
    console.error(error);
    listaPedidos.innerHTML = '<p class="mensaje-estado error">No pudimos cargar tu información. ' + esc(error.message) + "</p>";
  }
}

pestanas.addEventListener("click", (e) => {
  const boton = e.target.closest("[data-grupo]");
  if (!boton) return;
  grupoActivo = boton.dataset.grupo;
  dibujarPestanas();
  dibujarVista();
});

iniciar();