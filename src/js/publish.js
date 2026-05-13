/* =========================================================
   Publicación de vehículos (sólo vendedores).

   Selección de fotos:
     El input file nativo REEMPLAZA su contenido en cada change,
     así que mantenemos nuestra propia lista (selectedPhotos) como
     única fuente de verdad. Cada vez que el usuario elige fotos
     nuevas, las APENDEAMOS a esa lista y reseteamos el input para
     que el próximo `change` dispare aunque elija el mismo archivo.

     Las miniaturas se reordenan por drag-and-drop (HTML5). La
     primera de la lista queda marcada como "Portada". Al enviar
     el formulario, las fotos se suben en el orden actual.
   ========================================================= */

/* ---------- Estado del selector de fotos ---------- */
let selectedPhotos = []; // [{ id, file, url }]
let dragPhotoId = null;

document.addEventListener('DOMContentLoaded', () => {
    renderNavbar('publish');

    if (!Auth.isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }
    if (Auth.getRol() !== 'vendedor') {
        showAlert('message', 'Solo los usuarios con rol Vendedor pueden publicar autos.', 'error');
        document.getElementById('publishForm').classList.add('hidden');
        return;
    }

    bindPhotoSelector();
    renderPhotosGrid();

    document.getElementById('publishForm').addEventListener('submit', handlePublish);
});


/* =========================================================
   Selector de fotos
   ========================================================= */

function bindPhotoSelector() {
    const input = document.getElementById('imagenes');
    const addBtn = document.getElementById('addPhotosBtn');

    addBtn.addEventListener('click', () => input.click());

    input.addEventListener('change', () => {
        addPhotos(input.files);
        // Reset del input para que se pueda volver a seleccionar el mismo
        // archivo después (sin esto, elegir el mismo archivo dos veces no
        // dispararía el evento `change`).
        input.value = '';
    });
}

function addPhotos(fileList) {
    Array.from(fileList || []).forEach((file) => {
        if (!file.type || !file.type.startsWith('image/')) return; // por las dudas
        selectedPhotos.push({
            id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            file,
            url: URL.createObjectURL(file),
        });
    });
    renderPhotosGrid();
}

function removePhoto(id) {
    const idx = selectedPhotos.findIndex((p) => p.id === id);
    if (idx === -1) return;
    URL.revokeObjectURL(selectedPhotos[idx].url); // liberamos el blob
    selectedPhotos.splice(idx, 1);
    renderPhotosGrid();
}

function clearPhotos() {
    selectedPhotos.forEach((p) => URL.revokeObjectURL(p.url));
    selectedPhotos = [];
    renderPhotosGrid();
}

function renderPhotosGrid() {
    const grid = document.getElementById('photosGrid');
    if (!grid) return;

    grid.innerHTML = Components.photosGrid(selectedPhotos);
    bindPhotoTileEvents(grid);
}

function bindPhotoTileEvents(grid) {
    grid.querySelectorAll('[data-remove]').forEach((btn) => {
        btn.addEventListener('click', () => removePhoto(btn.dataset.remove));
    });

    grid.querySelectorAll('.photo-tile').forEach((tile) => {
        tile.addEventListener('dragstart', onPhotoDragStart);
        tile.addEventListener('dragover', onPhotoDragOver);
        tile.addEventListener('dragleave', onPhotoDragLeave);
        tile.addEventListener('drop', onPhotoDrop);
        tile.addEventListener('dragend', onPhotoDragEnd);
    });
}


/* ---------- Drag & drop ----------
   API HTML5 estándar. Guardamos el id de la tile origen en una
   variable de módulo (dragPhotoId) en vez de en dataTransfer
   porque algunos navegadores no exponen el contenido durante
   `dragover`. */

function onPhotoDragStart(e) {
    dragPhotoId = e.currentTarget.dataset.id;
    e.currentTarget.classList.add('is-dragging');
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        // Algunos navegadores requieren setData para que el drag arranque.
        try { e.dataTransfer.setData('text/plain', dragPhotoId); } catch { /* ignore */ }
    }
}

