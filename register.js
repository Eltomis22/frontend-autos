/* Registro de usuarios */

document.addEventListener('DOMContentLoaded', () => {
    renderNavbar('register');
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
});

async function handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');

    const payload = {
        nombre: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
        rol: document.getElementById('role').value,
    };

    if (!payload.nombre || !payload.email || !payload.password) {
        showAlert('message', 'Por favor completá todos los campos.', 'error');
        return;
    }
    if (payload.password.length < 6) {
        showAlert('message', 'La contraseña debe tener al menos 6 caracteres.', 'error');
        return;
    }

    clearAlert('message');
    setButtonLoading(btn, true, 'Creando cuenta...');

    try {
        const data = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        // El backend devuelve token + user en el mismo endpoint de registro
        if (data.access_token && data.user) {
            Auth.setSession(data.access_token, data.user.rol, data.user);
            showAlert('message', '¡Cuenta creada! Redirigiendo...', 'success');
            setTimeout(() => window.location.href = 'cars.html', 900);
        } else {
            showAlert('message', 'Cuenta creada. Redirigiendo al login...', 'success');
            setTimeout(() => window.location.href = 'login.html', 1200);
        }
    } catch (err) {
        console.error('Error en registro:', err);
        showAlert('message', 'No se pudo registrar: ' + err.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}
