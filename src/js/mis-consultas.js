/* =========================================================
   Historial de consultas enviadas (comprador).
   Requiere app.js y consultas-thread.js.
   ========================================================= */

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    renderNavbar('mis-consultas');

    if (!Auth.isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = Auth.getUser() || {};
    loadMisConsultas();
});

async function loadMisConsultas() {
    const container = document.getElementById('consultasContainer');
    try {
        const consultas = await apiCall('/consultas/mias');
        if (!Array.isArray(consultas) || consultas.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">💬</div>
                    <h3>Todavía no enviaste ninguna consulta</h3>
                    <p>Desde la ficha de cada vehículo podés consultar al vendedor. Las conversaciones van a aparecer acá.</p>
                    <div style="margin-top: 1.2rem;">
                        <a href="cars.html" class="btn btn-primary">Ver catálogo</a>
                    </div>
                </div>`;
            return;
        }
        container.innerHTML = consultas.map(renderConsulta).join('');
        attachHandlers(container);
    } catch (err) {
        console.error('Error cargando mis consultas:', err);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <h3>No se pudieron cargar tus consultas</h3>
                <p>${escapeHtml(err.message)}</p>
            </div>`;
    }
}

function renderConsulta(c) {
    const vehiculo = c.vehiculo || {};
    const vehiculoTitle = `${escapeHtml(vehiculo.marca || '')} ${escapeHtml(vehiculo.modelo || '')}`.trim() || 'Vehículo';
    const vehiculoSubtitle = [
        vehiculo.anio ? `Año ${vehiculo.anio}` : null,
        vehiculo.precio != null ? formatPrice(vehiculo.precio) : null,
    ].filter(Boolean).join(' · ');

    // Para el comprador, el "estado" útil es: ¿el vendedor ya me respondió?
    const respuestas = Array.isArray(c.respuestas) ? c.respuestas : [];
    const respuestaVendedor = respuestas.some((r) => r.autor?.rol === 'vendedor');
    const estadoBadge = respuestaVendedor
        ? `<span class="consulta-badge leida">Respondida</span>`
        : `<span class="consulta-badge pendiente">Esperando respuesta</span>`;

    return `
        <article class="consulta-card ${respuestaVendedor ? 'is-read' : 'is-new'}" data-consulta-id="${escapeHtml(c.idConsulta)}">
            <header class="consulta-header">
                <div class="consulta-vehiculo">
                    <a href="car-detail.html?id=${encodeURIComponent(vehiculo.idVehiculo)}" class="consulta-vehiculo-title">${vehiculoTitle}</a>
                    ${vehiculoSubtitle ? `<span class="consulta-vehiculo-meta">${vehiculoSubtitle}</span>` : ''}
                </div>
                ${estadoBadge}
            </header>

            ${renderThreadTimeline(c, currentUser.idUsuario)}

            ${renderReplyForm(c.idConsulta)}
        </article>`;
}

function attachHandlers(container) {
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
                showAlert('feedback', 'Mensaje enviado.', 'success');
                await loadMisConsultas();
            } catch (err) {
                showAlert('feedback', 'No se pudo enviar: ' + err.message, 'error');
            }
        });
    });
}
