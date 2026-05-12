/* =========================================================
   Catálogo de vehículos — filtros sidebar estilo Mercado Libre.

   - Cargamos UNA sola vez todos los vehículos del backend.
   - Las listas categóricas (marca, modelo, ubicación, combustible,
     transmisión) se calculan client-side con su conteo.
   - Cada click sobre un filtro re-renderiza la grilla al instante,
     sin pegar de nuevo al backend.
   - Mantenemos selección de autos para comparar y ❤ favoritos como
     antes.
   ========================================================= */

const FILTER_FIELDS = ['marca', 'modelo', 'ubicacion', 'tipoCombustible', 'transmision'];

// Cuántos items mostrar antes de "Mostrar más" en categorías largas.
const DEFAULT_VISIBLE = 6;

let allCars = [];
let selectedCars = [];
let favoritosSet = new Set();

// Estado de los filtros activos. Para campos categóricos guardamos un Set
// con los valores elegidos. Para los numéricos, un objeto {min, max}.
const filtros = {
    marca: new Set(),
    modelo: new Set(),
    ubicacion: new Set(),
    tipoCombustible: new Set(),
    transmision: new Set(),
    search: '',
    precioMin: null,
    precioMax: null,
    anioMin: null,
    anioMax: null,
    kmMax: null,
};

// Qué grupos categóricos están "expandidos" (mostrar todos los items).
const expandidos = new Set();


document.addEventListener('DOMContentLoaded', async () => {
    renderNavbar('cars');
    await cargarFavoritos();
    await loadCars();
    bindFiltrosListeners();
    bindCompareBtn();
});


/* =========================================================
   Carga inicial
   ========================================================= */

async function loadCars() {
    const container = document.getElementById('carsContainer');
    container.innerHTML = Components.loading();
    document.getElementById('resultsCount').textContent = 'Cargando...';

    try {
        const cars = await apiCall('/vehiculos');
        allCars = Array.isArray(cars) ? cars : [];
        renderFiltrosCategoricos();
        aplicarFiltrosYRender();
    } catch (error) {
        console.error('Error cargando autos:', error);
        container.innerHTML = Components.emptyState({
            icon: '⚠️',
            title: 'No se pudieron cargar los vehículos',
            message: `${error.message}. Verificá que el backend esté corriendo.`,
        });
        document.getElementById('resultsCount').textContent = '';
    }
}

async function cargarFavoritos() {
    if (!Auth.isLoggedIn() || Auth.getRol() !== 'comprador') return;
    try {
        const ids = await apiCall('/favoritos/ids');
        favoritosSet = new Set((ids || []).map(String));
    } catch (err) {
        console.warn('No se pudieron cargar favoritos:', err.message);
    }
}


/* =========================================================
   Render del sidebar (listas categóricas con conteos)
   ========================================================= */

/**
 * Calcula los conteos de cada valor único para un campo dado, ordenados
 * de mayor a menor frecuencia. Devuelve [{ value, count }, ...].
 */
function calcularConteos(campo, cars) {
    const map = new Map();
    cars.forEach((car) => {
        const v = car[campo];
        if (!v) return;
        const key = String(v).trim();
        if (!key) return;
        map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/**
 * Pinta todas las listas categóricas del sidebar. Los conteos se calculan
 * sobre `allCars` (no sobre el filtrado actual, para que los filtros queden
 * fijos al cambiar selección — comportamiento estándar de Mercado Libre).
 */
function renderFiltrosCategoricos() {
    FILTER_FIELDS.forEach((campo) => {
        const ul = document.querySelector(`[data-filter-list="${campo}"]`);
        if (!ul) return;

        const conteos = calcularConteos(campo, allCars);
        const expandido = expandidos.has(campo);
        const visible = expandido ? conteos : conteos.slice(0, DEFAULT_VISIBLE);
        const seleccionados = filtros[campo];

        ul.innerHTML = visible.map((c) => {
            const activo = seleccionados.has(c.value);
            return `
                <li>
                    <button type="button"
                            class="filter-item ${activo ? 'is-active' : ''}"
                            data-filter="${escapeHtml(campo)}"
                            data-value="${escapeHtml(c.value)}">
                        <span class="filter-item-label">${escapeHtml(c.value)}</span>
                        <span class="filter-item-count">${c.count.toLocaleString('es-AR')}</span>
                    </button>
                </li>`;
        }).join('');

        // "Mostrar más" / "Mostrar menos" cuando hay overflow
        const moreBtn = document.querySelector(`[data-toggle-more="${campo}"]`);
        if (moreBtn) {
            if (conteos.length > DEFAULT_VISIBLE) {
                moreBtn.classList.remove('hidden');
                moreBtn.textContent = expandido
                    ? 'Mostrar menos'
                    : `Mostrar más (${conteos.length - DEFAULT_VISIBLE})`;
            } else {
                moreBtn.classList.add('hidden');
            }
        }
    });

    // Engancha los listeners (re-binding seguro porque los nodos son nuevos).
    document.querySelectorAll('.filter-item').forEach((btn) => {
        btn.addEventListener('click', () => {
            const campo = btn.dataset.filter;
            const valor = btn.dataset.value;
            toggleFiltroCategorico(campo, valor);
        });
    });

    document.querySelectorAll('[data-toggle-more]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const campo = btn.dataset.toggleMore;
            if (expandidos.has(campo)) expandidos.delete(campo);
            else expandidos.add(campo);
            renderFiltrosCategoricos();
        });
    });
}

