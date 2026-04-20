/* Comparador dinámico de vehículos */

document.addEventListener('DOMContentLoaded', () => {
    renderNavbar('cars');

    const cars = JSON.parse(localStorage.getItem('compareCars') || '[]');
    if (cars.length < 2) {
        document.querySelector('main .container').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚖️</div>
                <h3>No hay vehículos para comparar</h3>
                <p>Volvé al catálogo, seleccioná al menos 2 autos y hacé clic en <em>Comparar</em>.</p>
                <a href="cars.html" class="btn btn-primary mt-2">Ir al catálogo</a>
            </div>`;
        return;
    }

    renderComparison(cars);
});

function renderComparison(cars) {
    const headerRow = document.getElementById('compareHeader');
    const body = document.getElementById('compareBody');

    headerRow.innerHTML = '<th class="feature-label">Característica</th>' +
        cars.map(c => `<th>${escapeHtml(c.marca)} ${escapeHtml(c.modelo)}</th>`).join('');

    const fields = [
        { label: 'Año',         key: 'anio' },
        { label: 'Kilometraje', key: 'kilometraje',     format: v => v != null ? formatKm(v) : '—' },
        { label: 'Precio',      key: 'precio',          format: v => formatPrice(v) },
        { label: 'Combustible', key: 'tipoCombustible' },
        { label: 'Transmisión', key: 'transmision' },
        { label: 'Ubicación',   key: 'ubicacion' },
    ];

    body.innerHTML = fields.map(f => `
        <tr>
            <td class="feature-label">${f.label}</td>
            ${cars.map(c => {
                const v = c[f.key];
                const val = f.format ? f.format(v) : (v != null && v !== '' ? escapeHtml(String(v)) : '—');
                return `<td>${val}</td>`;
            }).join('')}
        </tr>`).join('');
}
