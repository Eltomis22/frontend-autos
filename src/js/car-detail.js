/* Detalle de un vehículo + valoración + contacto al vendedor */

document.addEventListener('DOMContentLoaded', () => {
    renderNavbar('cars');
    const urlParams = new URLSearchParams(window.location.search);
    const carId = urlParams.get('id');

    if (!carId) {
        renderError('No se especificó el vehículo a mostrar.');
        return;
    }
    loadCarDetail(carId);
});

async function loadCarDetail(id) {
    try {
        const car = await apiCall(`/vehiculos/${id}`);

        // Estos fetches son OPCIONALES — si fallan no rompemos la página,
        // simplemente no mostramos el panel correspondiente.
        const [iaAnalysis, historial, duplicados, relacionados, esFavorito] = await Promise.all([
            apiCall(`/ia/analizar/${id}`).catch(() => null),
            apiCall(`/vehiculos/${id}/historial-precio`).catch(() => []),
            apiCall(`/vehiculos/${id}/duplicados`).catch(() => []),
            apiCall(`/vehiculos/${id}/relacionados`).catch(() => []),
            (Auth.isLoggedIn() && Auth.getRol() === 'comprador')
                ? apiCall('/favoritos/ids')
                    .then((ids) => Array.isArray(ids) && ids.map(String).includes(String(id)))
                    .catch(() => false)
                : Promise.resolve(false),
        ]);

        displayCarDetail(car, iaAnalysis, {
            historial,
            duplicados,
            relacionados,
            esFavorito,
        });
    } catch (error) {
        console.error('Error cargando detalle:', error);
        renderError(error.message);
    }
}

function renderError(msg) {
    document.getElementById('carDetail').innerHTML = Components.emptyState({
        icon: '⚠️',
        title: 'No se pudo cargar el vehículo',
        message: msg,
    });
}

