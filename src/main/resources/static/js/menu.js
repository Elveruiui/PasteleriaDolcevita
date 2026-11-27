const contenedor = document.getElementById("listaProductos");
const chips = document.getElementById("chipsCategorias");
let todosLosProductos = [];
let categoriaActiva = new URLSearchParams(location.search).get("categoria") || "todas";
let textoBusqueda = "";
let ordenActivo = "defecto";
let soloDisponibles = false;

const ORDEN_TAMANO = { "PEQUEÑO": 1, "MEDIANO": 2, "GRANDE": 3 };

function montarHerramientasMenu() {
  if (document.getElementById("menuHerramientas")) return;
  const barra = document.createElement("div");
  barra.id = "menuHerramientas";
  barra.className = "menu-herramientas";
  barra.innerHTML = `
    <div class="menu-busqueda">
      <i class="fa-solid fa-magnifying-glass"></i>
      <input type="text" id="buscarMenu" placeholder="Buscar tortas, postres o ingredientes...">
    </div>
    <div class="menu-orden">
      <select id="ordenMenu" aria-label="Ordenar productos">
        <option value="defecto">Orden predeterminado</option>
        <option value="precio_asc">Precio: menor a mayor</option>
        <option value="precio_desc">Precio: mayor a menor</option>
        <option value="nombre_asc">Nombre: A - Z</option>
      </select>
    </div>
    <label class="menu-check">
      <input type="checkbox" id="chkDisponibles"> Solo disponibles
    </label>
  `;
  chips.insertAdjacentElement("afterend", barra);

  document.getElementById("buscarMenu").addEventListener("input", (e) => {
    textoBusqueda = e.target.value.trim().toLowerCase();
    mostrarProductos();
  });
  document.getElementById("ordenMenu").addEventListener("change", (e) => {
    ordenActivo = e.target.value;
    mostrarProductos();
  });
  document.getElementById("chkDisponibles").addEventListener("change", (e) => {
    soloDisponibles = e.target.checked;
    mostrarProductos();
  });
}

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
  const filtrados = todosLosProductos.filter((p) => {
    const pasaCat = categoriaActiva === "todas" || String(p.categoria && p.categoria.id_categoria) === categoriaActiva;
    const pasaTexto = !textoBusqueda ||
      (p.nombre || "").toLowerCase().includes(textoBusqueda) ||
      (p.descripcion || "").toLowerCase().includes(textoBusqueda);
    return pasaCat && pasaTexto;
  });

  let grupos = agruparPorNombre(filtrados);
  if (soloDisponibles) {
    grupos = grupos.filter((variantes) => variantes.some((v) => v.stock > 0));
  }

  const precioMinimoDe = (variantes) => Math.min(...variantes.map((v) => v.precio));
  if (ordenActivo === "precio_asc") {
    grupos.sort((a, b) => precioMinimoDe(a) - precioMinimoDe(b));
  } else if (ordenActivo === "precio_desc") {
    grupos.sort((a, b) => precioMinimoDe(b) - precioMinimoDe(a));
  } else if (ordenActivo === "nombre_asc") {
    grupos.sort((a, b) => a[0].nombre.localeCompare(b[0].nombre, "es"));
  }

  if (grupos.length === 0) {
    contenedor.innerHTML = '<p class="mensaje-estado">No encontramos productos que coincidan con tu búsqueda.</p>';
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
    montarHerramientasMenu();
    mostrarProductos();
  } catch (error) {
    console.error(error);
    contenedor.innerHTML =
      '<p class="mensaje-estado error">No pudimos cargar los productos. Revisa que el servidor y la base de datos estén encendidos.</p>';
  }
}
iniciar();