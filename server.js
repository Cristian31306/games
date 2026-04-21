import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
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
app.use('/', express.static(path.join(__dirname, 'public')));

// Fallback para el lobby si se refresca en una ruta inexistente
app.get('*', (req, res, next) => {
    // Si la petición tiene una extensión (ej: .css, .png), no enviar el index.html
    if (req.path.includes('.') || req.path.startsWith('/stop/assets') || req.path.startsWith('/tictactoe/assets')) {
        return res.status(404).send('Not found');
    }
    
    if (req.path.startsWith('/stop') || req.path.startsWith('/tictactoe')) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// --- LÓGICA DE STOP ---
const stopNamespace = io.of('/stop');
const stopRooms = new Map();

const DEFAULT_CATEGORIES = [
    { id: 'nombre', label: 'Nombre', icon: '👤' },
    { id: 'apellido', label: 'Apellido', icon: '👥' },
    { id: 'ciudad', label: 'Ciudad / País', icon: '📍' },
    { id: 'cosa', label: 'Cosa', icon: '📦' },
    { id: 'color', label: 'Color', icon: '🎨' },
    { id: 'fruta', label: 'Fruta / Verdura', icon: '🍎' },
    { id: 'animal', label: 'Animal', icon: '🦁' }
];

function getOrCreateStopRoom(roomId) {
    if (!stopRooms.has(roomId)) {
        stopRooms.set(roomId, {
            status: 'esperando',
            letter: '',
            players: {},
            rounds: [],
            timer: 0,
            hostId: null,
            countdownInterval: null,
            validation: {}, // [playerId][categoryId] = true/false
            settings: {
                timerDuration: 30,
                categories: [...DEFAULT_CATEGORIES]
            }
        });
    }
    return stopRooms.get(roomId);
}

stopNamespace.on('connection', (socket) => {
    console.log('Stop: Usuario conectado:', socket.id);

    socket.on('join', ({ name, roomId, isCreator }) => {
        if (!roomId) return;
        const room = getOrCreateStopRoom(roomId);
        
        socket.join(roomId);
        socket.roomId = roomId;

        room.players[socket.id] = {
            id: socket.id,
            name: name || `Jugador ${Object.keys(room.players).length + 1}`,
            answers: {},
            points: 0,
            readyToNext: false,
            readyToSkip: false,
            readyToResults: false,
            roundPoints: 0,
            roundDetails: {}
        };

        // El anfitrión es el que envía isCreator: true
        // O el primero si nadie lo ha reclamado (fallback)
        if (isCreator || !room.hostId) {
            room.hostId = socket.id;
        }

        stopNamespace.to(roomId).emit('stateUpdate', room);
    });

    socket.on('updateSettings', (settings) => {
        const room = stopRooms.get(socket.roomId);
        if (room && room.hostId === socket.id) {
            // Asegurar que no se borren las categorías por error
            if (!settings.categories || settings.categories.length === 0) {
                settings.categories = [...DEFAULT_CATEGORIES];
            }
            room.settings = settings;
            stopNamespace.to(socket.roomId).emit('stateUpdate', room);
        }
    });

    const initializeValidation = (room) => {
        room.validation = {};
        Object.keys(room.players).forEach(pId => {
            room.validation[pId] = {};
            room.settings.categories.forEach(cat => {
                const answer = (room.players[pId].answers[cat.id] || '').trim();
                room.validation[pId][cat.id] = answer.length > 1;
            });
        });
    };

    socket.on('startRound', () => {
        const roomId = socket.roomId;
        const room = stopRooms.get(roomId);
        if (room && (room.status === 'esperando' || room.status === 'resultados')) {
            const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const usedLetters = room.rounds.map(r => r.letter);
            const availableLetters = alphabet.split('').filter(l => !usedLetters.includes(l));
            
            room.letter = availableLetters[Math.floor(Math.random() * availableLetters.length)];
            room.status = 'jugando';
            room.validation = {};
            
            Object.keys(room.players).forEach(id => {
                room.players[id].answers = {};
                room.players[id].readyToNext = false;
                room.players[id].readyToSkip = false;
                room.players[id].readyToResults = false;
                room.players[id].roundPoints = 0;
                room.players[id].roundDetails = {};
            });

            if (room.countdownInterval) clearInterval(room.countdownInterval);
            room.timer = room.settings.timerDuration;
            
            stopNamespace.to(roomId).emit('stateUpdate', room);

            room.countdownInterval = setInterval(() => {
                if (room.status !== 'jugando') {
                    clearInterval(room.countdownInterval);
                    return;
                }
                room.timer -= 1;
                stopNamespace.to(roomId).emit('timerTick', room.timer);
                
                if (room.timer <= 0) {
                    clearInterval(room.countdownInterval);
                    room.status = 'calificando';
                    initializeValidation(room);
                    stopNamespace.to(roomId).emit('stopTriggered', { stopperId: 'system', stopperName: 'El Tiempo' });
                    stopNamespace.to(roomId).emit('stateUpdate', room);
                }
            }, 1000);
        }
    });

    socket.on('stop', (answers) => {
        const roomId = socket.roomId;
        const room = stopRooms.get(roomId);
        if (room && room.status === 'jugando') {
            if(room.countdownInterval) clearInterval(room.countdownInterval);
            room.players[socket.id].answers = answers;
            room.status = 'calificando';
            initializeValidation(room);
            stopNamespace.to(roomId).emit('stopTriggered', { stopperId: socket.id, stopperName: room.players[socket.id].name });
            stopNamespace.to(roomId).emit('stateUpdate', room);
        }
    });

    socket.on('toggleWord', ({ targetPlayerId, categoryId }) => {
        const room = stopRooms.get(socket.roomId);
        if (room && room.status === 'calificando' && room.validation[targetPlayerId]) {
            room.validation[targetPlayerId][categoryId] = !room.validation[targetPlayerId][categoryId];
            stopNamespace.to(socket.roomId).emit('stateUpdate', room);
        }
    });

    socket.on('submitAnswers', (answers) => {
        const roomId = socket.roomId;
        const room = stopRooms.get(roomId);
        if (room && room.players[socket.id]) {
            room.players[socket.id].answers = answers;
            
            // Si estamos en fase de calificación, inicializar su validación ahora que tiene respuestas
            if (room.status === 'calificando') {
                if (!room.validation[socket.id]) room.validation[socket.id] = {};
                room.settings.categories.forEach(cat => {
                    const answer = (answers[cat.id] || '').trim();
                    room.validation[socket.id][cat.id] = answer.length > 1;
                });
            }
            
            stopNamespace.to(roomId).emit('stateUpdate', room);
        }
    });

    const normalize = (str) => {
        return (str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
    };

    socket.on('finishCalibration', () => {
        const roomId = socket.roomId;
        const room = stopRooms.get(roomId);
        if (room && room.status === 'calificando' && room.players[socket.id]) {
            room.players[socket.id].readyToResults = true;
            
            const allReady = Object.values(room.players).every(p => p.readyToResults);
            stopNamespace.to(roomId).emit('stateUpdate', room);

            if (allReady && Object.keys(room.players).length > 0) {
                // CALCULAR PUNTOS EN EL SERVIDOR
                Object.values(room.players).forEach(player => {
                    let totalRoundPoints = 0;
                    const details = {};

                    room.settings.categories.forEach(cat => {
                        const rawWord = (player.answers[cat.id] || '').trim();
                        const myWord = normalize(rawWord);
                        const isValid = room.validation[player.id]?.[cat.id];

                        let pts = 0;
                        if (isValid && rawWord.length > 1) {
                            // Check duplicates
                            let isDuplicated = false;
                            Object.values(room.players).forEach(other => {
                                if (other.id === player.id) return;
                                const otherRaw = (other.answers[cat.id] || '').trim();
                                const otherWord = normalize(otherRaw);
                                if (otherRaw.length > 1 && myWord === otherWord) {
                                    isDuplicated = true;
                                }
                            });
                            pts = isDuplicated ? 50 : 100;
                        }
                        details[cat.id] = pts;
                        totalRoundPoints += pts;
                    });

                    player.roundPoints = totalRoundPoints;
                    player.roundDetails = details;
                    player.points += totalRoundPoints;
                    player.readyToResults = false;
                });

                const roundData = {
                    letter: room.letter,
                    players: {},
                    roundPoints: {},
                    roundDetails: {}
                };

                Object.values(room.players).forEach(p => {
                    roundData.players[p.id] = { 
                        id: p.id,
                        name: p.name,
                        answers: { ...p.answers }
                    };
                    roundData.roundPoints[p.id] = p.roundPoints;
                    roundData.roundDetails[p.id] = p.roundDetails;
                });

                room.rounds.push(roundData);

                room.status = 'resultados';
                stopNamespace.to(roomId).emit('stateUpdate', room);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Stop: Usuario desconectado:', socket.id);
        const roomId = socket.roomId;
        const room = stopRooms.get(roomId);
        if (room) {
            delete room.players[socket.id];
            
            const remainingIds = Object.keys(room.players);
            if (remainingIds.length === 0) {
                if(room.countdownInterval) clearInterval(room.countdownInterval);
                stopRooms.delete(roomId); // Limpieza completa de la sala
            } else {
                if (socket.id === room.hostId) {
                    room.hostId = remainingIds[0];
                }
                stopNamespace.to(roomId).emit('stateUpdate', room);
            }
        }
    });
});

// --- LÓGICA DE TRES EN LÍNEA ---
const tictactoeNamespace = io.of('/tictactoe');
const tictactoeRooms = new Map();

tictactoeNamespace.on('connection', (socket) => {
    console.log('TicTacToe: Usuario conectado:', socket.id);

    socket.on('joinRoom', ({ roomId, username }) => {
        let room = tictactoeRooms.get(roomId);

        if (!room) {
            room = {
                id: roomId,
                players: [],
                board: Array(9).fill(null),
                scores: { x: 0, o: 0 },
                startingPlayerIndex: 0,
                currentTurn: null,
                gameActive: false
            };
            tictactoeRooms.set(roomId, room);
        }

        if (room.players.length >= 2) {
            socket.emit('error', 'La sala está llena');
            return;
        }

        const playerSymbol = room.players.length === 0 ? 'X' : 'O';
        const player = {
            id: socket.id,
            username,
            symbol: playerSymbol,
            wins: 0
        };

        room.players.push(player);
        socket.join(roomId);
        socket.emit('roomJoined', { roomId, symbol: playerSymbol });

        if (room.players.length === 2) {
            room.gameActive = true;
            room.currentTurn = room.players[room.startingPlayerIndex].id;
            tictactoeNamespace.to(roomId).emit('gameStart', {
                players: room.players,
                currentTurn: room.currentTurn,
                board: room.board,
                scores: room.scores
            });
        } else {
            socket.emit('waiting', 'Esperando al otro jugador...');
        }
    });

    socket.on('makeMove', ({ roomId, index }) => {
        const room = tictactoeRooms.get(roomId);
        if (!room || !room.gameActive || room.currentTurn !== socket.id) return;

        const player = room.players.find(p => p.id === socket.id);
        if (room.board[index] === null) {
            room.board[index] = player.symbol;
            
            const winResult = checkWinner(room.board);
            if (winResult) {
                if (winResult === 'draw') {
                    tictactoeNamespace.to(roomId).emit('gameEnd', { board: room.board, winner: 'draw' });
                } else {
                    const winner = room.players.find(p => p.symbol === winResult);
                    room.scores[winResult.toLowerCase()]++;
                    tictactoeNamespace.to(roomId).emit('gameEnd', { board: room.board, winner, scores: room.scores });
                }
                room.gameActive = false;
            } else {
                const otherPlayer = room.players.find(p => p.id !== socket.id);
                room.currentTurn = otherPlayer.id;
                tictactoeNamespace.to(roomId).emit('moveMade', { board: room.board, nextTurn: room.currentTurn });
            }
        }
    });

    socket.on('restartGame', (roomId) => {
        const room = tictactoeRooms.get(roomId);
        if (!room) return;

        room.startingPlayerIndex = (room.startingPlayerIndex + 1) % 2;
        room.board = Array(9).fill(null);
        room.gameActive = true;
        room.currentTurn = room.players[room.startingPlayerIndex].id;

        tictactoeNamespace.to(roomId).emit('gameStart', {
            players: room.players,
            currentTurn: room.currentTurn,
            board: room.board,
            scores: room.scores
        });
    });

    socket.on('disconnect', () => {
        console.log('TicTacToe: Usuario desconectado:', socket.id);
        for (const [roomId, room] of tictactoeRooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                room.gameActive = false;
                room.board = Array(9).fill(null);
                tictactoeNamespace.to(roomId).emit('playerLeft', 'Tu oponente se ha desconectado');
                if (room.players.length === 0) {
                    tictactoeRooms.delete(roomId);
                }
                break;
            }
        }
    });
});

function checkWinner(board) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    if (!board.includes(null)) return 'draw';
    return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Canal Games Hub: Servidor corriendo en puerto ${PORT}`);
});