function displayCarDetail(car, ia, extras = {}) {
    // Components.imageUrls reemplaza la antigua extractImagenes local.
    const imagenes = Components.imageUrls(car);
    const mainImg = imagenes[0] || '';
    const {
        historial = [],
        duplicados = [],
        relacionados = [],
        esFavorito = false,
    } = extras;

    const container = document.getElementById('carDetail');
    container.innerHTML = `
        <div class="detail-grid">
            <div class="detail-gallery">
                <div class="detail-gallery-main" id="mainImage" ${mainImg ? 'data-zoomable="1"' : ''} title="${mainImg ? 'Click para ampliar' : ''}">
                    ${mainImg
                        ? `<img src="${escapeHtml(mainImg)}" alt="${escapeHtml(car.marca)} ${escapeHtml(car.modelo)}">
                           <span class="gallery-zoom-hint" aria-hidden="true">🔍 Click para ampliar</span>`
                        : `<div class="no-image" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-text-muted);">Sin foto disponible</div>`
                    }
                </div>
                ${imagenes.length > 1 ? `
                    <div class="detail-gallery-thumbs">
                        ${imagenes.slice(0, 8).map((src, i) => `<img src="${escapeHtml(src)}" data-index="${i}" class="${i === 0 ? 'active' : ''}" alt="Foto ${i + 1}">`).join('')}
                    </div>` : ''}
            </div>

            <div class="detail-info">
                ${renderDuplicadosBadge(duplicados)}

                <div class="detail-title-row">
                    <h1>${escapeHtml(car.marca)} ${escapeHtml(car.modelo)}</h1>
                    ${renderFavoritoBtnDetail(car.idVehiculo, esFavorito)}
                </div>
                <div class="location">📍 ${escapeHtml(car.ubicacion || 'Ubicación no especificada')}</div>
                <div class="price">${formatPrice(car.precio)}</div>

                <div class="detail-specs">
                    ${spec('Año', car.anio)}
                    ${spec('Kilometraje', car.kilometraje != null ? formatKm(car.kilometraje) : null)}
                    ${spec('Combustible', car.tipoCombustible)}
                    ${spec('Transmisión', car.transmision)}
                </div>

                ${car.descripcion ? `
                    <div class="detail-description">
                        <h3>Descripción</h3>
                        <p>${escapeHtml(car.descripcion)}</p>
                    </div>` : ''}

                ${renderSellerCard(car.vendedor)}

                ${renderIaPanel(ia, Number(car.precio))}
            </div>
        </div>

        <!-- Sección de paneles secundarios distribuidos en grilla full-width.
             Sale del flujo de detail-info para que la página no quede como
             una columna larga de paneles apilados; los paneles "más anchos
             que altos" se acomodan en 2-3 columnas según el viewport. -->
        <section class="detail-extras-grid">
            ${renderCostoTotal(Number(car.precio))}
            ${renderSimuladorFinanciacion(Number(car.precio))}
            ${renderHistorialPrecio(historial)}
        </section>

        <!-- Contacto al vendedor en su propia card a todo lo ancho:
             el textarea queda más cómodo en lugar de una columna estrecha. -->
        <section class="detail-contact">
            <div class="card">
                <div class="card-body">
                    <h3 style="font-weight:700;margin-bottom:0.8rem;">Contactar al vendedor</h3>
                    <div id="contactMessage"></div>
                    <form id="contactForm">
                        <div class="form-group">
                            <label for="message">Tu consulta</label>
                            <textarea id="message" placeholder="Hola, estoy interesado en el vehículo..." required></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary btn-block" id="contactBtn">Enviar consulta</button>
                    </form>
                    <p class="form-hint" style="margin-top: 0.8rem;">
                        El vendedor recibirá tu consulta junto con tus datos de contacto registrados.
                    </p>
                </div>
            </div>
        </section>

        <!-- Reportar al final, como acción discreta. -->
        ${renderReporteBtn(car.idVehiculo)}

        ${renderRelacionados(relacionados)}
        ${renderLightbox(imagenes)}`;

    // Galería interactiva
    document.querySelectorAll('.detail-gallery-thumbs img').forEach(thumb => {
        thumb.addEventListener('click', (e) => {
            document.querySelectorAll('.detail-gallery-thumbs img').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            const main = document.querySelector('#mainImage img');
            if (main) main.src = e.target.src;
        });
    });

    // Engancha el simulador de financiación si se renderizó.
    bindSimuladorFinanciacion(Number(car.precio));

    // Listeners de los extras opcionales:
    bindFavoritoBtnDetail(car.idVehiculo);
    bindReporteBtn(car.idVehiculo);
    bindLightbox(imagenes);

    // Formulario de contacto real — persiste la consulta en el backend (POST /consultas).
    document.getElementById('contactForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('contactBtn');
        const message = document.getElementById('message').value.trim();
        if (message.length < 5) {
            showAlert('contactMessage', 'La consulta debe tener al menos 5 caracteres.', 'error');
            return;
        }
        if (!Auth.isLoggedIn()) {
            showAlert('contactMessage', 'Iniciá sesión para contactar al vendedor.', 'error');
            return;
        }
        setButtonLoading(btn, true, 'Enviando...');
        try {
            await apiCall('/consultas', {
                method: 'POST',
                body: JSON.stringify({
                    idVehiculo: car.idVehiculo,
                    mensaje: message,
                }),
            });
            showAlert('contactMessage', 'Consulta enviada correctamente. El vendedor recibirá tus datos de contacto.', 'success');
            document.getElementById('message').value = '';
        } catch (err) {
            showAlert('contactMessage', 'No se pudo enviar la consulta: ' + err.message, 'error');
        } finally {
            setButtonLoading(btn, false);
        }
    });
}

function renderSellerCard(vendedor) {
    if (!vendedor) return '';
    const nombre = (vendedor.nombre || '').trim() || 'Vendedor particular';
    const iniciales = nombre
        .split(/\s+/)
        .map((p) => p.charAt(0).toUpperCase())
        .filter(Boolean)
        .slice(0, 2)
        .join('') || 'V';
    const fecha = vendedor.fechaCreacion ? new Date(vendedor.fechaCreacion) : null;
    const anioMiembro = fecha && !isNaN(fecha.getTime()) ? fecha.getFullYear() : null;
    const meta = anioMiembro
        ? `Miembro desde ${anioMiembro}`
        : 'Publicado por un vendedor verificado';

    return `
        <div class="seller-card">
            <div class="seller-avatar" aria-hidden="true">${escapeHtml(iniciales)}</div>
            <div class="seller-body">
                <span class="seller-label">Publicado por</span>
                <span class="seller-name">${escapeHtml(nombre)}</span>
                <span class="seller-meta">${escapeHtml(meta)}</span>
            </div>
            <span class="seller-badge">Vendedor</span>
        </div>`;
}

function spec(label, value) {
    return `
        <div class="spec-item">
            <span class="spec-label">${label}</span>
            <span class="spec-value">${value != null && value !== '' ? escapeHtml(String(value)) : '—'}</span>
        </div>`;
}

function renderIaPanel(ia, precioPublicado) {
    if (!ia) {
        return `
            <div class="ia-panel">
                <div class="ia-panel-header">
                    <span class="ia-badge">CATO Group</span>
                    <h3>Valoración del vehículo</h3>
                </div>
                <p style="color: var(--color-text-muted); font-size: 0.95rem;">
                    Todavía no hay una valoración publicada para esta unidad.
                </p>
            </div>`;
    }

    const estado = (ia.estadoGeneral || '').toLowerCase();
    const clase = estado.includes('excel')    ? 'excelente'
                : estado.includes('buen')     ? 'bueno'
                : estado.includes('regular')  ? 'regular'
                : estado.includes('reparac')  ? 'reparacion'
                : 'bueno';

    const bullets = typeof ia.danosVisibles === 'string'
        ? ia.danosVisibles.split('|').map(s => s.trim()).filter(Boolean)
        : [];

    // Veredicto sobre el precio publicado vs el rango estimado por la IA.
    // Es la implementación de la funcionalidad opcional #2 (estimador de
    // mercado): "bajo / dentro del promedio / sobrevalorado".
    const veredicto = priceVerdict(precioPublicado, ia);

    return `
        <div class="ia-panel">
            <div class="ia-panel-header">
                <span class="ia-badge">CATO Group</span>
                <h3>Valoración del vehículo</h3>
            </div>
            <div class="ia-status ${clase}">Estado: ${escapeHtml(ia.estadoGeneral || 'a consultar')}</div>
            ${bullets.length ? `<ul class="ia-bullets">${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : ''}
            ${ia.precioEstimadoMin != null && ia.precioEstimadoMax != null ? `
                <div class="ia-price-estimate">
                    <div class="label">Rango de precio de mercado</div>
                    <div class="range">${formatPrice(ia.precioEstimadoMin)} — ${formatPrice(ia.precioEstimadoMax)}</div>
                    ${veredicto ? `
                        <div class="ia-price-verdict ${veredicto.tone}">
                            <span class="verdict-label">${veredicto.label}</span>
                            <span class="verdict-detail">${escapeHtml(veredicto.detail)}</span>
                        </div>` : ''}
                </div>` : ''}
        </div>`;
}

