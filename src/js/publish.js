/* Publicación de vehículos (sólo vendedores) */

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

    document.getElementById('publishForm').addEventListener('submit', handlePublish);
});

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
    if (datos.precio < 0) {
        showAlert('message', 'El precio no puede ser negativo.', 'error');
        return;
    }

    const files = document.getElementById('imagenes').files;
    setButtonLoading(btn, true, 'Publicando...');

    try {
        // 1. Crear el vehículo
        const nuevo = await apiCall('/vehiculos', {
            method: 'POST',
            body: JSON.stringify(datos),
        });
        const idVehiculo = nuevo.idVehiculo;

        // 2. Subir imágenes (si hay) al endpoint dedicado
        if (files.length > 0 && idVehiculo) {
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('imagenes', files[i]);
            }
            await fetch(`${API_BASE}/vehiculos/${idVehiculo}/imagenes`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${Auth.getToken()}` },
                body: formData,
            }).then(r => {
                if (!r.ok) throw new Error('No se pudieron subir las imágenes');
                return r.json();
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
        setTimeout(() => window.location.href = 'cars.html', 1400);
    } catch (err) {
        console.error('Error publicando:', err);
        showAlert('message', 'No se pudo publicar: ' + err.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}
