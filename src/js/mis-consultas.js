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
            container.innerHTML = Components.emptyState({
                icon: '💬',
                title: 'Todavía no enviaste ninguna consulta',
                message: 'Desde la ficha de cada vehículo podés consultar al vendedor. Las conversaciones van a aparecer acá.',
                action: '<a href="cars.html" class="btn btn-primary">Ver catálogo</a>',
            });
            return;
        }
        container.innerHTML = consultas.map(renderConsulta).join('');
        attachHandlers(container);
    } catch (err) {
        console.error('Error cargando mis consultas:', err);
        container.innerHTML = Components.emptyState({
            icon: '⚠️',
            title: 'No se pudieron cargar tus consultas',
            message: err.message,
        });
    }
}

/**
 * Card de consulta para el COMPRADOR. Compone Components.consultaCard
 * con un único pedazo específico: el badge "Respondida/Esperando" según
 * si el vendedor ya contestó. No lleva footer.
 */
function renderConsulta(c) {
    const respuestas = Array.isArray(c.respuestas) ? c.respuestas : [];
    const respuestaVendedor = respuestas.some((r) => r.autor?.rol === 'vendedor');
    const badge = respuestaVendedor
        ? `<span class="consulta-badge leida">Respondida</span>`
        : `<span class="consulta-badge pendiente">Esperando respuesta</span>`;

    return Components.consultaCard(c, { isResolved: respuestaVendedor, badge });
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