/* =========================================================
   Extras opcionales del PDF (frontend puro)
   ========================================================= */

/**
 * Extra #2 — Estimador de precio (bajo / dentro / sobre el mercado).
 * Compara el precio publicado contra el rango que ya devuelve la IA.
 * Devuelve null si no hay datos suficientes.
 */
function priceVerdict(precio, ia) {
    if (!precio || !ia || ia.precioEstimadoMin == null || ia.precioEstimadoMax == null) {
        return null;
    }
    if (precio < ia.precioEstimadoMin) {
        return {
            tone: 'bajo',
            label: '🟢 Bajo el promedio del mercado',
            detail: 'El precio publicado está por debajo del rango estimado. Posible oportunidad.',
        };
    }
    if (precio > ia.precioEstimadoMax) {
        return {
            tone: 'sobre',
            label: '🔴 Sobrevalorado',
            detail: 'El precio publicado supera el rango estimado. Conviene negociar o comparar con otras unidades.',
        };
    }
    return {
        tone: 'medio',
        label: '🟡 Dentro del promedio',
        detail: 'El precio publicado coincide con el rango estimado de mercado.',
    };
}

/**
 * Extra #19 — Calculadora de costo total del vehículo.
 * Estima patente, seguro y mantenimiento mensual a partir del precio.
 * Las tasas son aproximadas para Argentina y se documentan en el panel
 * para que el comprador entienda que es orientativo.
 */
