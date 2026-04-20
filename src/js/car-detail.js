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
        let iaAnalysis = null;
        try { iaAnalysis = await apiCall(`/ia/analizar/${id}`); }
        catch { /* valoración opcional */ }
        displayCarDetail(car, iaAnalysis);
    } catch (error) {
        console.error('Error cargando detalle:', error);
        renderError(error.message);
    }
}

function renderError(msg) {
    document.getElementById('carDetail').innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <h3>No se pudo cargar el vehículo</h3>
            <p>${msg}</p>
        </div>`;
}

function extractImagenes(car) {
    if (!Array.isArray(car.imagenes)) return [];
    return car.imagenes
        .map(i => typeof i === 'string' ? i : i?.urlImagen)
        .filter(Boolean);
}

function displayCarDetail(car, ia) {
    const imagenes = extractImagenes(car);
    const mainImg = imagenes[0] || '';

    const container = document.getElementById('carDetail');
    container.innerHTML = `
        <div class="detail-grid">
            <div class="detail-gallery">
                <div class="detail-gallery-main" id="mainImage">
                    ${mainImg
                        ? `<img src="${escapeHtml(mainImg)}" alt="${escapeHtml(car.marca)} ${escapeHtml(car.modelo)}">`
                        : `<div class="no-image" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-text-muted);">Sin foto disponible</div>`
                    }
                </div>
                ${imagenes.length > 1 ? `
                    <div class="detail-gallery-thumbs">
                        ${imagenes.slice(0, 8).map((src, i) => `<img src="${escapeHtml(src)}" data-index="${i}" class="${i === 0 ? 'active' : ''}" alt="Foto ${i + 1}">`).join('')}
                    </div>` : ''}
            </div>

            <div class="detail-info">
                <h1>${escapeHtml(car.marca)} ${escapeHtml(car.modelo)}</h1>
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

                ${renderIaPanel(ia)}

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
            </div>
        </div>`;

    // Galería interactiva
    document.querySelectorAll('.detail-gallery-thumbs img').forEach(thumb => {
        thumb.addEventListener('click', (e) => {
            document.querySelectorAll('.detail-gallery-thumbs img').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            const main = document.querySelector('#mainImage img');
            if (main) main.src = e.target.src;
        });
    });

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

function renderIaPanel(ia) {
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
                </div>` : ''}
        </div>`;
}
