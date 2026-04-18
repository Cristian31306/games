import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const DEFAULT_CATEGORIES = [
    { id: 'nombre', label: 'Nombre', icon: '👤' },
    { id: 'apellido', label: 'Apellido', icon: '👥' },
    { id: 'ciudad', label: 'Ciudad / País', icon: '📍' },
    { id: 'cosa', label: 'Cosa', icon: '📦' },
    { id: 'color', label: 'Color', icon: '🎨' },
    { id: 'fruta', label: 'Fruta / Verdura', icon: '🍎' },
    { id: 'animal', label: 'Animal', icon: '🦁' }
];

let gameState = {
    status: 'esperando', // 'esperando', 'jugando', 'calificando', 'resultados'
    letter: '',
    players: {}, // id: { name: '', answers: {}, points: 0, readyToNext: false, readyToSkip: false, readyToResults: false, roundPoints: 0, roundDetails: {} }
    rounds: [], // { letter: '', roundPoints: {}, roundDetails: {}, players: {} }
    timer: 0,
    hostId: null,
    settings: {
        timerDuration: 30,
        categories: [...DEFAULT_CATEGORIES]
    }
};

let countdownInterval = null;

const CATEGORIES = ['Nombre', 'Apellido', 'Ciudad', 'Cosa', 'Color', 'Fruta', 'Animal'];

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    // Unirse al juego
    socket.on('join', (name) => {
        gameState.players[socket.id] = {
            id: socket.id,
            name: name || `Jugador ${Object.keys(gameState.players).length + 1}`,
            answers: {},
            points: 0,
            readyToNext: false,
            readyToSkip: false,
            readyToResults: false,
            roundPoints: 0,
            roundDetails: {}
        };
        if (Object.keys(gameState.players).length === 1) {
            gameState.hostId = socket.id;
        }
        io.emit('stateUpdate', gameState);
    });

    // Actualizar configuración (sólo Host)
    socket.on('updateSettings', (settings) => {
        if (socket.id === gameState.hostId && gameState.status === 'esperando') {
            gameState.settings = settings;
            io.emit('stateUpdate', gameState);
        }
    });

    // Iniciar ronda
    socket.on('startRound', () => {
        if (gameState.status === 'esperando' || gameState.status === 'resultados') {
            const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const usedLetters = gameState.rounds.map(r => r.letter);
            const availableLetters = alphabet.split('').filter(l => !usedLetters.includes(l));
            
            gameState.letter = availableLetters[Math.floor(Math.random() * availableLetters.length)];
            gameState.status = 'jugando';
            
            // Reset player states for the round
            Object.keys(gameState.players).forEach(id => {
                gameState.players[id].answers = {};
                gameState.players[id].readyToNext = false;
                gameState.players[id].readyToSkip = false;
                gameState.players[id].readyToResults = false;
                gameState.players[id].roundPoints = 0;
                gameState.players[id].roundDetails = {};
            });

            if (countdownInterval) clearInterval(countdownInterval);
            gameState.timer = gameState.settings.timerDuration;
            
            io.emit('stateUpdate', gameState);

            countdownInterval = setInterval(() => {
                if (gameState.status !== 'jugando') {
                    clearInterval(countdownInterval);
                    return;
                }
                gameState.timer -= 1;
                io.emit('timerTick', gameState.timer);
                
                if (gameState.timer <= 0) {
                    clearInterval(countdownInterval);
                    // Force STOP
                    gameState.status = 'calificando';
                    io.emit('stopTriggered', { stopperId: 'system', stopperName: 'El Tiempo' });
                    io.emit('stateUpdate', gameState);
                }
            }, 1000);
        }
    });

    // Enviar STOP
    socket.on('stop', (answers) => {
        if (gameState.status === 'jugando') {
            if(countdownInterval) clearInterval(countdownInterval);
            gameState.players[socket.id].answers = answers;
            gameState.status = 'calificando';
            io.emit('stopTriggered', { stopperId: socket.id, stopperName: gameState.players[socket.id].name });
            io.emit('stateUpdate', gameState);
        }
    });

    // Reportar respuestas (cuando el otro jugador es detenido por el STOP)
    socket.on('submitAnswers', (answers) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].answers = answers;
            io.emit('stateUpdate', gameState);
        }
    });

    // Validar y finalizar ronda
    socket.on('finishCalibration', (data) => {
        // data: { points: number, details: {} }
        if (gameState.status === 'calificando' && gameState.players[socket.id]) {
            console.log(`Puntos de ${gameState.players[socket.id].name}:`, data);
            
            gameState.players[socket.id].readyToResults = true;
            gameState.players[socket.id].roundPoints = data.points;
            gameState.players[socket.id].roundDetails = data.details;

            const allReady = Object.values(gameState.players).every(p => p.readyToResults);
            
            io.emit('stateUpdate', gameState); // Mostrar que alguien ya estA listo

            if (allReady && Object.keys(gameState.players).length > 0) {
                const roundPoints = {};
                const roundDetails = {};

                Object.values(gameState.players).forEach(p => {
                    p.points += p.roundPoints || 0;
                    roundPoints[p.id] = p.roundPoints || 0;
                    roundDetails[p.id] = p.roundDetails || {};
                    // Reset estado temporal
                    p.readyToResults = false;
                    p.roundPoints = 0;
                    p.roundDetails = {};
                });

                // Guardar ronda con detalles
                gameState.rounds.push({
                    letter: gameState.letter,
                    roundPoints: roundPoints,
                    roundDetails: roundDetails,
                    players: JSON.parse(JSON.stringify(gameState.players))
                });

                console.log(`Ronda ${gameState.letter} todos listos. Almacenando.`);

                gameState.status = 'resultados';
                io.emit('stateUpdate', gameState);
            }
        }
    });

    // Saltar letra (si ambos están de acuerdo)
    socket.on('skipLetter', () => {
        if (gameState.status === 'jugando' && gameState.players[socket.id]) {
            gameState.players[socket.id].readyToSkip = true;
            
            const allReady = Object.values(gameState.players).every(p => p.readyToSkip);
            if (allReady && Object.keys(gameState.players).length >= 2) {
                gameState.status = 'esperando';
                io.emit('stateUpdate', gameState);
            } else {
                io.emit('stateUpdate', gameState);
            }
        }
    });

    // Reiniciar juego completo
    socket.on('resetGame', () => {
        gameState = {
            status: 'esperando',
            letter: '',
            players: gameState.players, // Mantener jugadores
            rounds: [],
            timer: null
        };
        // Reset player points
        Object.keys(gameState.players).forEach(id => {
            gameState.players[id].points = 0;
            gameState.players[id].answers = {};
            gameState.players[id].readyToResults = false;
        });
        io.emit('stateUpdate', gameState);
    });

    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
        delete gameState.players[socket.id];
        
        const remainingIds = Object.keys(gameState.players);
        if (remainingIds.length === 0) {
            // Reset if no players
            gameState.status = 'esperando';
            gameState.rounds = [];
            gameState.hostId = null;
            if(countdownInterval) clearInterval(countdownInterval);
        } else if (socket.id === gameState.hostId) {
            // Reasign host
            gameState.hostId = remainingIds[0];
        }
        io.emit('stateUpdate', gameState);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Servidor de Stop corriendo en el puerto ${PORT}`);
});
