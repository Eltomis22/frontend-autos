/* =========================================================
   layout.js — Inyección de header y footer reutilizables.

   Esta utilidad evita repetir el HTML del navbar y del footer
   en cada vista. Cada página coloca:

       <div data-include="header"></div>
       ...
       <div data-include="footer"></div>

   y luego llama a Layout.init('clave-de-pagina'). El módulo:

     1) Detecta si la página vive en la raíz (index.html) o
        adentro de src/views/, para construir las rutas
        relativas correctas (sin necesidad de un build step).
     2) Resuelve los paths a partials/header.html y partials/footer.html
        según ese contexto, y los descarga con fetch().
     3) Reemplaza los placeholders {{INDEX}}, {{ASSETS}} y
        {{LINK_*}} por rutas válidas desde la página actual.
     4) Inyecta el HTML resultante en los contenedores.
     5) Llama a renderNavbar(currentPage) y attachPasswordToggles()
        de app.js, que dependen de que el header ya exista.

   Requiere que app.js esté cargado primero (usa route() y
   renderNavbar()).
   ========================================================= */

const Layout = (() => {

    /* ---------- Detección de contexto ---------- */
    function isInViews() {
        return window.location.pathname.includes('/src/views/');
    }

    /* ---------- Resolución de rutas ---------- */
    function assetsPath() {
        return isInViews() ? '../assets' : 'src/assets';
    }

    function indexPath() {
        return isInViews() ? '../../index.html' : 'index.html';
    }

    function partialPath(name) {
        // partials/ vive dentro de src/views/, así que desde una
        // vista accedemos por nombre relativo, y desde index.html
        // por la ruta completa.
        return isInViews() ? `partials/${name}.html` : `src/views/partials/${name}.html`;
    }

    /* ---------- Reemplazo de placeholders ----------
       Mantiene un único punto de control para los enlaces
       comunes que usan los partials.
    -------------------------------------------------- */
    function applyPlaceholders(html) {
        const map = {
            ASSETS: assetsPath(),
            INDEX: indexPath(),
            LINK_CARS: route('cars'),
            LINK_PUBLISH: route('publish'),
            LINK_LOGIN: route('login'),
            LINK_REGISTER: route('register'),
        };
        const placeholderRegex = /\{\{(\w+)\}\}/g;
        return html.replace(placeholderRegex, (_match, key) => {
            return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : '';
        });
    }

    /* ---------- Inyección de un partial ---------- */
    async function inject(target, name) {
        if (!target) return;
        try {
            const res = await fetch(partialPath(name), { cache: 'no-cache' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const raw = await res.text();
            target.innerHTML = applyPlaceholders(raw);
        } catch (err) {
            console.error(`[layout] No se pudo cargar el partial "${name}":`, err);
            // No rompemos la página: el contenedor queda vacío pero el resto sigue funcionando.
        }
    }

    /* ---------- API pública ----------
       init(currentPage):
         - currentPage es la clave que renderNavbar() usa para marcar
           el link activo (ej. 'home', 'cars', 'login'…).
         - Busca todos los <element data-include="header|footer"> y los
           reemplaza con el partial correspondiente.
         - Una vez inyectado el header, ejecuta renderNavbar() y
           attachPasswordToggles() (estas funciones viven en app.js).
    --------------------------------------------------- */
    async function init(currentPage = '') {
        const targets = document.querySelectorAll('[data-include]');
        const tasks = [];
        targets.forEach(el => {
            const name = el.getAttribute('data-include');
            if (name === 'header' || name === 'footer') {
                tasks.push(inject(el, name));
            }
        });
        await Promise.all(tasks);

        if (typeof renderNavbar === 'function') {
            renderNavbar(currentPage);
        }
        if (typeof attachPasswordToggles === 'function') {
            attachPasswordToggles();
        }
    }

    return { init, isInViews, assetsPath, indexPath };
})();