function onPhotoDragOver(e) {
    if (!dragPhotoId) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const tile = e.currentTarget;
    if (tile.dataset.id !== dragPhotoId) {
        tile.classList.add('is-drop-target');
    }
}

function onPhotoDragLeave(e) {
    e.currentTarget.classList.remove('is-drop-target');
}

function onPhotoDrop(e) {
    e.preventDefault();
    const targetId = e.currentTarget.dataset.id;
    const sourceId = dragPhotoId;
    if (!sourceId || !targetId || sourceId === targetId) return;

    const fromIdx = selectedPhotos.findIndex((p) => p.id === sourceId);
    const toIdx   = selectedPhotos.findIndex((p) => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = selectedPhotos.splice(fromIdx, 1);
    selectedPhotos.splice(toIdx, 0, moved);
    renderPhotosGrid();
}

function onPhotoDragEnd() {
    document.querySelectorAll('.photo-tile').forEach((t) => {
        t.classList.remove('is-dragging', 'is-drop-target');
    });
    dragPhotoId = null;
}


/* =========================================================
   Submit del formulario
   ========================================================= */

async function handlePublish(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    clearAlert('message');

    const datos = {
        marca: document.getElementById('marca').value.trim(),
        modelo: document.getElementById('modelo').value.trim(),
        anio: Number(document.getElementById('anio').value),
        kilometraje: Number(document.getElementById('kilometraje').value),
        tipoCombustible: document.getElementById('combustible').value.trim(),
        transmision: document.getElementById('transmision').value.trim(),
        precio: Number(document.getElementById('precio').value),
        ubicacion: document.getElementById('ubicacion').value.trim(),
        descripcion: document.getElementById('descripcion').value.trim(),
    };

    // Validaciones mínimas
    const requeridos = ['marca', 'modelo', 'tipoCombustible', 'transmision', 'ubicacion'];
    for (const c of requeridos) {
        if (!datos[c]) {
            showAlert('message', `El campo "${c}" es obligatorio.`, 'error');
            return;
        }
    }
    if (!Number.isInteger(datos.anio) || datos.anio < 1900) {
        showAlert('message', 'Ingresá un año válido.', 'error');
        return;
    }
    if (!Number.isFinite(datos.precio) || datos.precio < 0) {
        showAlert('message', 'Ingresá un precio válido mayor o igual a 0.', 'error');
        return;
    }
    if (!Number.isFinite(datos.kilometraje) || datos.kilometraje < 0) {
        showAlert('message', 'Ingresá un kilometraje válido mayor o igual a 0.', 'error');
        return;
    }

    setButtonLoading(btn, true, 'Publicando...');

    try {
        // 1. Crear el vehículo
        const nuevo = await apiCall('/vehiculos', {
            method: 'POST',
            body: JSON.stringify(datos),
        });
        const idVehiculo = nuevo.idVehiculo;

        // 2. Subir las fotos del usuario, EN EL ORDEN ELEGIDO.
        if (selectedPhotos.length > 0 && idVehiculo) {
            const formData = new FormData();
            selectedPhotos.forEach((p) => formData.append('imagenes', p.file));
            await apiCall(`/vehiculos/${idVehiculo}/imagenes`, {
                method: 'POST',
                body: formData,
            });
        }

        // 3. Disparar valoración técnica (endpoint interno)
        if (idVehiculo) {
            try {
                await apiCall(`/ia/analizar/${idVehiculo}`, { method: 'POST' });
            } catch { /* no bloqueamos la publicación */ }
        }

        showAlert('message', '¡Vehículo publicado correctamente! Redirigiendo al catálogo...', 'success');
        document.getElementById('publishForm').reset();
        clearPhotos(); // libera blobs y resetea la grilla
        setTimeout(() => window.location.href = 'cars.html', 1400);
    } catch (err) {
        console.error('Error publicando:', err);
        showAlert('message', 'No se pudo publicar: ' + err.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}