function renderCostoTotal(precio) {
    if (!precio || precio <= 0) return '';

    // Tasas aproximadas (orden de magnitud de mercado argentino, 2026).
    const TASA_PATENTE = 0.03;          // ~3% del valor anual
    const TASA_SEGURO = 0.05;           // ~5% del valor anual (terceros completo)
    const MANTENIMIENTO_MENSUAL = 50;   // USD orientativos por uso normal

    const patenteAnual = Math.round(precio * TASA_PATENTE);
    const seguroAnual = Math.round(precio * TASA_SEGURO);
    const mensual = Math.round(patenteAnual / 12 + seguroAnual / 12 + MANTENIMIENTO_MENSUAL);
    const anual = patenteAnual + seguroAnual + MANTENIMIENTO_MENSUAL * 12;

    return `
        <div class="cost-panel">
            <div class="cost-panel-header">
                <span class="ia-badge">Costos</span>
                <h3>Costos asociados estimados</h3>
            </div>
            <p class="cost-panel-lead">
                Aproximación a partir del precio publicado. Variables según jurisdicción
                (patente), aseguradora (seguro) y uso real (mantenimiento).
            </p>
            <ul class="cost-list">
                <li><span class="cost-key">Patente anual (≈ 3% del valor)</span><span class="cost-val">${formatPrice(patenteAnual)}</span></li>
                <li><span class="cost-key">Seguro anual (≈ 5% del valor)</span><span class="cost-val">${formatPrice(seguroAnual)}</span></li>
                <li><span class="cost-key">Mantenimiento mensual</span><span class="cost-val">${formatPrice(MANTENIMIENTO_MENSUAL)}</span></li>
            </ul>
            <div class="cost-totals">
                <div class="cost-total-row">
                    <span>Costo mensual aprox.</span>
                    <strong>${formatPrice(mensual)}</strong>
                </div>
                <div class="cost-total-row">
                    <span>Costo anual aprox.</span>
                    <strong>${formatPrice(anual)}</strong>
                </div>
            </div>
        </div>`;
}

/**
 * Extra #13 — Simulador de financiación.
 * Cálculo con sistema francés de amortización:
 *     cuota = capital * (i * (1 + i)^n) / ((1 + i)^n - 1)
 * Donde i = tasa mensual decimal y n = cantidad de meses.
 *
 * El form es 100% cliente: no pega contra el backend. Los inputs
 * disparan recálculo en cada change (ver bindSimuladorFinanciacion).
 */
