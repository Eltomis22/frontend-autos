/* Catálogo de vehículos con filtros, selección para comparar y favoritos. */

let selectedCars = [];
let allCars = [];
let favoritosSet = new Set(); // ids de vehículos favoritados por el usuario actual

document.addEventListener('DOMContentLoaded', async () => {
    renderNavbar('cars');
    // Cargamos favoritos antes que los autos para que el primer render ya
    // muestre el ❤ con el estado correcto.
    await cargarFavoritos();
    loadCars();

    document.getElementById('filterForm').addEventListener('submit', (e) => {
        e.preventDefault();
        loadCars();
    });

    document.getElementById('clearFilters').addEventListener('click', () => {
        document.getElementById('filterForm').reset();
        loadCars();
    });

    document.getElementById('compareBtn').addEventListener('click', () => {
        if (selectedCars.length < 2) {
            alert('Seleccioná al menos 2 autos para comparar.');
            return;
        }
        localStorage.setItem('compareCars', JSON.stringify(selectedCars));
        window.location.href = 'compare.html';
    });
});

async function loadCars() {
    const container = document.getElementById('carsContainer');
    const resultsCount = document.getElementById('resultsCount');

    container.innerHTML = Components.loading();
    resultsCount.textContent = 'Cargando...';

    const params = new URLSearchParams();
    const fields = ['marca', 'modelo', 'precioMin', 'precioMax', 'anioMin', 'anioMax', 'kmMax', 'ubicacion'];
    fields.forEach(f => {
        const v = document.getElementById(f)?.value?.trim();
        if (v) params.append(f, v);
    });

    try {
        const cars = await apiCall(`/vehiculos${params.toString() ? '?' + params.toString() : ''}`);
        allCars = Array.isArray(cars) ? cars : [];
        displayCars(allCars);
    } catch (error) {
        console.error('Error cargando autos:', error);
        container.innerHTML = Components.emptyState({
            icon: '⚠️',
            title: 'No se pudieron cargar los vehículos',
            message: `${error.message}. Verificá que el backend esté corriendo.`,
        });
        resultsCount.textContent = '';
    }
}

function displayCars(cars) {
    const container = document.getElementById('carsContainer');
    const resultsCount = document.getElementById('resultsCount');

    selectedCars = [];
    updateCompareBtn();

    if (!cars.length) {
        resultsCount.textContent = '0 vehículos';
        container.innerHTML = Components.emptyState({
            icon: '🚗',
            title: 'No se encontraron vehículos',
            message: 'Probá con otros filtros o limpialos para ver todos los autos disponibles.',
        });
        return;
    }

    resultsCount.textContent = `${cars.length} ${cars.length === 1 ? 'vehículo' : 'vehículos'}`;

    // Componemos la grilla con la card reutilizable. Variantes:
    //   - withCheckbox: suma el control para comparar.
    //   - withFavorito: suma el ❤ (solo si hay sesión de comprador).
    const mostrarFavorito = Auth.isLoggedIn() && Auth.getRol() === 'comprador';
    container.innerHTML = `
        <div class="cars-grid">
            ${cars.map((car) => Components.carCard(car, {
                withCheckbox: true,
                withFavorito: mostrarFavorito,
                favoritoIds: favoritosSet,
            })).join('')}
        </div>`;

    container.querySelectorAll('.car-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            if (e.target.checked) {
                const car = cars.find(c => String(c.idVehiculo) === id);
                if (car) selectedCars.push(car);
            } else {
                selectedCars = selectedCars.filter(c => String(c.idVehiculo) !== id);
            }
            updateCompareBtn();
        });
    });

    // Toggle de favoritos por click en ❤. Cada botón apunta a su idVehiculo
    // via data-favorito; el handler hace POST /favoritos/:id (toggle).
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

/**
 * Si el usuario está logueado como comprador, precarga el set de ids de
 * vehículos favoritados. Se ignora silenciosamente si falla (no es crítico
 * para la UX del catálogo).
 */
async function cargarFavoritos() {
    if (!Auth.isLoggedIn() || Auth.getRol() !== 'comprador') return;
    try {
        const ids = await apiCall('/favoritos/ids');
        favoritosSet = new Set((ids || []).map(String));
    } catch (err) {
        console.warn('No se pudieron cargar favoritos:', err.message);
    }
}

function updateCompareBtn() {
    const btn = document.getElementById('compareBtn');
    btn.textContent = `Comparar seleccionados (${selectedCars.length})`;
    btn.classList.toggle('hidden', selectedCars.length < 2);
}
