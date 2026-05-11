/* =========================================================
   components.js — Funciones de renderizado reutilizables.

   Cada función devuelve un string de HTML listo para inyectar
   con .innerHTML. El módulo se publica como `Components` y
   centraliza los patrones que antes se copiaban en cars.js,
   mis-publicaciones.js, consultas.js, mis-consultas.js,
   car-detail.js y el script inline de index.html:

     - extracción de imágenes de un vehículo
     - estados visuales (loading, empty-state)
     - tarjeta de vehículo (catálogo / home / mis publicaciones)
     - chips de meta (año, kilometraje, ubicación)
     - encabezado de vehículo en una consulta
     - card de consulta (vendedor / comprador)

   Convención: los listeners (clicks, submits) se enganchan
   desde la página específica DESPUÉS de inyectar el HTML, vía
   selectores sobre data-attributes. components.js no engancha
   eventos para que estas funciones sigan siendo puras.

   Requiere app.js (escapeHtml, formatPrice, formatKm, route).
   Para consultaCard también requiere consultas-thread.js
   (renderThreadTimeline, renderReplyForm).
   ========================================================= */

const Components = (() => {

    /* ---------- Imágenes de un vehículo ---------- */

    /**
     * Devuelve un array (posiblemente vacío) con las URLs de imágenes
     * de un vehículo. Soporta los dos formatos que devuelve el backend:
     * strings sueltos o objetos `{ urlImagen }`.
     */
    function imageUrls(car) {
        if (!Array.isArray(car?.imagenes)) return [];
        return car.imagenes
            .map((i) => (typeof i === 'string' ? i : i?.urlImagen))
            .filter(Boolean);
    }

    /** URL de la primera foto, o '' si no hay ninguna. */
    function primaryImage(car) {
        return imageUrls(car)[0] || '';
    }


    /* ---------- Estados visuales ---------- */

    /**
     * Bloque genérico de "no hay nada" / "hubo un error" / "sección bloqueada".
     * Reemplaza el HTML que estaba copypasteado en cada vista.
     *
     * @param {object}  o
     * @param {string}  o.icon       Emoji o texto a mostrar grande.
     * @param {string}  o.title      Título principal.
     * @param {string}  o.message    Texto secundario (opcional).
     * @param {string}  o.action     HTML extra (ej. un botón) bajo el mensaje.
     * @param {boolean} o.fullSpan   Si está dentro de una grilla, ocupar todas las columnas.
     */
    function emptyState({ icon = 'ℹ', title = '', message = '', action = '', fullSpan = false } = {}) {
        const styleAttr = fullSpan ? ' style="grid-column: 1 / -1;"' : '';
        return `
            <div class="empty-state"${styleAttr}>
                <div class="empty-icon">${icon}</div>
                <h3>${escapeHtml(title)}</h3>
                ${message ? `<p>${escapeHtml(message)}</p>` : ''}
                ${action ? `<div style="margin-top: 1rem;">${action}</div>` : ''}
            </div>`;
    }

    /** Spinner centrado para placeholders de carga. */
    function loading() {
        return '<div class="loading"><div class="spinner"></div></div>';
    }


    /* ---------- Tarjeta de vehículo ---------- */

    /**
     * Chips compactos con los metadatos típicos del vehículo.
     * Se devuelve como una tira de <span> (sin contenedor) para
     * embeberlo dentro de un `.car-card-meta` u otro envoltorio.
     */
    function carMeta(car) {
        const items = [];
        items.push(`📅 ${car.anio || '—'}`);
        if (car.kilometraje != null) items.push(`🛣️ ${formatKm(car.kilometraje)}`);
        if (car.ubicacion) items.push(`📍 ${escapeHtml(car.ubicacion)}`);
        return items.map((t) => `<span>${t}</span>`).join('');
    }

    /**
     * Imagen + badge "Disponible" + checkbox opcional para comparar.
     * Se separa para poder reusarla en variantes futuras sin re-render
     * de toda la card.
     */
    function carCardImage(car, { withCheckbox = false, withBadge = true } = {}) {
        const foto = primaryImage(car);
        const id = car.idVehiculo;
        return `
            <div class="car-card-image">
                ${foto
                    ? `<img src="${escapeHtml(foto)}" alt="${escapeHtml(car.marca)} ${escapeHtml(car.modelo)}" onerror="this.parentElement.innerHTML='<div class=\\'no-image\\'>Sin foto disponible</div>'">`
                    : `<div class="no-image">Sin foto disponible</div>`}
                ${withBadge ? `<span class="car-card-badge">Disponible</span>` : ''}
                ${withCheckbox
                    ? `<label class="car-card-checkbox" title="Marcar para comparar">
                           <input type="checkbox" class="car-checkbox" data-id="${escapeHtml(String(id))}">
                       </label>`
                    : ''}
            </div>`;
    }

    /**
     * Tarjeta completa de vehículo. Variantes:
     *   - withCheckbox: true → suma el checkbox de comparación (catálogo)
     *   - withBadge: true (default) → muestra el badge "Disponible"
     *   - withFavorito: true → muestra un botón corazón. El estado inicial
     *     se determina por `favoritoIds` (Set o array de ids favoritados).
     *     El click dispara el evento `favorito:toggle` con detail.idVehiculo
     *     en window — la página decide qué hacer con el toggle.
     *
     * El link "Ver detalles" usa route('car-detail') para resolver
     * automáticamente la ruta relativa correcta según la página actual.
     */
    function carCard(car, opts = {}) {
        const detailHref = `${route('car-detail')}?id=${encodeURIComponent(car.idVehiculo)}`;
        const favoritoBtn = opts.withFavorito ? favoritoButton(car, opts.favoritoIds) : '';
        return `
            <article class="car-card">
                ${carCardImage(car, opts)}
                ${favoritoBtn}
                <div class="car-card-body">
                    <h3 class="car-card-title">${escapeHtml(car.marca)} ${escapeHtml(car.modelo)}</h3>
                    <div class="car-card-meta">${carMeta(car)}</div>
                    <div class="car-card-price">${formatPrice(car.precio)}</div>
                    <div class="car-card-actions">
                        <a href="${detailHref}" class="btn btn-primary btn-block">Ver detalles</a>
                    </div>
                </div>
            </article>`;
    }

    /** Botón ❤ que se monta en la esquina de la card. */
    function favoritoButton(car, favoritoIds) {
        const id = String(car.idVehiculo);
        const set = favoritoIds instanceof Set
            ? favoritoIds
            : new Set((favoritoIds || []).map(String));
        const activo = set.has(id);
        return `
            <button type="button"
                    class="favorito-btn ${activo ? 'is-active' : ''}"
                    data-favorito="${escapeHtml(id)}"
                    aria-pressed="${activo}"
                    aria-label="${activo ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
                ${activo ? '❤️' : '🤍'}
            </button>`;
    }


    /* ---------- Card de consulta ---------- */

    /**
     * Encabezado con título del vehículo + subtítulo (año / precio).
     * Compartido por la bandeja del vendedor y el historial del comprador.
     */
    function consultaVehiculoHeader(consulta) {
        const v = consulta.vehiculo || {};
        const title = `${escapeHtml(v.marca || '')} ${escapeHtml(v.modelo || '')}`.trim() || 'Vehículo';
        const subtitleParts = [
            v.anio ? `Año ${v.anio}` : null,
            v.precio != null ? formatPrice(v.precio) : null,
        ].filter(Boolean);
        const subtitle = subtitleParts.join(' · ');
        const detailHref = `${route('car-detail')}?id=${encodeURIComponent(v.idVehiculo)}`;
        return `
            <div class="consulta-vehiculo">
                <a href="${detailHref}" class="consulta-vehiculo-title">${title}</a>
                ${subtitle ? `<span class="consulta-vehiculo-meta">${subtitle}</span>` : ''}
            </div>`;
    }

    /**
     * Card completa de consulta con timeline y formulario de respuesta.
     * Recibe los pedazos variables (badge y footer) ya renderizados, así
     * cada vista controla su semántica:
     *   - vendedor: badge "Leída/Nueva" + footer con datos del comprador
     *   - comprador: badge "Respondida/Esperando" + sin footer
     *
     * @param {object} consulta
     * @param {object} o
     * @param {boolean} o.isResolved   Aplica clase visual "resuelto" (is-read).
     * @param {string}  o.badge        HTML del badge a la derecha del header.
     * @param {string}  o.footer       HTML del footer (opcional).
     */
    function consultaCard(consulta, { isResolved = false, badge = '', footer = '' } = {}) {
        const stateClass = isResolved ? 'is-read' : 'is-new';
        const currentUserId = (typeof Auth !== 'undefined' ? (Auth.getUser() || {}).idUsuario : undefined);
        const timeline = (typeof renderThreadTimeline === 'function')
            ? renderThreadTimeline(consulta, currentUserId)
            : '';
        const replyForm = (typeof renderReplyForm === 'function')
            ? renderReplyForm(consulta.idConsulta)
            : '';
        return `
            <article class="consulta-card ${stateClass}" data-consulta-id="${escapeHtml(consulta.idConsulta)}">
                <header class="consulta-header">
                    ${consultaVehiculoHeader(consulta)}
                    ${badge}
                </header>
                ${timeline}
                ${replyForm}
                ${footer}
            </article>`;
    }


    return {
        imageUrls,
        primaryImage,
        emptyState,
        loading,
        carMeta,
        carCardImage,
        carCard,
        favoritoButton,
        consultaVehiculoHeader,
        consultaCard,
    };
})();