function renderSimuladorFinanciacion(precio) {
    if (!precio || precio <= 0) return '';
    const anticipoSugerido = Math.round(precio * 0.3);
    return `
        <div class="finance-panel">
            <div class="finance-panel-header">
                <span class="ia-badge">Financiación</span>
                <h3>Simulador de cuotas</h3>
            </div>
            <form id="financeForm" onsubmit="return false;">
                <div class="finance-grid">
                    <div class="form-group">
                        <label for="finAnticipo">Anticipo (USD)</label>
                        <input type="number" id="finAnticipo" min="0" max="${precio}" value="${anticipoSugerido}">
                    </div>
                    <div class="form-group">
                        <label for="finPlazo">Plazo (meses)</label>
                        <input type="number" id="finPlazo" min="6" max="84" step="6" value="36">
                    </div>
                    <div class="form-group">
                        <label for="finTasa">Tasa anual (%)</label>
                        <input type="number" id="finTasa" min="0" max="200" step="0.5" value="60">
                    </div>
                </div>
            </form>
            <div class="finance-result">
                <div class="finance-result-row">
                    <span>Cuota mensual</span>
                    <strong id="finCuota">—</strong>
                </div>
                <div class="finance-result-row">
                    <span>Total a pagar (anticipo + cuotas)</span>
                    <strong id="finTotal">—</strong>
                </div>
                <div class="finance-result-row">
                    <span>Intereses totales</span>
                    <strong id="finInteres">—</strong>
                </div>
            </div>
            <p class="form-hint">
                Cálculo orientativo con sistema francés. La cuota real depende de la entidad financiera.
            </p>
        </div>`;
}

/** Engancha listeners al simulador y dispara el primer cálculo. */
function bindSimuladorFinanciacion(precio) {
    if (!precio || precio <= 0) return;

    const elAnticipo = document.getElementById('finAnticipo');
    const elPlazo = document.getElementById('finPlazo');
    const elTasa = document.getElementById('finTasa');
    const elCuota = document.getElementById('finCuota');
    const elTotal = document.getElementById('finTotal');
    const elInteres = document.getElementById('finInteres');
    if (!elAnticipo || !elPlazo || !elTasa || !elCuota || !elTotal || !elInteres) return;

    const recalcular = () => {
        const anticipo = Math.max(0, Math.min(Number(elAnticipo.value) || 0, precio));
        const meses = Math.max(1, Math.round(Number(elPlazo.value) || 36));
        const tasaAnual = Math.max(0, Number(elTasa.value) || 0);

        const capital = Math.max(0, precio - anticipo);
        const i = (tasaAnual / 100) / 12;

        let cuota;
        if (i === 0 || capital === 0) {
            cuota = capital / meses;
        } else {
            cuota = capital * (i * Math.pow(1 + i, meses)) / (Math.pow(1 + i, meses) - 1);
        }
        const total = cuota * meses + anticipo;
        const interes = Math.max(0, total - precio);

        elCuota.textContent = formatPrice(Math.round(cuota));
        elTotal.textContent = formatPrice(Math.round(total));
        elInteres.textContent = formatPrice(Math.round(interes));
    };

    [elAnticipo, elPlazo, elTasa].forEach((input) => input.addEventListener('input', recalcular));
    recalcular();
}


/* =========================================================
   Extras opcionales que sí pegan contra el backend
   ========================================================= */

/* ---------- #3 Favoritos (botón en la ficha) ---------- */

function renderFavoritoBtnDetail(idVehiculo, esFavorito) {
    // Solo se muestra para compradores logueados. Visitantes y vendedores
    // no ven el botón (los vendedores no consumen su propio catálogo).
    if (!Auth.isLoggedIn() || Auth.getRol() !== 'comprador') return '';
    return `
        <button type="button"
                id="favoritoDetailBtn"
                class="favorito-btn favorito-btn--detail ${esFavorito ? 'is-active' : ''}"
                data-favorito="${escapeHtml(String(idVehiculo))}"
                aria-pressed="${esFavorito}"
                aria-label="${esFavorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
            ${esFavorito ? '❤️' : '🤍'}
        </button>`;
}

