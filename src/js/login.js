/* Login de usuarios */

document.addEventListener('DOMContentLoaded', () => {
    renderNavbar('login');
    if (Auth.isLoggedIn()) {
        window.location.href = 'cars.html';
        return;
    }
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
});

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showAlert('message', 'Completá email y contraseña.', 'error');
        return;
    }

    clearAlert('message');
    setButtonLoading(btn, true, 'Ingresando...');

    try {
        const data = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });

        const token = data.access_token;
        const user  = data.user || {};
        const rol   = user.rol || 'comprador';

        if (!token) throw new Error('Respuesta del servidor inválida');

        Auth.setSession(token, rol, user);
        showAlert('message', 'Sesión iniciada. Redirigiendo...', 'success');
        setTimeout(() => window.location.href = 'cars.html', 700);
    } catch (err) {
        showAlert('message', 'No se pudo iniciar sesión: ' + err.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}
