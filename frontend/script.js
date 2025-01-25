// Variables globales
let authToken = null;
let vehicles = [];
const markers = {};

// Configuración del socket
const socket = io('https://gps-backend-gqsl.onrender.com', {
    path: '/socket.io',
    transports: ['websocket', 'polling'], // Asegura compatibilidad con Render
});

// Inicialización de mapa
const map = L.map('map', { zoomControl: true }).setView([19.432608, -99.133209], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// Escuchar eventos de GPS desde el servidor
socket.on('gps-update', ({ lat, lon, id, name }) => {
    console.log(`Actualización recibida: ID=${id}, lat=${lat}, lon=${lon}`);
    if (markers[id]) {
        markers[id].setLatLng([lat, lon]);
    } else {
        const truckIcon = L.icon({
            iconUrl: 'truck-icon.png',
            iconSize: [40, 40],
        });

        markers[id] = L.marker([lat, lon], { icon: truckIcon })
            .addTo(map)
            .bindPopup(`<b>${name || 'Vehículo sin nombre'}</b><br>ID: ${id}`);
    }
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

// Cambiar entre vistas
function changeView(view) {
    const views = ['map-view', 'units-view', 'add-unit-view'];
    views.forEach((v) => {
        document.getElementById(v).style.display = v === view ? 'block' : 'none';
    });
}

// Actualizar lista de vehículos
function updateVehicleList() {
    const listContainer = document.getElementById('vehicle-list');
    listContainer.innerHTML = ''; // Limpiar lista
    vehicles.forEach((vehicle) => {
        const listItem = document.createElement('li');
        listItem.textContent = `${vehicle.name} (ID: ${vehicle.id})`;
        listContainer.appendChild(listItem);
    });
}

// Cargar vehículos desde el backend
async function loadVehiclesFromBackend() {
    try {
        const response = await fetch('https://gps-backend-gqsl.onrender.com/vehicles', {
            headers: { Authorization: `Bearer ${authToken}` },
        });
        if (response.ok) {
            vehicles = await response.json();
            updateVehicleList();
            showNotification('Vehículos cargados correctamente.', 'success');
        } else {
            showNotification('Error al cargar los vehículos.', 'error');
        }
    } catch {
        showNotification('No se pudo conectar con el servidor.', 'error');
    }
}

// Agregar un vehículo
document.getElementById('add-unit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('unit-id').value.trim();
    const name = document.getElementById('unit-name').value.trim();
    if (!id || !name) {
        showNotification('Todos los campos son obligatorios.', 'error');
        return;
    }
    try {
        const response = await fetch('https://gps-backend-gqsl.onrender.com/vehicles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ id, name }),
        });
        if (response.ok) {
            const newVehicle = await response.json();
            vehicles.push(newVehicle);
            updateVehicleList();
            showNotification(`Vehículo "${newVehicle.name}" agregado correctamente.`, 'success');
        } else {
            showNotification('Error al agregar el vehículo.', 'error');
        }
    } catch {
        showNotification('No se pudo conectar con el servidor.', 'error');
    }
});

// Inicializar vista al cargar
window.addEventListener('load', () => {
    changeView('map-view'); // Iniciar en la vista del mapa
});