function bindFavoritoBtnDetail() {
    const btn = document.getElementById('favoritoDetailBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const id = btn.dataset.favorito;
        try {
            const r = await apiCall(`/favoritos/${id}`, { method: 'POST' });
            btn.classList.toggle('is-active', r.favorito);
            btn.setAttribute('aria-pressed', String(r.favorito));
            btn.innerHTML = r.favorito ? '❤️' : '🤍';
            btn.setAttribute(
                'aria-label',
                r.favorito ? 'Quitar de favoritos' : 'Agregar a favoritos',
            );
        } catch (err) {
            console.error('Error toggleando favorito:', err);
        }
    });
}


/* ---------- #14 Historial de cambios de precio ---------- */

function renderHistorialPrecio(historial) {
    if (!Array.isArray(historial) || historial.length === 0) return '';

    const filas = historial.map((h) => {
        const fecha = h.fechaCambio
            ? new Date(h.fechaCambio).toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: 'numeric' })
            : '—';
        const antes = Number(h.precioAnterior);
        const despues = Number(h.precioNuevo);
        const diff = despues - antes;
        const subio = diff > 0;
        const tone = subio ? 'sube' : 'baja';
        const flecha = subio ? '↑' : '↓';
        return `
            <li class="historial-item">
                <span class="historial-fecha">${escapeHtml(fecha)}</span>
                <span class="historial-cambio ${tone}">
                    ${formatPrice(antes)} → ${formatPrice(despues)}
                    <span class="historial-delta">${flecha} ${formatPrice(Math.abs(diff))}</span>
                </span>
            </li>`;
    }).join('');

    return `
        <div class="historial-panel">
            <div class="historial-header">
                <span class="ia-badge">Historial</span>
                <h3>Cambios de precio</h3>
            </div>
            <ul class="historial-list">${filas}</ul>
        </div>`;
}


/* ---------- #15 Reporte de publicaciones ---------- */

const MOTIVOS_REPORTE = [
    { value: 'precio_sospechoso',  label: 'Precio sospechoso' },
    { value: 'fotos_falsas',       label: 'Fotos falsas o no corresponden' },
    { value: 'fraude',             label: 'Posible fraude' },
    { value: 'duplicado',          label: 'Publicación duplicada' },
    { value: 'datos_incorrectos',  label: 'Datos incorrectos' },
    { value: 'otro',               label: 'Otro motivo' },
];

