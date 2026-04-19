/* =========================================================
   Cato Group — Lógica común del frontend
   ========================================================= */

/* ---------- Configuración del backend ----------
   El frontend es estático; para apuntar al backend correcto se usan, en orden:
     1. window.__API_BASE__     → override explícito (inyectable desde config.js
                                  o una etiqueta <script> previa).
     2. localhost / 127.0.0.1   → desarrollo local: http://localhost:3000
     3. cualquier otro host     → producción: se usa la constante PROD_API_BASE
                                  de abajo. Reemplazala por la URL pública de
                                  tu backend en Render (sin barra final), p.ej.
                                  'https://cato-group-api.onrender.com'.
   ------------------------------------------------- */
const PROD_API_BASE = 'https://cato-group.onrender.com';

const API_BASE = (() => {
    if (typeof window !== 'undefined' && window.__API_BASE__) {
        return String(window.__API_BASE__).replace(/\/$/, '');
    }
    const host = (typeof window !== 'undefined' && window.location)
        ? window.location.hostname
        : '';
    if (host === 'localhost' || host === '127.0.0.1' || host === '') {
        return 'http://localhost:3000';
    }
    return PROD_API_BASE.replace(/\/$/, '');
})();

/* ---------- Storage helpers ---------- */
const Auth = {
    getToken: () => localStorage.getItem('token'),
    getRol:   () => localStorage.getItem('rol'),
    getUser:  () => {
        try { return JSON.parse(localStorage.getItem('user') || 'null'); }
        catch { return null; }
    },
    setSession: (token, rol, user) => {
        localStorage.setItem('token', token);
        if (rol)  localStorage.setItem('rol', rol);
        if (user) localStorage.setItem('user', JSON.stringify(user));
    },
    clear: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('rol');
        localStorage.removeItem('user');
    },
    isLoggedIn: () => !!localStorage.getItem('token'),
};

/* ---------- API client ---------- */
async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const token = Auth.getToken();

    const isFormData = options.body instanceof FormData;
    const headers = {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers || {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
        let msg = `Error ${response.status}`;
        try {
            const data = await response.json();
            if (data?.message) msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        } catch { /* ignore */ }
        throw new Error(msg);
    }

    if (response.status === 204) return null;
    return response.json();
}

/* ---------- Navbar rendering ---------- */
function renderNavbar(current = '') {
    const menu = document.getElementById('navbarMenu');
    if (!menu) return;

    const rol = Auth.getRol();
    const logged = Auth.isLoggedIn();

    const link = (href, label, key, cls = '') =>
        `<li><a href="${href}" class="${current === key ? 'active' : ''} ${cls}">${label}</a></li>`;

    let html = '';
    html += link('index.html', 'Inicio', 'home');
    html += link('cars.html', 'Buscar autos', 'cars');

    if (logged && rol === 'vendedor') {
        html += link('publish.html', 'Publicar auto', 'publish');
        html += link('mis-publicaciones.html', 'Mis publicaciones', 'mis-publicaciones');
        html += link('consultas.html', 'Consultas recibidas', 'consultas');
    }

    if (logged) {
        html += link('mi-cuenta.html', 'Mi cuenta', 'mi-cuenta');
        html += `<li><a href="#" id="logoutLink">Cerrar sesión</a></li>`;
    } else {
        html += link('login.html', 'Iniciar sesión', 'login');
        html += link('register.html', 'Registrarme', 'register', 'btn-nav-primary');
    }

    menu.innerHTML = html;

    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.clear();
            window.location.href = 'index.html';
        });
    }

    const toggle = document.getElementById('navbarToggle');
    if (toggle) {
        toggle.addEventListener('click', () => menu.classList.toggle('open'));
    }
}

/* ---------- UI helpers ---------- */
function showAlert(containerId, text, type = 'info') {
    const el = document.getElementById(containerId);
    if (!el) return;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    el.innerHTML = `<div class="alert alert-${type}"><strong>${icon}</strong> ${text}</div>`;
}

function clearAlert(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = '';
}

function setButtonLoading(btn, loading, loadingText = 'Procesando...') {
    if (!btn) return;
    if (loading) {
        btn.dataset.originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = loadingText;
    } else {
        btn.disabled = false;
        if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
    }
}

function formatPrice(value) {
    if (value == null || isNaN(value)) return '—';
    return 'USD ' + Number(value).toLocaleString('es-AR');
}

function formatKm(value) {
    if (value == null || isNaN(value)) return '—';
    return Number(value).toLocaleString('es-AR') + ' km';
}

function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ---------- Toggle de visibilidad en inputs de contraseña ----------
   Convierte cualquier <input type="password" class="password-field"> en un
   campo con un botón de ojo que alterna entre type=password y type=text.
   Idempotente: si ya tiene el botón, no duplica.
------------------------------------------------------------------- */
function attachPasswordToggles(root = document) {
    const inputs = root.querySelectorAll('input[type="password"].password-field');
    inputs.forEach((input) => {
        if (input.dataset.pwToggleReady === '1') return;
        input.dataset.pwToggleReady = '1';

        const wrapper = document.createElement('div');
        wrapper.className = 'password-field-wrapper';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'password-toggle';
        btn.setAttribute('aria-label', 'Mostrar contraseña');
        btn.innerHTML = eyeIcon(false);

        btn.addEventListener('click', () => {
            const visible = input.type === 'text';
            input.type = visible ? 'password' : 'text';
            btn.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
            btn.innerHTML = eyeIcon(!visible);
            input.focus({ preventScroll: true });
        });

        wrapper.appendChild(btn);
    });
}

function eyeIcon(visible) {
    // Ícono SVG inline — no requiere librerías externas.
    return visible
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.4 19.4 0 0 1 5.06-5.94"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.6 19.6 0 0 1-3.17 4.19"/><path d="M1 1l22 22"/><path d="M14.12 14.12a3 3 0 0 1-4.24-4.24"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

/* ---------- Init navbar y password toggles automáticamente ---------- */
document.addEventListener('DOMContentLoaded', () => {
    const menu = document.getElementById('navbarMenu');
    if (menu && !menu.innerHTML.trim()) {
        renderNavbar();
    }
    attachPasswordToggles();
});
