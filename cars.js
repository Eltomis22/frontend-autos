/* Catálogo de vehículos con filtros y selección para comparar */

let selectedCars = [];
let allCars = [];

document.addEventListener('DOMContentLoaded', () => {
    renderNavbar('cars');
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

    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    resultsCount.textContent = 'Cargando...';

    const params = new URLSearchParams();
    const fields = ['marca', 'modelo', 'precioMin', 'precioMax', 'anioMin', 'ubicacion'];
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
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <h3>No se pudieron cargar los vehículos</h3>
                <p>${error.message}. Verificá que el backend esté corriendo.</p>
            </div>`;
        resultsCount.textContent = '';
    }
}

function getPrimaryImage(car) {
    if (Array.isArray(car.imagenes) && car.imagenes.length > 0) {
        const first = car.imagenes[0];
        return typeof first === 'string' ? first : first?.urlImagen || '';
    }
    return '';
}

function displayCars(cars) {
    const container = document.getElementById('carsContainer');
    const resultsCount = document.getElementById('resultsCount');

    selectedCars = [];
    updateCompareBtn();

    if (!cars.length) {
        resultsCount.textContent = '0 vehículos';
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🚗</div>
                <h3>No se encontraron vehículos</h3>
                <p>Probá con otros filtros o limpialos para ver todos los autos disponibles.</p>
            </div>`;
        return;
    }

    resultsCount.textContent = `${cars.length} ${cars.length === 1 ? 'vehículo' : 'vehículos'}`;

    const grid = document.createElement('div');
    grid.className = 'cars-grid';

    cars.forEach(car => {
        const fotoUrl = getPrimaryImage(car);
        const id = car.idVehiculo;
        const card = document.createElement('article');
        card.className = 'car-card';
        card.innerHTML = `
            <div class="car-card-image">
                ${fotoUrl
                    ? `<img src="${escapeHtml(fotoUrl)}" alt="${escapeHtml(car.marca)} ${escapeHtml(car.modelo)}" onerror="this.parentElement.innerHTML='<div class=\\'no-image\\'>Sin foto disponible</div>'">`
                    : `<div class="no-image">Sin foto disponible</div>`
                }
                <span class="car-card-badge">Disponible</span>
                <label class="car-card-checkbox" title="Marcar para comparar">
                    <input type="checkbox" class="car-checkbox" data-id="${id}">
                </label>
            </div>
            <div class="car-card-body">
                <h3 class="car-card-title">${escapeHtml(car.marca)} ${escapeHtml(car.modelo)}</h3>
                <div class="car-card-meta">
                    <span>📅 ${car.anio || '—'}</span>
                    ${car.kilometraje != null ? `<span>🛣️ ${formatKm(car.kilometraje)}</span>` : ''}
                    ${car.ubicacion ? `<span>📍 ${escapeHtml(car.ubicacion)}</span>` : ''}
                </div>
                <div class="car-card-price">${formatPrice(car.precio)}</div>
                <div class="car-card-actions">
                    <a href="car-detail.html?id=${id}" class="btn btn-primary btn-block">Ver detalles</a>
                </div>
            </div>`;
        grid.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(grid);

    document.querySelectorAll('.car-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            if (e.target.checked) {
                const car = cars.find(c => c.idVehiculo === id);
                if (car) selectedCars.push(car);
            } else {
                selectedCars = selectedCars.filter(c => c.idVehiculo !== id);
            }
            updateCompareBtn();
        });
    });
}

function updateCompareBtn() {
    const btn = document.getElementById('compareBtn');
    btn.textContent = `Comparar seleccionados (${selectedCars.length})`;
    btn.classList.toggle('hidden', selectedCars.length < 2);
}
