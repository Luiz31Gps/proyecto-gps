// Importar librerías
const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');

// Configuración de la aplicación
const app = express();
const port = process.env.PORT || 3000; // Puerto dinámico para Render
const SECRET_KEY = "supersecretkey"; // Clave secreta para JWT
const corsOptions = {
    origin: ['https://gps-frontend-liqg.onrender.com'], // Permitir solicitudes desde el frontend
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Logs de solicitudes
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Crear servidor HTTP y configurar Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
    path: '/socket.io',
    cors: {
        origin: 'https://gps-frontend-liqg.onrender.com',
        methods: ['GET', 'POST'],
    },
});

// Variables para usuarios y vehículos
let users = [];
let vehicles = [];

// Middleware para autenticar tokens
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ message: 'Token requerido' });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Token inválido o expirado' });
        req.user = decoded;
        next();
    });
};

// Rutas de autenticación
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Faltan datos" });

    if (users.find(user => user.username === username)) {
        return res.status(400).json({ message: "El usuario ya existe" });
    }

    users.push({ username, password });
    res.status(201).json({ message: "Usuario registrado correctamente" });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return res.status(401).json({ message: "Credenciales inválidas" });

    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token });
});

// Rutas para vehículos
app.get('/vehicles', authenticateToken, (req, res) => {
    const userVehicles = vehicles.filter(v => v.owner === req.user.username);
    res.json(userVehicles);
});

app.post('/vehicles', authenticateToken, (req, res) => {
    const { name, id } = req.body;
    if (!name || !id) return res.status(400).json({ message: "Faltan datos del vehículo" });

    vehicles.push({ id, name, owner: req.user.username });
    res.status(201).json({ message: "Vehículo agregado correctamente" });
});

// GPS datos
app.post('/gps', (req, res) => {
    const { id, lat, lon } = req.query;
    if (!id || !lat || !lon) return res.status(400).json({ message: "Datos incompletos" });

    io.emit('gps-update', { id, lat: parseFloat(lat), lon: parseFloat(lon) });
    res.status(200).json({ message: "Datos GPS enviados correctamente" });
});

// Estado del servidor
app.get('/', (req, res) => res.status(200).send('Servidor funcionando'));

// Manejo de eventos Socket.IO
io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);
    socket.on('disconnect', () => console.log('Cliente desconectado:', socket.id));
});

// Manejo global de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Error interno del servidor' });
});

// Iniciar servidor
server.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
