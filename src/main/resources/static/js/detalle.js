const zona = document.getElementById("detalleProducto");
const idProducto = new URLSearchParams(location.search).get("id");
const ORDEN_TAMANO = { "PEQUEÑO": 1, "MEDIANO": 2, "GRANDE": 3 };

let variantesProducto = [];
let varianteSeleccionada = null;

function nombreTamanoBonito(t) {
  const s = String(t || "MEDIANO").toUpperCase();
  return s.charAt(0) + s.slice(1).toLowerCase();
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

  zona.innerHTML = `
    <div class="detalle">
      <div><img class="principal" id="fotoProducto" src="${urlImagen(p.imagen)}" alt="${esc(p.nombre)}"></div>
      <div>
        <span class="ayuda" style="letter-spacing:.15em;text-transform:uppercase;font-weight:600;color:var(--dorado-oscuro)">${esc(categoria)}</span>
        <h1>${esc(p.nombre)}</h1>
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
    </div>`;

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
}

async function iniciar() {
  if (!idProducto) {
    zona.innerHTML = '<p class="mensaje-estado">No se indicó qué producto mostrar. <a href="menu.html" style="text-decoration:underline">Volver al menú</a></p>';
    return;
  }
  try {
    const [productoBase, todos] = await Promise.all([Api.producto(idProducto), Api.productos()]);
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