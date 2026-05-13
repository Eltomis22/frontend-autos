/* Panel del vendedor: listado + edición rápida + baja de publicaciones */

/**
 * Estado del modal de fotos durante una edición. Lo mantenemos a nivel
 * módulo para que los handlers (agregar / quitar / reordenar) lo compartan
 * sin tener que pasarlo por argumentos. Se reinicia cada vez que se abre
 * el modal.
 */
let editPhotos = []; // [{ idImagen, urlImagen }] — las que YA están en la BD
let editDragId = null; // id de la tile que se está arrastrando ahora

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

    // Listeners del bloque de fotos (siempre presentes; solo se enganchan una vez).
    bindEditPhotoSelector();
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

    // Cargamos las fotos actuales del vehículo y las pintamos.
    editPhotos = (v.imagenes || []).map((img) => ({
        idImagen: img.idImagen,
        urlImagen: img.urlImagen,
    }));
    renderEditPhotosGrid();

    const modal = document.getElementById('editModal');
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    // Al cerrar refrescamos siempre — así si el vendedor sólo tocó fotos
    // (agregar/quitar, que pegan directo al backend sin pasar por "Guardar"),
    // las cards de la grilla quedan al día sin que tenga que recargar la pagina.
    loadPublicaciones();
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
        showAlert('feedback', 'Publicación actualizada correctamente.', 'success');
        // closeEditModal() ya dispara loadPublicaciones() — no hace falta llamarlo acá.
        closeEditModal();
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


/* =========================================================
   Gestión de fotos dentro del modal de edición.

   Patrón distinto al de publish.js: ACÁ las fotos ya existen
   en el backend, así que cada acción (borrar / sumar) pega
   inmediatamente al backend en vez de acumular cambios para
   "Guardar". Eso porque las fotos son archivos y manejar batch
   con multipart sería más complejo y propenso a inconsistencia
   (si el form se cierra a la mitad, ¿qué fotos quedaron?).
   ========================================================= */

function bindEditPhotoSelector() {
    const input = document.getElementById('editPhotosInput');
    const addBtn = document.getElementById('editAddPhotosBtn');
    if (!input || !addBtn) return;

    addBtn.addEventListener('click', () => input.click());

    input.addEventListener('change', async () => {
        if (!input.files || input.files.length === 0) return;
        await subirFotosEdicion(input.files);
        // Reset para poder volver a elegir el mismo archivo si hizo falta.
        input.value = '';
    });
}

/**
 * Pinta el grid de fotos actuales del vehículo en edición. Cada tile
 * tiene una × que dispara `borrarFotoEdicion(idImagen)`. Si no hay
 * fotos, muestra un mensaje vacío.
 */
function renderEditPhotosGrid() {
    const grid = document.getElementById('editPhotosGrid');
    if (!grid) return;

    if (editPhotos.length === 0) {
        grid.innerHTML = `
            <div class="photos-empty">
                Esta publicación no tiene fotos. Tocá <strong>“+ Agregar fotos”</strong> para sumar imágenes.
            </div>`;
        return;
    }

    grid.innerHTML = editPhotos.map((p, idx) => `
        <div class="photo-tile" draggable="true" data-id="${escapeHtml(p.idImagen)}">
            <img src="${escapeHtml(p.urlImagen)}" alt="Foto ${idx + 1}">
            ${idx === 0 ? '<span class="photo-cover-badge">Portada</span>' : ''}
            <button type="button" class="photo-remove" data-remove="${escapeHtml(p.idImagen)}" aria-label="Quitar foto ${idx + 1}">×</button>
            <span class="photo-order">${idx + 1}</span>
        </div>
    `).join('');

    grid.querySelectorAll('[data-remove]').forEach((btn) => {
        btn.addEventListener('click', () => borrarFotoEdicion(btn.dataset.remove));
    });

    // Drag-and-drop para reordenar (idéntico patrón al de publish.js).
    grid.querySelectorAll('.photo-tile').forEach((tile) => {
        tile.addEventListener('dragstart', onEditPhotoDragStart);
        tile.addEventListener('dragover', onEditPhotoDragOver);
        tile.addEventListener('dragleave', onEditPhotoDragLeave);
        tile.addEventListener('drop', onEditPhotoDrop);
        tile.addEventListener('dragend', onEditPhotoDragEnd);
    });
}

