/* Página de autogestión del perfil */

document.addEventListener('DOMContentLoaded', () => {
    renderNavbar('mi-cuenta');

    if (!Auth.isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }

    loadPerfil();
    bindForms();
});

async function loadPerfil() {
    try {
        const perfil = await apiCall('/usuarios/me');
        renderPerfil(perfil);
        // Mantiene localStorage sincronizado para el resto del sitio.
        Auth.setSession(Auth.getToken(), perfil.rol, perfil);
    } catch (err) {
        console.error('Error cargando perfil:', err);
        document.getElementById('accountInfo').innerHTML = `
            <div class="alert alert-error"><strong>✕</strong> ${escapeHtml(err.message)}</div>`;
    }
}

function renderPerfil(p) {
    const fecha = p.fechaCreacion
        ? new Date(p.fechaCreacion).toLocaleDateString('es-AR', { dateStyle: 'long' })
        : '—';
    const rolLegible = p.rol === 'vendedor' ? 'Vendedor' : 'Comprador';

    document.getElementById('accountInfo').innerHTML = `
        <div class="account-info-row">
            <span class="account-info-label">Nombre</span>
            <span class="account-info-value">${escapeHtml(p.nombre)}</span>
        </div>
        <div class="account-info-row">
            <span class="account-info-label">Email</span>
            <span class="account-info-value">${escapeHtml(p.email)}</span>
        </div>
        <div class="account-info-row">
            <span class="account-info-label">Rol</span>
            <span class="account-info-value">${rolLegible}</span>
        </div>
        <div class="account-info-row">
            <span class="account-info-label">Miembro desde</span>
            <span class="account-info-value">${fecha}</span>
        </div>`;

    document.getElementById('nombre').value = p.nombre || '';
}

function bindForms() {
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('profileBtn');
        const nombre = document.getElementById('nombre').value.trim();
        if (nombre.length < 2) {
            showAlert('feedback', 'El nombre debe tener al menos 2 caracteres.', 'error');
            return;
        }
        setButtonLoading(btn, true, 'Guardando...');
        try {
            const actualizado = await apiCall('/usuarios/me', {
                method: 'PATCH',
                body: JSON.stringify({ nombre }),
            });
            renderPerfil(actualizado);
            Auth.setSession(Auth.getToken(), actualizado.rol, actualizado);
            showAlert('feedback', 'Perfil actualizado correctamente.', 'success');
        } catch (err) {
            showAlert('feedback', 'No se pudo actualizar el perfil: ' + err.message, 'error');
        } finally {
            setButtonLoading(btn, false);
        }
    });

    document.getElementById('passwordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('passwordBtn');
        const passwordActual   = document.getElementById('passwordActual').value;
        const passwordNueva    = document.getElementById('passwordNueva').value;
        const passwordConfirmar = document.getElementById('passwordConfirmar').value;

        if (passwordNueva.length < 8) {
            showAlert('feedback', 'La nueva contraseña debe tener al menos 8 caracteres.', 'error');
            return;
        }
        if (!/[A-Za-z]/.test(passwordNueva) || !/[0-9]/.test(passwordNueva)) {
            showAlert('feedback', 'La nueva contraseña debe combinar letras y números.', 'error');
            return;
        }
        if (passwordNueva !== passwordConfirmar) {
            showAlert('feedback', 'La confirmación no coincide con la nueva contraseña.', 'error');
            return;
        }

        setButtonLoading(btn, true, 'Actualizando...');
        try {
            await apiCall('/usuarios/me', {
                method: 'PATCH',
                body: JSON.stringify({
                    passwordActual,
                    password: passwordNueva,
                }),
            });
            document.getElementById('passwordForm').reset();
            showAlert('feedback', 'Contraseña actualizada correctamente.', 'success');
        } catch (err) {
            showAlert('feedback', 'No se pudo cambiar la contraseña: ' + err.message, 'error');
        } finally {
            setButtonLoading(btn, false);
        }
    });
}
