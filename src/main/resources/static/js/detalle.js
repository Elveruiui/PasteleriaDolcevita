const zona = document.getElementById("detalleProducto");
const idProducto = new URLSearchParams(location.search).get("id");
const ORDEN_TAMANO = { "PEQUEÑO": 1, "MEDIANO": 2, "GRANDE": 3 };

let variantesProducto = [];
let varianteSeleccionada = null;
let datosResenas = { promedio: 0, total: 0, resenas: [] };
let elegibilidad = null;
let usuarioSesion = null;
let calificacionElegida = 5;

function nombreTamanoBonito(t) {
  const s = String(t || "MEDIANO").toUpperCase();
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function estrellasHtml(valor) {
  const redondeado = Math.round(Number(valor || 0));
  let html = '<span class="estrellas">';
  for (let i = 1; i <= 5; i++) {
    html += `<i class="${i <= redondeado ? "fa-solid" : "fa-regular"} fa-star"></i>`;
  }
  return html + "</span>";
}

function fechaResena(valor) {
  if (!valor) return "";
  if (Array.isArray(valor)) {
    const [a, m, d] = valor;
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;
  }
  const [a, m, d] = String(valor).split("T")[0].split("-");
  return `${d}/${m}/${a}`;
}

function bloqueResenasHtml() {
  const listaHtml = datosResenas.resenas.length > 0
    ? datosResenas.resenas.map((r) => `
        <div class="resena-item">
          <div class="resena-cab">
            <strong>${esc(r.autor)} ${r.tamano ? `<small class="ayuda">· ${esc(nombreTamanoBonito(r.tamano))}</small>` : ""}</strong>
            <span class="ayuda">${fechaResena(r.fecha)}</span>
          </div>
          <div style="margin-bottom:.3rem">${estrellasHtml(r.calificacion)}</div>
          <p style="font-size:.9rem;color:var(--chocolate-claro)">${esc(r.comentario)}</p>
        </div>`).join("")
    : '<p class="ayuda" style="padding:1rem 0">Todavía no hay opiniones para este producto. ¡Sé el primero en calificarlo después de tu compra!</p>';

  let formularioHtml = "";
  if (!usuarioSesion) {
    formularioHtml = `
      <div class="panel">
        <h3>Deja tu opinión</h3>
        <p class="ayuda">Inicia sesión para calificar los productos de tus pedidos entregados.</p>
        <a class="btn btn-borde btn-sm" style="margin-top:1rem" href="login.html?redirect=${encodeURIComponent("detalle-producto.html?id=" + varianteSeleccionada.id_producto)}">Iniciar sesión</a>
      </div>`;
  } else if (elegibilidad && elegibilidad.puedeResenar) {
    calificacionElegida = elegibilidad.calificacion || 5;
    const textoInicial = elegibilidad.comentario || "";
    formularioHtml = `
      <form class="panel" id="formResena" novalidate>
        <h3>${elegibilidad.yaReseno ? "Editar tu opinión" : "Escribe tu opinión"}</h3>
        <label>Tu calificación</label>
        <div class="selector-estrellas" id="selectorEstrellas">
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-estrella="${n}" class="${n <= calificacionElegida ? "activa" : ""}" aria-label="${n} estrellas"><i class="fa-solid fa-star"></i></button>`).join("")}
        </div>
        <label for="textoResena">Tu comentario</label>
        <textarea id="textoResena" maxlength="500" placeholder="Cuéntanos qué te pareció el sabor, la presentación y la entrega...">${esc(textoInicial)}</textarea>
        <p class="aviso-carrito" id="errorResena" hidden style="margin-top:.8rem;margin-bottom:0"></p>
        <p class="aviso-ok" id="okResena" hidden></p>
        <button type="submit" class="btn btn-dorado btn-bloque" id="btnEnviarResena" style="margin-top:1rem">
          ${elegibilidad.yaReseno ? "Actualizar reseña" : "Publicar reseña"}
        </button>
      </form>`;
  } else {
    formularioHtml = `
      <div class="panel">
        <h3>Deja tu opinión</h3>
        <p class="ayuda">Podrás calificar este producto en cuanto recibas un pedido entregado que lo incluya.</p>
      </div>`;
  }

  return `
    <section class="seccion-resenas">
      <div class="grid-resenas">
        <div class="panel">
          <h3>Opiniones de clientes (${datosResenas.total})</h3>
          ${listaHtml}
        </div>
        ${formularioHtml}
      </div>
    </section>`;
}

function dibujarDetalle() {
  const p = varianteSeleccionada;
  const agotado = p.stock <= 0;
  const categoria = p.categoria ? p.categoria.nombre : "";
  document.title = p.nombre + " | DOLCEVITA";
  document.getElementById("migaProducto").textContent = p.nombre;
  document.getElementById("migaCategoria").textContent = categoria;

  const botonesTamano = variantesProducto.map((v) => {
    const activo = v.id_producto === p.id_producto;
    const sinStock = v.stock <= 0;
    return `<button type="button" class="chip ${activo ? "activo" : ""}" data-id-variante="${v.id_producto}" style="padding:.5rem 1rem;border-radius:8px;cursor:pointer">
      <strong>${esc(nombreTamanoBonito(v.tamano))}</strong> · ${formatearPrecio(v.precio)} ${sinStock ? "(Agotado)" : ""}
    </button>`;
  }).join("");

  const resumenRating = datosResenas.total > 0
    ? `<div class="resumen-estrellas">${estrellasHtml(datosResenas.promedio)} <strong>${datosResenas.promedio.toFixed(1)}</strong> <span class="ayuda">(${datosResenas.total} ${datosResenas.total === 1 ? "opinión" : "opiniones"})</span></div>`
    : `<div class="resumen-estrellas"><span class="ayuda">Sin calificaciones aún</span></div>`;

  zona.innerHTML = `
    <div class="detalle">
      <div><img class="principal" id="fotoProducto" src="${urlImagen(p.imagen)}" alt="${esc(p.nombre)}"></div>
      <div>
        <span class="ayuda" style="letter-spacing:.15em;text-transform:uppercase;font-weight:600;color:var(--dorado-oscuro)">${esc(categoria)}</span>
        <h1>${esc(p.nombre)}</h1>
        ${resumenRating}
        <div class="precio-g" id="precioActual">${formatearPrecio(p.precio)}</div>
        <p class="ayuda" style="font-size:.92rem;margin:.8rem 0">${esc(p.descripcion)}</p>
        
        <label style="display:block;margin:.8rem 0 .4rem;font-weight:600">Tamaño disponible</label>
        <div id="selectorTamano" style="display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:1rem">
          ${botonesTamano}
        </div>

        <p class="ayuda" id="stockActual">${agotado ? '<strong style="color:var(--rojo)">Tamaño agotado</strong>' : "Disponibles en tamaño " + esc(nombreTamanoBonito(p.tamano)) + ": " + p.stock + " unidades"}</p>
        <label>Cantidad</label>
        <div class="cantidad">
          <button type="button" id="menos" aria-label="Quitar una unidad">−</button>
          <span id="cantidad">1</span>
          <button type="button" id="mas" aria-label="Agregar una unidad">+</button>
        </div>
        <button class="btn btn-dorado btn-bloque" id="agregar" style="margin-top:1.4rem" ${agotado ? "disabled" : ""}>
          <i class="fa-solid fa-bag-shopping"></i> Agregar al pedido (${esc(nombreTamanoBonito(p.tamano))})
        </button>
        <p class="aviso-ok" id="avisoAgregado" hidden>Producto agregado. <a href="carrito.html" style="text-decoration:underline">Ver mi carrito</a></p>
      </div>
    </div>
    ${bloqueResenasHtml()}`;

  conRespaldo(document.getElementById("fotoProducto"));
  activarEventos(p);
}

function activarEventos(p) {
  let cantidad = 1;
  const etiqueta = document.getElementById("cantidad");

  document.getElementById("selectorTamano").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-id-variante]");
    if (!btn) return;
    const idVar = Number(btn.dataset.idVariante);
    const encontrada = variantesProducto.find((v) => v.id_producto === idVar);
    if (encontrada) {
      varianteSeleccionada = encontrada;
      dibujarDetalle();
    }
  });

  document.getElementById("menos").addEventListener("click", () => {
    if (cantidad > 1) etiqueta.textContent = --cantidad;
  });
  document.getElementById("mas").addEventListener("click", () => {
    if (cantidad < p.stock) etiqueta.textContent = ++cantidad;
  });
  document.getElementById("agregar").addEventListener("click", () => {
    Carrito.agregar(p.id_producto, cantidad);
    document.getElementById("avisoAgregado").hidden = false;
  });

  const selectorEstrellas = document.getElementById("selectorEstrellas");
  if (selectorEstrellas) {
    selectorEstrellas.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-estrella]");
      if (!btn) return;
      calificacionElegida = Number(btn.dataset.estrella);
      selectorEstrellas.querySelectorAll("[data-estrella]").forEach((b) => {
        b.classList.toggle("activa", Number(b.dataset.estrella) <= calificacionElegida);
      });
    });
  }

  const formResena = document.getElementById("formResena");
  if (formResena) {
    formResena.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = document.getElementById("errorResena");
      const ok = document.getElementById("okResena");
      const btn = document.getElementById("btnEnviarResena");
      err.hidden = true;
      ok.hidden = true;

      const comentario = document.getElementById("textoResena").value.trim();
      if (comentario.length < 4) {
        err.textContent = "Escribe un comentario de al menos 4 caracteres.";
        err.hidden = false;
        return;
      }

      btn.disabled = true;
      try {
        await Api.guardarResena({
          idProducto: varianteSeleccionada.id_producto,
          calificacion: calificacionElegida,
          comentario,
        });
        [datosResenas, elegibilidad] = await Promise.all([
          Api.resenasDeProducto(varianteSeleccionada.id_producto),
          Api.elegibilidadResena(varianteSeleccionada.id_producto),
        ]);
        dibujarDetalle();
        const okNuevo = document.getElementById("okResena");
        if (okNuevo) {
          okNuevo.textContent = "¡Gracias! Tu reseña ha sido guardada.";
          okNuevo.hidden = false;
        }
      } catch (error) {
        err.textContent = error.message || "No se pudo guardar tu reseña.";
        err.hidden = false;
        btn.disabled = false;
      }
    });
  }
}

async function iniciar() {
  if (!idProducto) {
    zona.innerHTML = '<p class="mensaje-estado">No se indicó qué producto mostrar. <a href="menu.html" style="text-decoration:underline">Volver al menú</a></p>';
    return;
  }
  try {
    const [productoBase, todos, resenas, usuario] = await Promise.all([
      Api.producto(idProducto),
      Api.productos(),
      Api.resenasDeProducto(idProducto).catch(() => ({ promedio: 0, total: 0, resenas: [] })),
      Sesion.obtener(),
    ]);
    usuarioSesion = usuario;
    datosResenas = resenas || { promedio: 0, total: 0, resenas: [] };

    if (usuarioSesion) {
      elegibilidad = await Api.elegibilidadResena(productoBase.id_producto).catch(() => null);
    }

    variantesProducto = todos
      .filter((x) => x.estado === 1 && x.nombre.trim().toLowerCase() === productoBase.nombre.trim().toLowerCase())
      .sort((a, b) => (ORDEN_TAMANO[a.tamano] || 2) - (ORDEN_TAMANO[b.tamano] || 2));

    if (variantesProducto.length === 0) variantesProducto = [productoBase];
    varianteSeleccionada = variantesProducto.find((v) => v.id_producto === productoBase.id_producto) || variantesProducto[0];
    dibujarDetalle();
  } catch (error) {
    console.error(error);
    zona.innerHTML = '<p class="mensaje-estado error">No encontramos este producto. <a href="menu.html" style="text-decoration:underline">Volver al menú</a></p>';
  }
}
iniciar();