function toggleFiltroCategorico(campo, valor) {
    const set = filtros[campo];
    if (set.has(valor)) set.delete(valor);
    else set.add(valor);
    renderFiltrosCategoricos();
    aplicarFiltrosYRender();
}


/* =========================================================
   Listeners de los inputs (search, rangos numéricos)
   ========================================================= */

function bindFiltrosListeners() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', () => {
        filtros.search = searchInput.value.trim().toLowerCase();
        aplicarFiltrosYRender();
    });

    const numFields = ['precioMin', 'precioMax', 'anioMin', 'anioMax', 'kmMax'];
    numFields.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', () => {
            const v = el.value === '' ? null : Number(el.value);
            filtros[id] = Number.isFinite(v) ? v : null;
            aplicarFiltrosYRender();
        });
    });

    document.getElementById('clearFiltersBtn').addEventListener('click', resetFiltros);

    // Toggle del sidebar en mobile.
    const toggle = document.getElementById('mobileFiltersToggle');
    const sidebar = document.getElementById('filtersSidebar');
    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('is-open');
        toggle.classList.toggle('is-active');
    });
}

function resetFiltros() {
    FILTER_FIELDS.forEach((c) => filtros[c].clear());
    filtros.search = '';
    filtros.precioMin = filtros.precioMax = null;
    filtros.anioMin = filtros.anioMax = null;
    filtros.kmMax = null;
    document.getElementById('searchInput').value = '';
    ['precioMin', 'precioMax', 'anioMin', 'anioMax', 'kmMax'].forEach((id) => {
        document.getElementById(id).value = '';
    });
    renderFiltrosCategoricos();
    aplicarFiltrosYRender();
}


/* =========================================================
   Aplicación de filtros + render de resultados
   ========================================================= */

function pasaFiltros(car) {
    // Categóricos: si hay selección, el valor del auto tiene que estar.
    for (const campo of FILTER_FIELDS) {
        const sel = filtros[campo];
        if (sel.size === 0) continue;
        const v = car[campo] ? String(car[campo]) : '';
        if (!sel.has(v)) return false;
    }

    // Búsqueda libre: matchea contra marca, modelo y ubicación.
    if (filtros.search) {
        const haystack = [
            car.marca, car.modelo, car.ubicacion,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(filtros.search)) return false;
    }

    // Rangos numéricos.
    const precio = Number(car.precio);
    if (filtros.precioMin != null && precio < filtros.precioMin) return false;
    if (filtros.precioMax != null && precio > filtros.precioMax) return false;

    if (filtros.anioMin != null && Number(car.anio) < filtros.anioMin) return false;
    if (filtros.anioMax != null && Number(car.anio) > filtros.anioMax) return false;

    if (filtros.kmMax != null && Number(car.kilometraje) > filtros.kmMax) return false;

    return true;
}

function aplicarFiltrosYRender() {
    const filtrados = allCars.filter(pasaFiltros);

    renderActiveFiltersChips();
    renderResults(filtrados);

    // Mostrar el botón "Limpiar todo" solo si hay algún filtro activo.
    const hayFiltros = FILTER_FIELDS.some((c) => filtros[c].size > 0)
        || filtros.search
        || ['precioMin', 'precioMax', 'anioMin', 'anioMax', 'kmMax'].some((k) => filtros[k] != null);
    document.getElementById('clearFiltersBtn').classList.toggle('hidden', !hayFiltros);
}

