const contenedor = document.getElementById("listaProductos");
const chips = document.getElementById("chipsCategorias");
let todosLosProductos = [];
let categoriaActiva = new URLSearchParams(location.search).get("categoria") || "todas";

const ORDEN_TAMANO = { "PEQUEÑO": 1, "MEDIANO": 2, "GRANDE": 3 };

function agruparPorNombre(lista) {
  const mapa = new Map();
  lista.forEach((p) => {
    const clave = p.nombre.trim().toLowerCase();
    if (!mapa.has(clave)) {
      mapa.set(clave, []);
    }
    mapa.get(clave).push(p);
  });
  return Array.from(mapa.values()).map((variantes) => {
    variantes.sort((a, b) => (ORDEN_TAMANO[a.tamano] || 2) - (ORDEN_TAMANO[b.tamano] || 2));
    return variantes;
  });
}

function tarjetaProducto(variantes) {
  const principal = variantes.find((v) => v.stock > 0) || variantes[0];
  const stockTotal = variantes.reduce((acc, v) => acc + v.stock, 0);
  const agotado = stockTotal <= 0;
  const categoria = principal.categoria ? principal.categoria.nombre : "";
  const precioMin = Math.min(...variantes.map((v) => v.precio));
  const precioMax = Math.max(...variantes.map((v) => v.precio));
  const textoPrecio = precioMin === precioMax
    ? formatearPrecio(precioMin)
    : "Desde " + formatearPrecio(precioMin);

  const etiquetasTamanos = variantes
    .map((v) => (v.tamano || "MEDIANO").charAt(0) + (v.tamano || "MEDIANO").slice(1).toLowerCase())
    .join(" · ");

  return `
    <article class="card-prod">
      <img src="${urlImagen(principal.imagen)}" alt="${esc(principal.nombre)}" loading="lazy">
      <div class="cuerpo">
        <h3>${esc(principal.nombre)}</h3>
        <div class="sub">${esc(categoria)} · <span style="color:var(--dorado-oscuro)">${esc(etiquetasTamanos)}</span>${agotado ? ' · <span style="color:var(--rojo)">Agotado</span>' : ""}</div>
        <p class="desc">${esc(principal.descripcion)}</p>
        <div class="pie">
          <span class="precio">${textoPrecio}</span>
          <a href="detalle-producto.html?id=${principal.id_producto}">Elegir tamaño →</a>
        </div>
      </div>
    </article>`;
}

function mostrarProductos() {
  const filtrados = todosLosProductos.filter(
    (p) => categoriaActiva === "todas" || String(p.categoria && p.categoria.id_categoria) === categoriaActiva
  );
  const grupos = agruparPorNombre(filtrados);
  if (grupos.length === 0) {
    contenedor.innerHTML = '<p class="mensaje-estado">No hay productos en esta categoría por ahora.</p>';
    return;
  }
  contenedor.innerHTML = grupos.map(tarjetaProducto).join("");
  contenedor.querySelectorAll("img").forEach(conRespaldo);
}

function mostrarChips(categorias) {
  const activas = categorias.filter((c) => c.estado === 1);
  chips.innerHTML =
    `<button class="chip" data-id="todas">Todos</button>` +
    activas.map((c) => `<button class="chip" data-id="${c.id_categoria}">${esc(c.nombre)}</button>`).join("");
  marcarChipActivo();
  chips.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    categoriaActiva = chip.dataset.id;
    marcarChipActivo();
    mostrarProductos();
  });
}

function marcarChipActivo() {
  chips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("activo", c.dataset.id === categoriaActiva));
}

async function iniciar() {
  try {
    const [categorias, productos] = await Promise.all([Api.categorias(), Api.productos()]);
    todosLosProductos = productos.filter((p) => p.estado === 1);
    mostrarChips(categorias);
    mostrarProductos();
  } catch (error) {
    console.error(error);
    contenedor.innerHTML =
      '<p class="mensaje-estado error">No pudimos cargar los productos. Revisa que el servidor y la base de datos estén encendidos.</p>';
  }
}
iniciar();