/* =========================================================
   Bandeja de consultas del vendedor con conversación ida y vuelta.
   Requiere app.js y consultas-thread.js.
   ========================================================= */

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    renderNavbar('consultas');

    if (!Auth.isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }
    if (Auth.getRol() !== 'vendedor') {
        document.getElementById('consultasContainer').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔒</div>
                <h3>Sección exclusiva para vendedores</h3>
                <p>Iniciá sesión con una cuenta de vendedor para ver tus consultas recibidas.</p>
            </div>`;
        return;
    }
    currentUser = Auth.getUser() || {};
    loadConsultas();
});

async function loadConsultas() {
    const container = document.getElementById('consultasContainer');
    try {
        const consultas = await apiCall('/consultas/recibidas');
        if (!Array.isArray(consultas) || consultas.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <h3>Todavía no tenés consultas</h3>
                    <p>Cuando un comprador envíe un mensaje por alguna de tus publicaciones, lo vas a ver acá.</p>
                </div>`;
            return;
        }
        container.innerHTML = consultas.map(renderConsulta).join('');
        attachHandlers(container);
    } catch (err) {
        console.error('Error cargando consultas:', err);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <h3>No se pudieron cargar las consultas</h3>
                <p>${escapeHtml(err.message)}</p>
            </div>`;
    }
}

function renderConsulta(c) {
    const vehiculo = c.vehiculo || {};
    const comprador = c.comprador || {};
    const leidaBadge = c.leida
        ? `<span class="consulta-badge leida">Leída</span>`
        : `<span class="consulta-badge pendiente">Nueva</span>`;
    const vehiculoTitle = `${escapeHtml(vehiculo.marca || '')} ${escapeHtml(vehiculo.modelo || '')}`.trim() || 'Vehículo';
    const vehiculoSubtitle = [
        vehiculo.anio ? `Año ${vehiculo.anio}` : null,
        vehiculo.precio != null ? formatPrice(vehiculo.precio) : null,
    ].filter(Boolean).join(' · ');

    const emailLink = comprador.email
        ? `<a href="mailto:${encodeURIComponent(comprador.email)}?subject=${encodeURIComponent('Consulta por ' + vehiculoTitle)}" class="consulta-contact">✉ ${escapeHtml(comprador.email)}</a>`
        : '';

    return `
        <article class="consulta-card ${c.leida ? 'is-read' : 'is-new'}" data-consulta-id="${escapeHtml(c.idConsulta)}">
            <header class="consulta-header">
                <div class="consulta-vehiculo">
                    <a href="car-detail.html?id=${encodeURIComponent(vehiculo.idVehiculo)}" class="consulta-vehiculo-title">${vehiculoTitle}</a>
                    ${vehiculoSubtitle ? `<span class="consulta-vehiculo-meta">${vehiculoSubtitle}</span>` : ''}
                </div>
                ${leidaBadge}
            </header>

            ${renderThreadTimeline(c, currentUser.idUsuario)}

            ${renderReplyForm(c.idConsulta)}

            <footer class="consulta-footer">
                <div class="consulta-comprador">
                    <span class="consulta-comprador-name">${escapeHtml(comprador.nombre || 'Comprador')}</span>
                    ${emailLink}
                </div>
                <div class="consulta-actions">
                    ${!c.leida ? `<button class="btn btn-ghost btn-sm" data-marcar-leida="${escapeHtml(c.idConsulta)}">Marcar como leída</button>` : ''}
                </div>
            </footer>
        </article>`;
}

function attachHandlers(container) {
    container.querySelectorAll('[data-marcar-leida]').forEach((btn) => {
        btn.addEventListener('click', () => marcarLeida(btn.dataset.marcarLeida, btn));
    });

    container.querySelectorAll('form.thread-reply').forEach((form) => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idConsulta = form.dataset.replyFor;
            const textarea = form.querySelector('textarea');
            const mensaje = textarea.value.trim();
            const btn = form.querySelector('button[type="submit"]');
            if (!mensaje) return;

            try {
                await enviarRespuesta(idConsulta, mensaje, btn);
                textarea.value = '';
                showAlert('feedback', 'Respuesta enviada.', 'success');
                await loadConsultas();
            } catch (err) {
                showAlert('feedback', 'No se pudo enviar: ' + err.message, 'error');
            }
        });
    });
}

async function marcarLeida(idConsulta, btn) {
    setButtonLoading(btn, true, 'Actualizando...');
    try {
        await apiCall(`/consultas/${idConsulta}/leida`, { method: 'PATCH' });
        showAlert('feedback', 'Consulta marcada como leída.', 'success');
        await loadConsultas();
    } catch (err) {
        showAlert('feedback', 'No se pudo actualizar: ' + err.message, 'error');
        setButtonLoading(btn, false);
    }
}
