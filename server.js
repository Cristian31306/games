import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import compression from 'compression';

// Importar controladores de juegos
import registerStopHandlers from './games/stop.js';
import registerTicTacToeHandlers from './games/tictactoe.js';
import registerAdivinaHandlers from './games/adivina.js';
import registerBombaHandlers from './games/bomba.js';
import registerPictionaryHandlers from './games/pictionary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Configuración de Seguridad y Optimización
app.use(helmet({
    contentSecurityPolicy: false, // Desactivado para permitir scripts externos si es necesario
    crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Servir archivos estáticos
app.use('/stop', express.static(path.join(__dirname, 'stop/dist')));
app.use('/tictactoe', express.static(path.join(__dirname, 'tresLinea/public')));
app.use('/adivina', express.static(path.join(__dirname, 'adivina/dist')));
app.use('/bomba', express.static(path.join(__dirname, 'bomba/dist')));
app.use('/pictionary', express.static(path.join(__dirname, 'pictionary/dist')));
app.use('/', express.static(path.join(__dirname, 'public')));

// Fallback para el lobby si se refresca en una ruta inexistente
app.get('*', (req, res, next) => {
    if (req.path.includes('.') || req.path.startsWith('/stop/assets') || req.path.startsWith('/tictactoe/assets') || req.path.startsWith('/adivina/assets') || req.path.startsWith('/bomba/assets') || req.path.startsWith('/pictionary/assets')) {
        return res.status(404).send('Not found');
    }
    
    if (req.path.startsWith('/stop') || req.path.startsWith('/tictactoe') || req.path.startsWith('/adivina') || req.path.startsWith('/bomba') || req.path.startsWith('/pictionary')) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Configurar Namespaces de Socket.io
const stopNamespace = io.of('/stop');
const tictactoeNamespace = io.of('/tictactoe');
const adivinaNamespace = io.of('/adivina');
const bombaNamespace = io.of('/bomba');
const pictionaryNamespace = io.of('/pictionary');

stopNamespace.on('connection', (socket) => {
    console.log('Stop: Usuario conectado:', socket.id);
    registerStopHandlers(io, socket);
});

tictactoeNamespace.on('connection', (socket) => {
    console.log('TicTacToe: Usuario conectado:', socket.id);
    registerTicTacToeHandlers(io, socket);
});

adivinaNamespace.on('connection', (socket) => {
    console.log('Adivina: Usuario conectado:', socket.id);
    registerAdivinaHandlers(io, socket);
});

bombaNamespace.on('connection', (socket) => {
    console.log('Bomba: Usuario conectado:', socket.id);
    registerBombaHandlers(io, socket);
});

pictionaryNamespace.on('connection', (socket) => {
    console.log('Pictionary: Usuario conectado:', socket.id);
    registerPictionaryHandlers(io, socket);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Canal Games Hub: Servidor corriendo en puerto ${PORT}`);
});
