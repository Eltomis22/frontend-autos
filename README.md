# CATO Group — Frontend

Sitio web público de **CATO Group — Agencia Multimarca**: plataforma de compra y venta de vehículos usados y 0 km.

> Trabajo Práctico de Ingeniería Web II — UNDEF, 2026.

---

## ¿Qué hace?

Consume la API del backend y ofrece:

- Catálogo con filtros (marca, modelo, año, precio, km, ubicación).
- Ficha del vehículo con fotos, datos, vendedor, **valoración automática** y formulario de consulta.
- Comparador de varios autos lado a lado.
- Registro/login con dos roles:
  - **Comprador**: contactar vendedor, historial de consultas.
  - **Vendedor**: publicar, editar, eliminar autos y responder consultas recibidas.
- Gestión del perfil (nombre, contraseña).

---

## Stack

- HTML5 + CSS3 + JavaScript **vanilla** (ES2020+)
- Sin framework, sin build step, sin bundler
- Fetch API + `localStorage` para el JWT
- Tipografía Inter (Google Fonts)
- Deploy estático en **Render**

---

## Estructura

```
frontend-autos/
├── index.html              Landing (única página en la raíz)
├── README.md
├── .gitignore
└── src/
    ├── assets/             logo.svg
    ├── css/
    │   ├── styles.css              Punto de entrada (@imports)
    │   ├── base/                   reset, variables, typography, utilities, responsive
    │   ├── layout/                 navbar, container, section, auth-layout, footer
    │   ├── components/             buttons, cards, forms, alerts, states, modal, password-toggle, thread
    │   └── pages/                  home, cars, car-detail, compare, consultas, mis-publicaciones, mi-cuenta
    ├── js/
    │   ├── app.js                  Helpers compartidos (apiCall, Auth, route, renderNavbar)
    │   ├── consultas-thread.js     Render del hilo (reutilizado en consultas y mis-consultas)
    │   └── <página>.js             Lógica específica de cada HTML
    └── views/                      Resto de los HTML (cars, login, publish, etc.)
```

`index.html` vive en la raíz porque es la URL de entrada del sitio; el resto de las vistas está en `src/views/`.

### Cómo se referencian los recursos

**Desde `index.html`** (raíz), paths con prefijo `src/`:

```html
<link rel="stylesheet" href="src/css/styles.css">
<script src="src/js/app.js"></script>
<a href="src/views/cars.html">Catálogo</a>
```

**Desde `src/views/*.html`**, subir un nivel y bajar:

```html
<link rel="stylesheet" href="../css/styles.css">
<script src="../js/app.js"></script>
<a href="../../index.html">Inicio</a>    <!-- volver a la raíz -->
<a href="cars.html">Catálogo</a>          <!-- hermano -->
```

### Helper `route(name)`

Como `app.js` corre desde dos ubicaciones distintas (`index.html` en la raíz y HTMLs en `src/views/`), expone un helper que genera la ruta correcta según dónde esté la página actual. Lo usan `renderNavbar()` y el redirect de logout:

```javascript
route('index')   // 'index.html' desde raíz, '../../index.html' desde views/
route('cars')    // 'src/views/cars.html' desde raíz, 'cars.html' desde views/
```

---

## Conexión con el backend

Todo pasa por `apiCall()` en `app.js`, que:

1. Detecta el backend automáticamente: `localhost` usa `http://localhost:3000`; en producción usa la constante `PROD_API_BASE` (arriba en `app.js`). Se puede forzar con `window.__API_BASE__`.
2. Agrega el header `Authorization: Bearer <token>` si hay sesión.
3. Maneja `FormData` dejando que el navegador arme el `Content-Type`.
4. Lanza `Error` con el mensaje del backend cuando la respuesta no es OK.

El token JWT se guarda en `localStorage` con el objeto `Auth` (`Auth.isLoggedIn()`, `Auth.getRol()`, `Auth.clear()`, etc.).

---

## Valoración automática del vehículo

La ficha del auto (`car-detail.html`) incluye un panel con: **estado general**, **observaciones**, **rango de precio de mercado** y **confianza**. Lo genera el backend (ver README del backend para el detalle).

Desde el frontend, en `car-detail.js`:

```javascript
const car = await apiCall(`/vehiculos/${id}`);

let iaAnalysis = null;
try {
  iaAnalysis = await apiCall(`/ia/analizar/${id}`);
} catch {
  // La valoración es opcional: si falla, la ficha se muestra igual.
}

displayCarDetail(car, iaAnalysis);
```

`renderIaPanel(iaAnalysis)` arma el bloque. Si no hay análisis, aparece un placeholder en vez de romper la página.

---

## Navbar por rol

`renderNavbar()` en `app.js` detecta sesión y rol, y cambia los links:

- **No logueado**: Inicio · Buscar autos · Iniciar sesión · Registrarme
- **Comprador**: Inicio · Buscar autos · Mis consultas · Mi cuenta · Cerrar sesión
- **Vendedor**: Inicio · Buscar autos · Publicar auto · Mis publicaciones · Consultas recibidas · Mi cuenta · Cerrar sesión

Las páginas protegidas redirigen a `login.html` si `Auth.isLoggedIn()` es `false`.

---

## Correr localmente

Es estático, basta con un servidor cualquiera:

```bash
cd frontend-autos
python -m http.server 5500
# o
npx serve .
```

Queda en `http://localhost:5500`. `app.js` detecta el hostname y apunta al backend local, así que antes de abrirlo asegurate de que el backend esté corriendo en `http://localhost:3000`.

---

## Deploy

Desplegado en **Render** como Static Site.

| Parámetro | Valor |
|---|---|
| Root directory | `frontend-autos` |
| Publish directory | `frontend-autos` |
| Build command | (vacío) |

Funciona igual en **Vercel**, **Netlify** o **GitHub Pages** sin cambios. Si cambia el dominio del frontend, actualizar `CORS_ORIGIN` en el backend. Si cambia el backend, actualizar `PROD_API_BASE` en `src/js/app.js`.

---

## Diseño

Tema claro con acentos navy. La paleta vive en `src/css/base/variables.css` — cambiar los custom properties ahí actualiza todo el sitio.

Tipografía Inter (400–800). Layout responsive con CSS Grid y Flexbox puros, sin framework.
