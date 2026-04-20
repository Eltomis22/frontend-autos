/* =========================================================
   Cato Group — Helpers compartidos para el hilo de consulta.
   Usado por consultas.js (vendedor) y mis-consultas.js (comprador).
   Requiere app.js (apiCall, escapeHtml, setButtonLoading, showAlert,
   formatPrice).
   ========================================================= */

/**
 * Render del timeline de mensajes de un hilo: mensaje inicial del comprador
 * + todas las respuestas intercaladas cronológicamente, con burbujas
 * diferenciadas por autor.
 *
 * @param {object} consulta          Consulta con respuestas (response del backend).
 * @param {string} currentUserId     idUsuario de la sesión actual.
 * @returns {string} HTML
 */
function renderThreadTimeline(consulta, currentUserId) {
    const comprador = consulta.comprador || {};
    const respuestas = Array.isArray(consulta.respuestas) ? consulta.respuestas : [];

    // Mensaje inicial = lo que envió el comprador al crear la consulta.
    const mensajes = [
        {
            idAutor: comprador.idUsuario,
            nombreAutor: comprador.nombre || 'Comprador',
            rolAutor: 'comprador',
            mensaje: consulta.mensaje,
            fecha: consulta.fechaConsulta,
            esInicial: true,
        },
        ...respuestas.map((r) => ({
            idAutor: r.autor?.idUsuario,
            nombreAutor: r.autor?.nombre || (r.autor?.rol === 'vendedor' ? 'Vendedor' : 'Comprador'),
            rolAutor: r.autor?.rol || 'comprador',
            mensaje: r.mensaje,
            fecha: r.fechaCreacion,
            esInicial: false,
        })),
    ];

    return `
        <div class="thread-timeline">
            ${mensajes.map((m) => renderBurbuja(m, currentUserId)).join('')}
        </div>`;
}

function renderBurbuja(mensaje, currentUserId) {
    const mine = mensaje.idAutor && mensaje.idAutor === currentUserId;
    const rolLabel = mensaje.rolAutor === 'vendedor' ? 'Vendedor' : 'Comprador';
    const fecha = mensaje.fecha
        ? new Date(mensaje.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
        : '';

    return `
        <div class="thread-message ${mine ? 'is-mine' : 'is-theirs'} rol-${escapeHtml(mensaje.rolAutor)}">
            <div class="thread-message-meta">
                <span class="thread-message-author">${escapeHtml(mensaje.nombreAutor)}</span>
                <span class="thread-message-role">${escapeHtml(rolLabel)}</span>
                ${fecha ? `<span class="thread-message-date">${fecha}</span>` : ''}
                ${mensaje.esInicial ? `<span class="thread-message-tag">Mensaje inicial</span>` : ''}
            </div>
            <div class="thread-message-body">${escapeHtml(mensaje.mensaje || '')}</div>
        </div>`;
}

/**
 * Render del formulario de respuesta al pie de un hilo. Se lo engancha
 * desde la página específica a un handler concreto.
 */
function renderReplyForm(idConsulta) {
    return `
        <form class="thread-reply" data-reply-for="${escapeHtml(idConsulta)}">
            <label class="thread-reply-label" for="reply-${escapeHtml(idConsulta)}">Tu respuesta</label>
            <textarea id="reply-${escapeHtml(idConsulta)}"
                      class="thread-reply-textarea"
                      rows="3"
                      maxlength="2000"
                      required
                      placeholder="Escribí tu mensaje..."></textarea>
            <div class="thread-reply-actions">
                <button type="submit" class="btn btn-primary btn-sm">Enviar respuesta</button>
            </div>
        </form>`;
}

/**
 * Intenta enviar una respuesta. Si sale bien, llama a onSuccess con la
 * respuesta nueva hidratada por el backend.
 */
async function enviarRespuesta(idConsulta, mensaje, btn) {
    setButtonLoading(btn, true, 'Enviando...');
    try {
        const respuesta = await apiCall(`/consultas/${idConsulta}/respuestas`, {
            method: 'POST',
            body: JSON.stringify({ mensaje }),
        });
        return respuesta;
    } finally {
        setButtonLoading(btn, false);
    }
}
