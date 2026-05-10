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
        document.getElementById('consultasContainer').innerHTML = Components.emptyState({
            icon: '🔒',
            title: 'Sección exclusiva para vendedores',
            message: 'Iniciá sesión con una cuenta de vendedor para ver tus consultas recibidas.',
        });
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
            container.innerHTML = Components.emptyState({
                icon: '📭',
                title: 'Todavía no tenés consultas',
                message: 'Cuando un comprador envíe un mensaje por alguna de tus publicaciones, lo vas a ver acá.',
            });
            return;
        }
        container.innerHTML = consultas.map(renderConsulta).join('');
        attachHandlers(container);
    } catch (err) {
        console.error('Error cargando consultas:', err);
        container.innerHTML = Components.emptyState({
            icon: '⚠️',
            title: 'No se pudieron cargar las consultas',
            message: err.message,
        });
    }
}

/**
 * Card de consulta para el VENDEDOR. Compone Components.consultaCard
 * agregando los pedazos específicos del rol: badge "Leída/Nueva" y
 * footer con datos del comprador + botón "marcar como leída".
 */
function renderConsulta(c) {
    const comprador = c.comprador || {};
    const v = c.vehiculo || {};
    const vehiculoTitle = `${escapeHtml(v.marca || '')} ${escapeHtml(v.modelo || '')}`.trim() || 'Vehículo';

    const badge = c.leida
        ? `<span class="consulta-badge leida">Leída</span>`
        : `<span class="consulta-badge pendiente">Nueva</span>`;

    const emailLink = comprador.email
        ? `<a href="mailto:${encodeURIComponent(comprador.email)}?subject=${encodeURIComponent('Consulta por ' + vehiculoTitle)}" class="consulta-contact">✉ ${escapeHtml(comprador.email)}</a>`
        : '';

    const footer = `
        <footer class="consulta-footer">
            <div class="consulta-comprador">
                <span class="consulta-comprador-name">${escapeHtml(comprador.nombre || 'Comprador')}</span>
                ${emailLink}
            </div>
            <div class="consulta-actions">
                ${!c.leida ? `<button class="btn btn-ghost btn-sm" data-marcar-leida="${escapeHtml(c.idConsulta)}">Marcar como leída</button>` : ''}
            </div>
        </footer>`;

    return Components.consultaCard(c, { isResolved: c.leida, badge, footer });
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
