// Variables globales
let authToken = null;
let vehicles = [];
const socket = io('https://gps-backend-gqsl.onrender.com', {
    path: '/socket.io',
    transports: ['websocket', 'polling'], // Asegura compatibilidad con Render
});

const markers = {};

// Inicializar el mapa (oculto inicialmente)
const map = L.map('map', { zoomControl: true }).setView([19.432608, -99.133209], 13); // Ciudad de México como vista inicial
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);
document.getElementById('map').style.display = 'none'; // Ocultar el mapa inicialmente

// Escuchar eventos de actualización de GPS del servidor
socket.on('gps-update', ({ lat, lon, id, name }) => {
    console.log(`Actualización recibida: ID=${id}, lat=${lat}, lon=${lon}`);

    if (markers[id]) {
        markers[id].setLatLng([lat, lon]);
    } else {
        const truckIcon = L.icon({
            iconUrl: 'truck-icon.png', // Ruta del ícono
            iconSize: [40, 40], // Tamaño del ícono
        });

        markers[id] = L.marker([lat, lon], { icon: truckIcon })
            .addTo(map)
            .bindPopup(`<b>${name || 'Vehículo sin nombre'}</b><br>ID: ${id}`);
    }

    map.setView([lat, lon], 13); // Centrar el mapa en la nueva ubicación
});

// Mostrar notificaciones
function showNotification(message, type = 'info') {
    const container = document.getElementById('notifications-container');
    const notification = document.createElement('div');
    notification.classList.add('notification', type);
    notification.innerHTML = `${message} <button class="close-btn" onclick="this.parentElement.remove()">×</button>`;
    container.appendChild(notification);
}

// Indicador de carga
function toggleLoader(show) {
    const loader = document.getElementById('loader'); // Asegúrate de tener un loader en el HTML
    loader.style.display = show ? 'block' : 'none';
}

// Mostrar u ocultar la interfaz según el estado de autenticación
function toggleAuthUI(isAuthenticated) {
    document.getElementById('auth-container').style.display = isAuthenticated ? 'none' : 'block';
    document.getElementById('form-container').style.display = isAuthenticated ? 'block' : 'none';
    document.getElementById('map').style.display = isAuthenticated ? 'block' : 'none';
    document.getElementById('vehicle-list-container').style.display = isAuthenticated ? 'block' : 'none';
}

// Registro de usuario con validación
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value.trim();

    if (!username || !password) {
        showNotification('Todos los campos son obligatorios.', 'error');
        return;
    }

    try {
        toggleLoader(true);
        const response = await fetch('https://gps-backend-gqsl.onrender.com/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        toggleLoader(false);
        if (response.ok) {
            showNotification('Usuario registrado correctamente.', 'success');
        } else {
            const error = await response.json();
            showNotification(error.message, 'error');
        }
    } catch {
        toggleLoader(false);
        showNotification('Error de conexión con el servidor.', 'error');
    }
});

// Inicio de sesión con validación
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!username || !password) {
        showNotification('Todos los campos son obligatorios.', 'error');
        return;
    }

    try {
        toggleLoader(true);
        const response = await fetch('https://gps-backend-gqsl.onrender.com/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        toggleLoader(false);
        if (response.ok) {
            const data = await response.json();
            authToken = data.token;
            toggleAuthUI(true);
            showNotification('Sesión iniciada correctamente.', 'success');
            loadVehiclesFromBackend();
        } else {
            const error = await response.json();
            showNotification(error.message, 'error');
        }
    } catch {
        toggleLoader(false);
        showNotification('Error de conexión con el servidor.', 'error');
    }
});

// Cargar vehículos desde el backend
async function loadVehiclesFromBackend() {
    try {
        toggleLoader(true);
        const response = await fetch('https://gps-backend-gqsl.onrender.com/vehicles', {
            headers: { Authorization: `Bearer ${authToken}` },
        });

        toggleLoader(false);
        if (response.ok) {
            const data = await response.json();
            vehicles = [];
            Object.values(markers).forEach(marker => marker.remove());
            Object.keys(markers).forEach(key => delete markers[key]);
            data.forEach(vehicle => {
                vehicles.push(vehicle);
            });
            showNotification('Vehículos cargados correctamente.', 'success');
        } else {
            showNotification('Error al cargar los vehículos.', 'error');
        }
    } catch {
        toggleLoader(false);
        showNotification('No se pudo conectar con el servidor.', 'error');
    }
}

// Agregar un vehículo al backend
document.getElementById('vehicle-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('device-id').value.trim();
    const name = document.getElementById('vehicle-name').value.trim();

    if (!id || !name) {
        showNotification('Todos los campos son obligatorios.', 'error');
        return;
    }

    try {
        toggleLoader(true);
        const response = await fetch('https://gps-backend-gqsl.onrender.com/vehicles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ id, name }),
        });

        toggleLoader(false);
        if (response.ok) {
            const newVehicle = await response.json();
            vehicles.push(newVehicle);
            showNotification(`Vehículo "${newVehicle.name}" con ID "${newVehicle.id}" agregado correctamente.`, 'success');
            document.getElementById('vehicle-form').reset();
        } else {
            const error = await response.json();
            showNotification(error.message, 'error');
        }
    } catch {
        toggleLoader(false);
        showNotification('No se pudo conectar con el servidor.', 'error');
    }
});

// Manejo global de errores
window.addEventListener('error', (event) => {
    showNotification(`Error inesperado: ${event.message}`, 'error');
});

// Actualizar la interfaz al cargar la página
window.addEventListener('load', () => {
    toggleAuthUI(false);
});
