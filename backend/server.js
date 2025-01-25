const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000; // Usar puerto dinámico en Render

// Configuración de CORS
const corsOptions = {
    origin: ['https://gps-frontend-liqg.onrender.com'], // Agrega el dominio de tu frontend
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Servir archivos estáticos desde "public"

app.use((req, res, next) => {
    console.log("Nueva solicitud recibida:");
    console.log("Método:", req.method);
    console.log("URL:", req.url);
    console.log("Query:", req.query);
    console.log("Body:", req.body);
    next();
});

// Crear servidor HTTP y configurar Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
    path: '/socket.io',
    cors: {
        origin: 'https://gps-frontend-liqg.onrender.com', // Permitir dominio del frontend
        methods: ["GET", "POST"],
    },
});

// Clave secreta para JWT
const SECRET_KEY = "supersecretkey";

// Bases de datos simuladas
let users = [];
let vehicles = [];

// Middleware para verificar el token
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(403).json({ message: 'Token requerido' });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Token inválido' });
        }
        req.user = decoded;
        next();
    });
};

// Rutas de autenticación
app.post('/register', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Faltan datos" });
    }

    const existingUser = users.find(user => user.username === username);
    if (existingUser) {
        return res.status(400).json({ message: "El usuario ya existe" });
    }

    users.push({ username, password });
    res.status(201).json({ message: "Usuario registrado correctamente" });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const existingUser = users.find(user => user.username === username && user.password === password);
    if (!existingUser) {
        return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token });
});

// Rutas para manejo de vehículos
app.get('/vehicles', authenticateToken, (req, res) => {
    const userVehicles = vehicles.filter(v => v.owner === req.user.username);
    res.json(userVehicles);
});

app.post('/vehicles', authenticateToken, (req, res) => {
    const { name, id } = req.body;

    if (!name || !id) {
        return res.status(400).json({ message: "Faltan datos del vehículo" });
    }

    const newVehicle = {
        id,
        name,
        owner: req.user.username,
    };

    vehicles.push(newVehicle);
    res.status(201).json(newVehicle);
});

app.delete('/vehicles/:id', authenticateToken, (req, res) => {
    const id = req.params.id;
    const vehicleIndex = vehicles.findIndex(v => v.id === id && v.owner === req.user.username);

    if (vehicleIndex === -1) {
        return res.status(404).json({ message: "Vehículo no encontrado" });
    }

    vehicles.splice(vehicleIndex, 1);
    res.json({ message: "Vehículo eliminado correctamente" });
});

// Ruta para datos GPS
app.post('/gps', (req, res) => {
    const { id, lat, lon } = req.query;

    if (!id || !lat || !lon) {
        return res.status(400).json({ message: "Datos incompletos" });
    }

    io.emit('gps-update', { id, lat: parseFloat(lat), lon: parseFloat(lon) });
    res.status(200).json({ message: "Datos recibidos correctamente" });
});

// Ruta para comprobar estado del servidor
app.get('/', (req, res) => {
    res.status(200).send('El servidor está funcionando correctamente.');
});

// Manejo de conexiones de Socket.IO
io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});

// Iniciar el servidor
server.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
