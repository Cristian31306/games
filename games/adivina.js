const ADIVINA_WORDS = {
    "Música": [
        "Shakira", "Karol G", "J Balvin", "Maluma", "Diomedes Díaz", 
        "Bad Bunny", "Feid", "Carlos Vives", "Juanes", "Daddy Yankee", 
        "Luis Miguel", "Camilo", "Silvestre Dangond", "Ryan Castro", "Greeicy"
    ],
    "TV y Cine": [
        "El Chavo del 8", "Betty la Fea", "Spider-Man", "Batman", "Pedro el Escamoso", 
        "Iron Man", "Jack Sparrow", "La Roca", "Amparo Grisales", "Suso el Paspi", 
        "Joker", "Barbie", "Don Jediondo", "Piraña", "La Peliteñida"
    ],
    "Deportes": [
        "James Rodríguez", "Luis Díaz", "Falcao García", "Lionel Messi", "Cristiano Ronaldo", 
        "Egan Bernal", "Mariana Pajón", "Neymar", "Rigoberto Urán", "René Higuita", 
        "Juanfer Quintero", "Pibe Valderrama", "Linda Caicedo", "Ronaldinho", "Usain Bolt"
    ],
    "Tendencias": [
        "Elon Musk", "La Liendra", "Yeferson Cossio", "Westcol", "Bill Gates", 
        "Mark Zuckerberg", "Papa Francisco", "Donald Trump", "Epa Colombia", "Aida Victoria Merlano",
        "MrBeast", "Ibai Llanos", "Luisito Comunica", "Juanda", "Pautips"
    ]
};

const adivinaRooms = new Map();

function getOrCreateAdivinaRoom(roomId) {
    if (!adivinaRooms.has(roomId)) {
        adivinaRooms.set(roomId, {
            status: 'esperando',
            players: {},
            hostId: null,
            currentWord: '',
            currentCategory: 'Música',
            guesserId: null,
            timer: 0,
            settings: {
                timerDuration: 60,
                category: 'Música'
            },
            countdownInterval: null,
            score: 0,
            lastTurnResult: null
        });
    }
    return adivinaRooms.get(roomId);
}

function sanitizeRoom(room) {
    const cleanRoom = { ...room };
    delete cleanRoom.countdownInterval;
    return cleanRoom;
}

