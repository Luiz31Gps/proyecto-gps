// Variables globales
let authToken = null;
let vehicles = [];
const socket = io('http://localhost:3000', {
    path: '/socket.io', // Ruta debe coincidir con la configurada en el servidor
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
        // Si ya existe un marcador para este ID, actualízalo
        markers[id].setLatLng([lat, lon]);
    } else {
        // Si no existe, crea un nuevo marcador con un ícono personalizado (camión)
        const truckIcon = L.icon({
            iconUrl: 'truck-icon.png', // Ruta del ícono
            iconSize: [40, 40], // Tamaño del ícono
        });

        markers[id] = L.marker([lat, lon], { icon: truckIcon })
            .addTo(map)
            .bindPopup(`<b>${name || 'Vehículo sin nombre'}</b><br>ID: ${id}`);
    }

    // Centrar el mapa en la nueva ubicación
    map.setView([lat, lon], 13);
});

// Mostrar notificaciones
function showNotification(message, type = 'info') {
    const container = document.getElementById('notifications-container');
    const notification = document.createElement('div');
    notification.classList.add('notification', type);
    notification.innerHTML = `${message} <button class="close-btn" onclick="this.parentElement.remove()">×</button>`;
    container.appendChild(notification);
}

// Mostrar u ocultar la interfaz según el estado de autenticación
function toggleAuthUI(isAuthenticated) {
    document.getElementById('auth-container').style.display = isAuthenticated ? 'none' : 'block';
    document.getElementById('form-container').style.display = isAuthenticated ? 'block' : 'none';
    document.getElementById('map').style.display = isAuthenticated ? 'block' : 'none';
    document.getElementById('vehicle-list-container').style.display = isAuthenticated ? 'block' : 'none';
}

// Registro de usuario
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;

    try {
        const response = await fetch('http://localhost:3000/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (response.ok) {
            showNotification('Usuario registrado correctamente.', 'success');
        } else {
            const error = await response.json();
            showNotification(error.message, 'error');
        }
    } catch {
        showNotification('Error de conexión con el servidor.', 'error');
    }
});

// Inicio de sesión
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('http://localhost:3000/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (response.ok) {
            const data = await response.json();
            authToken = data.token;
            toggleAuthUI(true);
            showNotification('Sesión iniciada correctamente.', 'success');
            loadVehiclesFromBackend(); // Cargar vehículos del usuario
        } else {
            const error = await response.json();
            showNotification(error.message, 'error');
        }
    } catch {
        showNotification('Error de conexión con el servidor.', 'error');
    }
});

// Cargar vehículos desde el backend
async function loadVehiclesFromBackend() {
    try {
        const response = await fetch('http://localhost:3000/vehicles', {
            headers: { Authorization: `Bearer ${authToken}` },
        });

        if (response.ok) {
            const data = await response.json();
            vehicles = [];
            Object.values(markers).forEach(marker => marker.remove());
            Object.keys(markers).forEach(key => delete markers[key]); // Limpiar marcadores
            data.forEach(vehicle => {
                vehicles.push(vehicle);
            });
            showNotification('Vehículos cargados correctamente.', 'success');
        } else {
            showNotification('Error al cargar los vehículos.', 'error');
        }
    } catch {
        showNotification('No se pudo conectar con el servidor.', 'error');
    }
}

// Agregar un vehículo al backend
document.getElementById('vehicle-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('device-id').value; // ID del GPS
    const name = document.getElementById('vehicle-name').value; // Nombre del vehículo

    try {
        const response = await fetch('http://localhost:3000/vehicles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ id, name }),
        });

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
        showNotification('No se pudo conectar con el servidor.', 'error');
    }
});

// Actualizar la interfaz al cargar la página
window.addEventListener('load', () => {
    toggleAuthUI(false);
});
