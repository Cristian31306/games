const DEFAULT_CATEGORIES = [
    { id: 'nombre', label: 'Nombre', icon: '👤' },
    { id: 'apellido', label: 'Apellido', icon: '👥' },
    { id: 'ciudad', label: 'Ciudad / País', icon: '📍' },
    { id: 'cosa', label: 'Cosa', icon: '📦' },
    { id: 'color', label: 'Color', icon: '🎨' },
    { id: 'fruta', label: 'Fruta / Verdura', icon: '🍎' },
    { id: 'animal', label: 'Animal', icon: '🦁' }
];

const stopRooms = new Map();

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
            validation: {}, 
            settings: {
                timerDuration: 0,
                categories: [...DEFAULT_CATEGORIES]
            }
        });
    }
    return stopRooms.get(roomId);
}

const normalize = (str) => {
    return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
};

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

export default function registerStopHandlers(io, socket) {
    const stopNamespace = io.of('/stop');

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

        if (isCreator || !room.hostId) {
            room.hostId = socket.id;
        }

        stopNamespace.to(roomId).emit('stateUpdate', room);
    });

    socket.on('updateSettings', (settings) => {
        const room = stopRooms.get(socket.roomId);
        if (room && room.hostId === socket.id) {
            if (!settings.categories || settings.categories.length === 0) {
                settings.categories = [...DEFAULT_CATEGORIES];
            }
            room.settings = settings;
            stopNamespace.to(socket.roomId).emit('stateUpdate', room);
        }
    });

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

            if (room.settings.timerDuration > 0) {
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

    socket.on('finishCalibration', () => {
        const roomId = socket.roomId;
        const room = stopRooms.get(roomId);
        if (room && room.status === 'calificando' && room.players[socket.id]) {
            room.players[socket.id].readyToResults = true;
            
            const allReady = Object.values(room.players).every(p => p.readyToResults);
            stopNamespace.to(roomId).emit('stateUpdate', room);

            if (allReady && Object.keys(room.players).length > 0) {
                Object.values(room.players).forEach(player => {
                    let totalRoundPoints = 0;
                    const details = {};

                    room.settings.categories.forEach(cat => {
                        const rawWord = (player.answers[cat.id] || '').trim();
                        const myWord = normalize(rawWord);
                        const isValid = room.validation[player.id]?.[cat.id];

                        let pts = 0;
                        if (isValid && rawWord.length > 1) {
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
        const roomId = socket.roomId;
        const room = stopRooms.get(roomId);
        if (room) {
            delete room.players[socket.id];
            const remainingIds = Object.keys(room.players);
            if (remainingIds.length === 0) {
                if(room.countdownInterval) clearInterval(room.countdownInterval);
                stopRooms.delete(roomId);
            } else {
                if (socket.id === room.hostId) {
                    room.hostId = remainingIds[0];
                }
                stopNamespace.to(roomId).emit('stateUpdate', room);
            }
        }
    });
}