function renderResults(cars) {
    const container = document.getElementById('carsContainer');
    const count = document.getElementById('resultsCount');

    // Reset selección de comparar cuando cambia la grilla.
    selectedCars = [];
    updateCompareBtn();

    if (cars.length === 0) {
        count.textContent = '0 vehículos';
        container.innerHTML = Components.emptyState({
            icon: '🚗',
            title: 'No encontramos vehículos con esos filtros',
            message: 'Probá ampliar los criterios o limpiar la selección.',
        });
        return;
    }

    count.textContent = `${cars.length} ${cars.length === 1 ? 'vehículo' : 'vehículos'}`;

    const mostrarFavorito = Auth.isLoggedIn() && Auth.getRol() === 'comprador';
    container.innerHTML = `
        <div class="cars-grid">
            ${cars.map((car) => Components.carCard(car, {
                withCheckbox: true,
                withFavorito: mostrarFavorito,
                favoritoIds: favoritosSet,
            })).join('')}
        </div>`;

    // Re-engancha los handlers de la grilla (checkbox y ❤).
    container.querySelectorAll('.car-checkbox').forEach((cb) => {
        cb.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            if (e.target.checked) {
                const car = cars.find((c) => String(c.idVehiculo) === id);
                if (car) selectedCars.push(car);
            } else {
                selectedCars = selectedCars.filter((c) => String(c.idVehiculo) !== id);
            }
            updateCompareBtn();
        });
    });

    container.querySelectorAll('[data-favorito]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = btn.dataset.favorito;
            try {
                const r = await apiCall(`/favoritos/${id}`, { method: 'POST' });
                if (r.favorito) favoritosSet.add(id);
                else favoritosSet.delete(id);
                btn.classList.toggle('is-active', r.favorito);
                btn.setAttribute('aria-pressed', String(r.favorito));
                btn.innerHTML = r.favorito ? '❤️' : '🤍';
                btn.setAttribute(
                    'aria-label',
                    r.favorito ? 'Quitar de favoritos' : 'Agregar a favoritos',
                );
            } catch (err) {
                console.error('Error toggleando favorito:', err);
            }
        });
    });
}


/* =========================================================
   Chips de filtros activos arriba de los resultados
   ========================================================= */

function renderActiveFiltersChips() {
    const container = document.getElementById('activeFilters');
    const chips = [];

    FILTER_FIELDS.forEach((campo) => {
        filtros[campo].forEach((valor) => {
            chips.push({
                label: `${labelDeCampo(campo)}: ${valor}`,
                onClear: () => { filtros[campo].delete(valor); renderFiltrosCategoricos(); aplicarFiltrosYRender(); },
            });
        });
    });

    if (filtros.search) {
        chips.push({
            label: `Búsqueda: "${filtros.search}"`,
            onClear: () => {
                filtros.search = '';
                document.getElementById('searchInput').value = '';
                aplicarFiltrosYRender();
            },
        });
    }

    if (filtros.precioMin != null || filtros.precioMax != null) {
        const min = filtros.precioMin != null ? formatPrice(filtros.precioMin) : '—';
        const max = filtros.precioMax != null ? formatPrice(filtros.precioMax) : '—';
        chips.push({
            label: `Precio: ${min} a ${max}`,
            onClear: () => {
                filtros.precioMin = filtros.precioMax = null;
                document.getElementById('precioMin').value = '';
                document.getElementById('precioMax').value = '';
                aplicarFiltrosYRender();
            },
        });
    }

    if (filtros.anioMin != null || filtros.anioMax != null) {
        const min = filtros.anioMin ?? '—';
        const max = filtros.anioMax ?? '—';
        chips.push({
            label: `Año: ${min} a ${max}`,
            onClear: () => {
                filtros.anioMin = filtros.anioMax = null;
                document.getElementById('anioMin').value = '';
                document.getElementById('anioMax').value = '';
                aplicarFiltrosYRender();
            },
        });
    }

    if (filtros.kmMax != null) {
        chips.push({
            label: `Hasta ${formatKm(filtros.kmMax)}`,
            onClear: () => {
                filtros.kmMax = null;
                document.getElementById('kmMax').value = '';
                aplicarFiltrosYRender();
            },
        });
    }

    if (chips.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = chips.map((c, i) => `
        <button type="button" class="filter-chip" data-chip="${i}">
            <span>${escapeHtml(c.label)}</span>
            <span class="filter-chip-x" aria-hidden="true">×</span>
        </button>
    `).join('');

    container.querySelectorAll('[data-chip]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const idx = Number(btn.dataset.chip);
            chips[idx].onClear();
        });
    });
}

function labelDeCampo(campo) {
    return {
        marca: 'Marca',
        modelo: 'Modelo',
        ubicacion: 'Ubicación',
        tipoCombustible: 'Combustible',
        transmision: 'Transmisión',
    }[campo] || campo;
}


/* =========================================================
   Comparar
   ========================================================= */

function bindCompareBtn() {
    document.getElementById('compareBtn').addEventListener('click', () => {
        if (selectedCars.length < 2) {
            alert('Seleccioná al menos 2 autos para comparar.');
            return;
        }
        localStorage.setItem('compareCars', JSON.stringify(selectedCars));
        window.location.href = 'compare.html';
    });
}

function updateCompareBtn() {
    const btn = document.getElementById('compareBtn');
    btn.textContent = `Comparar seleccionados (${selectedCars.length})`;
    btn.classList.toggle('hidden', selectedCars.length < 2);
}
