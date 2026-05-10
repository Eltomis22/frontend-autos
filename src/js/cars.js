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

    // Componemos la grilla con la card reutilizable. La variante con
    // checkbox suma el control para marcar autos a comparar.
    container.innerHTML = `
        <div class="cars-grid">
            ${cars.map((car) => Components.carCard(car, { withCheckbox: true })).join('')}
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
}

function updateCompareBtn() {
    const btn = document.getElementById('compareBtn');
    btn.textContent = `Comparar seleccionados (${selectedCars.length})`;
    btn.classList.toggle('hidden', selectedCars.length < 2);
}
