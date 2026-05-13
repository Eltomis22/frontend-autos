/* Panel del vendedor: listado + edición rápida + baja de publicaciones */

document.addEventListener('DOMContentLoaded', () => {
    renderNavbar('mis-publicaciones');

    if (!Auth.isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }
    if (Auth.getRol() !== 'vendedor') {
        document.getElementById('publicacionesContainer').innerHTML = Components.emptyState({
            icon: '🔒',
            title: 'Sección exclusiva para vendedores',
            message: 'Convertite en vendedor para publicar y administrar tus vehículos.',
            fullSpan: true,
        });
        return;
    }

    loadPublicaciones();
    bindModal();
});

async function loadPublicaciones() {
    const container = document.getElementById('publicacionesContainer');
    try {
        const vehiculos = await apiCall('/vehiculos/mios');
        if (!Array.isArray(vehiculos) || vehiculos.length === 0) {
            container.innerHTML = Components.emptyState({
                icon: '🚗',
                title: 'Todavía no publicaste ningún vehículo',
                message: 'Subí tu primera unidad y empezá a recibir consultas en minutos.',
                action: '<a href="publish.html" class="btn btn-primary">Publicar ahora</a>',
                fullSpan: true,
            });
            return;
        }
        container.innerHTML = vehiculos.map((v) => Components.publicacionCard(v, {
            actions: `
                <a href="${route('car-detail')}?id=${encodeURIComponent(v.idVehiculo)}" class="btn btn-ghost btn-sm">Ver</a>
                <button class="btn btn-primary btn-sm" data-edit="${escapeHtml(v.idVehiculo)}">Editar</button>
                <button class="btn btn-ghost btn-sm" data-delete="${escapeHtml(v.idVehiculo)}" style="color: var(--color-danger, #f87171);">Eliminar</button>`
        })).join('');
        container.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(vehiculos.find((v) => String(v.idVehiculo) === btn.dataset.edit)));
        });
        container.querySelectorAll('[data-delete]').forEach(btn => {
            btn.addEventListener('click', () => eliminarPublicacion(btn.dataset.delete));
        });
    } catch (err) {
        console.error('Error cargando publicaciones:', err);
        container.innerHTML = Components.emptyState({
            icon: '⚠️',
            title: 'No pudimos cargar tus publicaciones',
            message: err.message,
            fullSpan: true,
        });
    }
}

/* ---------- Modal edición ---------- */
function bindModal() {
    const modal = document.getElementById('editModal');
    document.getElementById('editModalClose').addEventListener('click', closeEditModal);
    document.getElementById('editCancelBtn').addEventListener('click', closeEditModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeEditModal(); });

    document.getElementById('editForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await guardarCambios();
    });
}

function openEditModal(v) {
    if (!v) return;
    document.getElementById('editId').value = v.idVehiculo;
    document.getElementById('editPrecio').value = v.precio ?? '';
    document.getElementById('editKilometraje').value = v.kilometraje ?? '';
    document.getElementById('editUbicacion').value = v.ubicacion ?? '';
    document.getElementById('editAnio').value = v.anio ?? '';
    document.getElementById('editDescripcion').value = v.descripcion ?? '';
    clearAlert('editFeedback');

    const modal = document.getElementById('editModal');
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
}

async function guardarCambios() {
    const btn = document.getElementById('editSaveBtn');
    const id = document.getElementById('editId').value;
    const body = {};
    const precio       = document.getElementById('editPrecio').value;
    const kilometraje  = document.getElementById('editKilometraje').value;
    const ubicacion    = document.getElementById('editUbicacion').value.trim();
    const anio         = document.getElementById('editAnio').value;
    const descripcion  = document.getElementById('editDescripcion').value.trim();

    if (precio !== '')       body.precio = Number(precio);
    if (kilometraje !== '')  body.kilometraje = Number(kilometraje);
    if (ubicacion)           body.ubicacion = ubicacion;
    if (anio !== '')         body.anio = Number(anio);
    if (descripcion)         body.descripcion = descripcion;

    setButtonLoading(btn, true, 'Guardando...');
    try {
        await apiCall(`/vehiculos/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        });
        closeEditModal();
        showAlert('feedback', 'Publicación actualizada correctamente.', 'success');
        await loadPublicaciones();
    } catch (err) {
        showAlert('editFeedback', 'No se pudo actualizar: ' + err.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function eliminarPublicacion(id) {
    if (!confirm('¿Seguro que querés eliminar esta publicación? Esta acción no se puede deshacer.')) return;
    try {
        await apiCall(`/vehiculos/${id}`, { method: 'DELETE' });
        showAlert('feedback', 'Publicación eliminada.', 'success');
        await loadPublicaciones();
    } catch (err) {
        showAlert('feedback', 'No se pudo eliminar: ' + err.message, 'error');
    }
}