/* ---------- Drag-and-drop de fotos en el modal de edición ---------- */

function onEditPhotoDragStart(e) {
    editDragId = e.currentTarget.dataset.id;
    e.currentTarget.classList.add('is-dragging');
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', editDragId); } catch { /* ignore */ }
    }
}

function onEditPhotoDragOver(e) {
    if (!editDragId) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const tile = e.currentTarget;
    if (tile.dataset.id !== editDragId) {
        tile.classList.add('is-drop-target');
    }
}

function onEditPhotoDragLeave(e) {
    e.currentTarget.classList.remove('is-drop-target');
}

async function onEditPhotoDrop(e) {
    e.preventDefault();
    const targetId = e.currentTarget.dataset.id;
    const sourceId = editDragId;
    if (!sourceId || !targetId || sourceId === targetId) return;

    const fromIdx = editPhotos.findIndex((p) => p.idImagen === sourceId);
    const toIdx   = editPhotos.findIndex((p) => p.idImagen === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    // Mutación optimista: reordenamos el array local y re-pintamos para
    // que el cambio se vea al instante. Después persistimos.
    const [moved] = editPhotos.splice(fromIdx, 1);
    editPhotos.splice(toIdx, 0, moved);
    renderEditPhotosGrid();
    await persistirOrdenFotos();
}

function onEditPhotoDragEnd() {
    document.querySelectorAll('#editPhotosGrid .photo-tile').forEach((t) => {
        t.classList.remove('is-dragging', 'is-drop-target');
    });
    editDragId = null;
}

/**
 * Persiste el orden actual de `editPhotos` en el backend. Se llama al
 * soltar una foto (drop). Si falla, mostramos un alert pero NO revertimos
 * el cambio visual — el próximo openEditModal recargará el estado real
 * desde el backend.
 */
async function persistirOrdenFotos() {
    const idVehiculo = document.getElementById('editId').value;
    const ids = editPhotos.map((p) => p.idImagen);
    try {
        await apiCall(`/vehiculos/${idVehiculo}/imagenes/orden`, {
            method: 'PATCH',
            body: JSON.stringify({ ids }),
        });
    } catch (err) {
        showAlert('editFeedback', 'No se pudo guardar el nuevo orden: ' + err.message, 'error');
    }
}

async function borrarFotoEdicion(idImagen) {
    if (!confirm('¿Quitar esta foto del aviso?')) return;
    const idVehiculo = document.getElementById('editId').value;
    try {
        await apiCall(`/vehiculos/${idVehiculo}/imagenes/${idImagen}`, {
            method: 'DELETE',
        });
        // Sacamos del estado local y re-renderizamos.
        editPhotos = editPhotos.filter((p) => p.idImagen !== idImagen);
        renderEditPhotosGrid();
    } catch (err) {
        showAlert('editFeedback', 'No se pudo quitar la foto: ' + err.message, 'error');
    }
}

async function subirFotosEdicion(fileList) {
    const idVehiculo = document.getElementById('editId').value;
    const files = Array.from(fileList).filter((f) => f.type?.startsWith('image/'));
    if (files.length === 0) return;

    clearAlert('editFeedback');
    const formData = new FormData();
    files.forEach((f) => formData.append('imagenes', f));

    try {
        const response = await fetch(`${API_BASE}/vehiculos/${idVehiculo}/imagenes`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${Auth.getToken()}` },
            body: formData,
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || `Error ${response.status}`);
        }
        const { imagenes } = await response.json();
        // Agregamos al final del array local en el mismo orden recibido.
        (imagenes || []).forEach((img) => {
            editPhotos.push({
                idImagen: img.idImagen,
                urlImagen: img.urlImagen,
            });
        });
        renderEditPhotosGrid();
    } catch (err) {
        showAlert('editFeedback', 'No se pudieron subir las fotos: ' + err.message, 'error');
    }
}
