/* =========================================================
   Mis favoritos (comprador) — listado + toggle.
   Requiere app.js y components.js.
   ========================================================= */

let favoritosCache = [];

document.addEventListener('DOMContentLoaded', () => {
    renderNavbar('mis-favoritos');

    if (!Auth.isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }
    if (Auth.getRol() !== 'comprador') {
        document.getElementById('favoritosContainer').innerHTML = Components.emptyState({
            icon: '🔒',
            title: 'Sección exclusiva para compradores',
            message: 'Los favoritos están pensados para que los compradores guarden vehículos del catálogo.',
        });
        return;
    }
    cargar();
});

async function cargar() {
    const container = document.getElementById('favoritosContainer');
    container.innerHTML = Components.loading();
    try {
        const vehiculos = await apiCall('/favoritos');
        favoritosCache = Array.isArray(vehiculos) ? vehiculos : [];
        if (favoritosCache.length === 0) {
            container.innerHTML = Components.emptyState({
                icon: '🤍',
                title: 'Todavía no marcaste favoritos',
                message: 'Explorá el catálogo y tocá el corazón para guardar los autos que más te interesen.',
                action: '<a href="cars.html" class="btn btn-primary">Ver catálogo</a>',
            });
            return;
        }
        // Todos los del listado son favoritos por definición → set con todos los ids.
        const favoritosIds = new Set(favoritosCache.map((v) => String(v.idVehiculo)));
        container.innerHTML = `
            <div class="cars-grid">
                ${favoritosCache.map((v) => Components.carCard(v, {
                    withFavorito: true,
                    favoritoIds: favoritosIds,
                })).join('')}
            </div>`;

        // Toggle in-place: al destildar, sacamos la card del DOM y del cache.
        container.querySelectorAll('[data-favorito]').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = btn.dataset.favorito;
                try {
                    const r = await apiCall(`/favoritos/${id}`, { method: 'POST' });
                    if (!r.favorito) {
                        // Sacamos la card de la grilla y del cache.
                        const card = btn.closest('.car-card');
                        if (card) card.remove();
                        favoritosCache = favoritosCache.filter((v) => String(v.idVehiculo) !== id);
                        if (favoritosCache.length === 0) cargar(); // re-renderiza el empty-state
                    }
                } catch (err) {
                    showAlert('feedback', 'No se pudo actualizar el favorito: ' + err.message, 'error');
                }
            });
        });
    } catch (err) {
        console.error('Error cargando favoritos:', err);
        container.innerHTML = Components.emptyState({
            icon: '⚠️',
            title: 'No pudimos cargar tus favoritos',
            message: err.message,
        });
    }
}