function renderReporteBtn(idVehiculo) {
    // Solo se muestra a usuarios logueados. El vendedor de esta publicación
    // verá el botón pero el backend rechaza con 403 si intenta reportarse.
    if (!Auth.isLoggedIn()) return '';
    return `
        <button type="button"
                id="reportarBtn"
                class="btn btn-ghost btn-sm reportar-link"
                data-vehiculo="${escapeHtml(String(idVehiculo))}">
            ⚠ Reportar esta publicación
        </button>

        <div id="reporteModal" class="modal-overlay hidden" aria-hidden="true">
            <div class="modal-content" role="dialog" aria-labelledby="reporteTitle">
                <div class="modal-header">
                    <h2 id="reporteTitle">Reportar publicación</h2>
                    <button class="modal-close" id="reporteClose" aria-label="Cerrar">×</button>
                </div>
                <form id="reporteForm" class="modal-body">
                    <div id="reporteFeedback"></div>
                    <div class="form-group">
                        <label for="reporteMotivo">Motivo</label>
                        <select id="reporteMotivo" required>
                            <option value="">Seleccionar</option>
                            ${MOTIVOS_REPORTE.map(m => `<option value="${m.value}">${m.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="reporteDescripcion">Detalles (opcional)</label>
                        <textarea id="reporteDescripcion" rows="3" maxlength="500"
                                  placeholder="Información adicional para los moderadores..."></textarea>
                    </div>
                    <div class="flex-row" style="justify-content: flex-end; gap: 0.6rem;">
                        <button type="button" class="btn btn-ghost" id="reporteCancel">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="reporteSubmit">Enviar reporte</button>
                    </div>
                </form>
            </div>
        </div>`;
}

function bindReporteBtn(idVehiculo) {
    const btn = document.getElementById('reportarBtn');
    const modal = document.getElementById('reporteModal');
    if (!btn || !modal) return;

    const close = () => {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
    };
    const open = () => {
        if (!Auth.isLoggedIn()) {
            alert('Iniciá sesión para reportar publicaciones.');
            return;
        }
        clearAlert('reporteFeedback');
        document.getElementById('reporteForm').reset();
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
    };

    btn.addEventListener('click', open);
    document.getElementById('reporteClose').addEventListener('click', close);
    document.getElementById('reporteCancel').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    document.getElementById('reporteForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('reporteSubmit');
        const motivo = document.getElementById('reporteMotivo').value;
        const descripcion = document.getElementById('reporteDescripcion').value.trim();
        if (!motivo) {
            showAlert('reporteFeedback', 'Elegí un motivo para el reporte.', 'error');
            return;
        }
        setButtonLoading(submitBtn, true, 'Enviando...');
        try {
            await apiCall('/reportes', {
                method: 'POST',
                body: JSON.stringify({
                    idVehiculo,
                    motivo,
                    descripcion: descripcion || undefined,
                }),
            });
            close();
            showAlert('contactMessage', 'Reporte enviado. Gracias por avisar.', 'success');
        } catch (err) {
            showAlert('reporteFeedback', 'No se pudo enviar el reporte: ' + err.message, 'error');
        } finally {
            setButtonLoading(submitBtn, false);
        }
    });
}


/* ---------- #18 Detector de fotos repetidas ---------- */

function renderDuplicadosBadge(duplicados) {
    if (!Array.isArray(duplicados) || duplicados.length === 0) return '';
    const cantidad = duplicados.length;
    return `
        <div class="duplicados-warning">
            <strong>⚠ Posible duplicado</strong>
            <span>
                Esta publicación comparte ${cantidad === 1 ? 'una imagen' : `${cantidad} imágenes`}
                con ${cantidad === 1 ? 'otra publicación' : 'otras publicaciones'} del catálogo.
                Verificá los datos del vehículo antes de avanzar.
            </span>
        </div>`;
}


/* ---------- Lightbox con zoom (galería ampliada) ----------
   Click en la foto principal → abre un modal a pantalla completa
   con la imagen al máximo. Click adentro alterna entre "fit" y
   "zoom 2x". Flechas para navegar entre fotos. Click afuera o
   ESC cierra. */

let lightboxState = { index: 0, zoom: 1, fotos: [] };

function renderLightbox(imagenes) {
    if (!Array.isArray(imagenes) || imagenes.length === 0) return '';
    return `
        <div id="lightbox" class="lightbox hidden" aria-hidden="true" role="dialog" aria-label="Galería ampliada">
            <button type="button" class="lightbox-close" id="lightboxClose" aria-label="Cerrar">×</button>
            <button type="button" class="lightbox-nav lightbox-prev" id="lightboxPrev" aria-label="Foto anterior">‹</button>
            <button type="button" class="lightbox-nav lightbox-next" id="lightboxNext" aria-label="Foto siguiente">›</button>
            <div class="lightbox-stage" id="lightboxStage">
                <img id="lightboxImg" alt="Foto ampliada del vehículo">
            </div>
            <div class="lightbox-counter" id="lightboxCounter"></div>
        </div>`;
}

function bindLightbox(imagenes) {
    if (!Array.isArray(imagenes) || imagenes.length === 0) return;
    lightboxState.fotos = imagenes;

    const main = document.getElementById('mainImage');
    const lb = document.getElementById('lightbox');
    if (!main || !lb) return;

    // Abrir al click sobre la foto principal
    main.addEventListener('click', () => {
        const activeThumb = document.querySelector('.detail-gallery-thumbs img.active');
        const startIdx = activeThumb ? Number(activeThumb.dataset.index) : 0;
        abrirLightbox(startIdx);
    });

    // También abrir desde un click sobre una miniatura (doble click es UX rara,
    // así que usamos click simple — la miniatura ya quedó "activa" por el handler
    // de galería que está más arriba; este listener viene después y abre el modal).
    document.querySelectorAll('.detail-gallery-thumbs img').forEach((thumb) => {
        thumb.addEventListener('dblclick', () => {
            abrirLightbox(Number(thumb.dataset.index));
        });
    });

    document.getElementById('lightboxClose').addEventListener('click', cerrarLightbox);
    document.getElementById('lightboxPrev').addEventListener('click', (e) => { e.stopPropagation(); navegarLightbox(-1); });
    document.getElementById('lightboxNext').addEventListener('click', (e) => { e.stopPropagation(); navegarLightbox(1); });

    // Click afuera de la imagen cierra. Click sobre la imagen alterna zoom.
    lb.addEventListener('click', (e) => {
        if (e.target === lb || e.target.id === 'lightboxStage') cerrarLightbox();
    });
    document.getElementById('lightboxImg').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleZoomLightbox();
    });

    // Teclado: ESC cierra, flechas navegan.
    document.addEventListener('keydown', (e) => {
        if (lb.classList.contains('hidden')) return;
        if (e.key === 'Escape') cerrarLightbox();
        if (e.key === 'ArrowLeft') navegarLightbox(-1);
        if (e.key === 'ArrowRight') navegarLightbox(1);
    });
}

function abrirLightbox(idx) {
    const lb = document.getElementById('lightbox');
    if (!lb || !lightboxState.fotos.length) return;
    lightboxState.index = Math.max(0, Math.min(idx || 0, lightboxState.fotos.length - 1));
    lightboxState.zoom = 1;
    pintarLightbox();
    lb.classList.remove('hidden');
    lb.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // bloquea scroll de fondo
}

function cerrarLightbox() {
    const lb = document.getElementById('lightbox');
    if (!lb) return;
    lb.classList.add('hidden');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function navegarLightbox(delta) {
    const total = lightboxState.fotos.length;
    if (total === 0) return;
    lightboxState.index = (lightboxState.index + delta + total) % total;
    lightboxState.zoom = 1;
    pintarLightbox();
}

function toggleZoomLightbox() {
    lightboxState.zoom = lightboxState.zoom === 1 ? 2 : 1;
    pintarLightbox();
}

function pintarLightbox() {
    const img = document.getElementById('lightboxImg');
    const counter = document.getElementById('lightboxCounter');
    if (!img) return;
    img.src = lightboxState.fotos[lightboxState.index];
    img.style.transform = `scale(${lightboxState.zoom})`;
    img.style.cursor = lightboxState.zoom === 1 ? 'zoom-in' : 'zoom-out';
    if (counter) {
        counter.textContent = `${lightboxState.index + 1} / ${lightboxState.fotos.length}`;
    }
    // Mostrar/ocultar flechas si hay una sola foto
    const total = lightboxState.fotos.length;
    document.getElementById('lightboxPrev').style.visibility = total > 1 ? '' : 'hidden';
    document.getElementById('lightboxNext').style.visibility = total > 1 ? '' : 'hidden';
}


/* ---------- Autos relacionados al pie de la ficha ---------- */

function renderRelacionados(relacionados) {
    if (!Array.isArray(relacionados) || relacionados.length === 0) return '';
    return `
        <section class="relacionados-section">
            <div class="relacionados-header">
                <h2 class="section-title" style="margin-bottom: 0.2rem;">Autos relacionados</h2>
                <p class="section-subtitle" style="margin-bottom: 0;">
                    Otras unidades parecidas del catálogo que te pueden interesar.
                </p>
            </div>
            <div class="cars-grid">
                ${relacionados.map((car) => Components.carCard(car)).join('')}
            </div>
        </section>`;
}