export default function registerAdivinaHandlers(io, socket) {
    const adivinaNamespace = io.of('/adivina');

    socket.on('join', ({ name, roomId, isCreator }) => {
        if (!roomId) return;
        const room = getOrCreateAdivinaRoom(roomId);
        socket.join(roomId);
        socket.roomId = roomId;

        room.players[socket.id] = {
            id: socket.id,
            name: name || `Jugador ${Object.keys(room.players).length + 1}`,
            points: 0
        };

        if (isCreator || !room.hostId) room.hostId = socket.id;
        adivinaNamespace.to(roomId).emit('stateUpdate', sanitizeRoom(room));
    });

    socket.on('updateSettings', (settings) => {
        const room = adivinaRooms.get(socket.roomId);
        if (room && room.hostId === socket.id) {
            room.settings = settings;
            adivinaNamespace.to(socket.roomId).emit('stateUpdate', sanitizeRoom(room));
        }
    });

    socket.on('startGame', () => {
        const room = adivinaRooms.get(socket.roomId);
        if (room && room.players[socket.id]) {
            const playerIds = Object.keys(room.players);
            if (playerIds.length < 2) return;

            playerIds.forEach(id => room.players[id].points = 0);

            room.status = 'jugando';
            room.guesserId = playerIds[0];
            
            const words = ADIVINA_WORDS[room.settings.category] || ADIVINA_WORDS["Famosos"];
            room.currentWord = words[Math.floor(Math.random() * words.length)];
            room.timer = room.settings.timerDuration;

            if (room.countdownInterval) clearInterval(room.countdownInterval);
            room.countdownInterval = setInterval(() => {
                if (room.status !== 'jugando') {
                    clearInterval(room.countdownInterval);
                    return;
                }
                room.timer -= 1;
                adivinaNamespace.to(socket.roomId).emit('timerTick', room.timer);
                
                if (room.timer <= 0) {
                    room.status = 'resultadoTurno';
                    room.lastTurnResult = {
                        playerName: room.players[room.guesserId].name,
                        word: room.currentWord,
                        guessed: false
                    };
                    clearInterval(room.countdownInterval);
                    adivinaNamespace.to(socket.roomId).emit('stateUpdate', sanitizeRoom(room));
                }
            }, 1000);

            adivinaNamespace.to(socket.roomId).emit('stateUpdate', sanitizeRoom(room));
        }
    });

    socket.on('nextWord', (guessed) => {
        const room = adivinaRooms.get(socket.roomId);
        if (room && room.status === 'jugando') {
            const currentGuesser = room.players[room.guesserId];
            
            if (guessed && currentGuesser) {
                currentGuesser.points += 1;
            }

            room.lastTurnResult = {
                playerName: currentGuesser ? currentGuesser.name : 'Alguien',
                word: room.currentWord,
                guessed: guessed
            };

            room.status = 'resultadoTurno';
            if (room.countdownInterval) clearInterval(room.countdownInterval);

            adivinaNamespace.to(socket.roomId).emit('stateUpdate', sanitizeRoom(room));
        }
    });

    socket.on('confirmNextTurn', () => {
        const room = adivinaRooms.get(socket.roomId);
        if (room && room.status === 'resultadoTurno') {
            const playerIds = Object.keys(room.players);
            if (playerIds.length < 2) return;

            const currentIndex = playerIds.indexOf(room.guesserId);
            const nextIndex = (currentIndex + 1) % playerIds.length;
            room.guesserId = playerIds[nextIndex];

            const words = ADIVINA_WORDS[room.settings.category] || ADIVINA_WORDS["Famosos"];
            room.currentWord = words[Math.floor(Math.random() * words.length)];
            room.timer = room.settings.timerDuration;
            room.status = 'jugando';

            if (room.countdownInterval) clearInterval(room.countdownInterval);
            room.countdownInterval = setInterval(() => {
                if (room.status !== 'jugando') {
                    clearInterval(room.countdownInterval);
                    return;
                }
                room.timer -= 1;
                adivinaNamespace.to(socket.roomId).emit('timerTick', room.timer);
                if (room.timer <= 0) {
                    room.status = 'resultadoTurno';
                    room.lastTurnResult = {
                        playerName: room.players[room.guesserId].name,
                        word: room.currentWord,
                        guessed: false
                    };
                    clearInterval(room.countdownInterval);
                    adivinaNamespace.to(socket.roomId).emit('stateUpdate', sanitizeRoom(room));
                }
            }, 1000);

            adivinaNamespace.to(socket.roomId).emit('stateUpdate', sanitizeRoom(room));
        }
    });

    socket.on('endGame', () => {
        const room = adivinaRooms.get(socket.roomId);
        if (room) {
            if (room.countdownInterval) clearInterval(room.countdownInterval);
            room.status = 'resultados';
            adivinaNamespace.to(socket.roomId).emit('stateUpdate', sanitizeRoom(room));
        }
    });

    socket.on('disconnect', () => {
        const room = adivinaRooms.get(socket.roomId);
        if (room) {
            delete room.players[socket.id];
            if (Object.keys(room.players).length === 0) {
                if (room.countdownInterval) clearInterval(room.countdownInterval);
                adivinaRooms.delete(socket.roomId);
            } else {
                if (socket.id === room.hostId) room.hostId = Object.keys(room.players)[0];
                adivinaNamespace.to(socket.roomId).emit('stateUpdate', sanitizeRoom(room));
            }
        }
    });
}
