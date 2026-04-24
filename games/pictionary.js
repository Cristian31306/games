const PICTIONARY_WORDS = [
    "Casa", "Carro", "Sol", "Luna", "Perro", "Gato", "Árbol", "Flor", "Computador", "Celular",
    "Pizza", "Hamburguesa", "Avión", "Barco", "Tren", "Bicicleta", "Libro", "Lápiz", "Guitarra", "Piano",
    "Montaña", "Playa", "Nube", "Lluvia", "Fuego", "Agua", "Hielo", "Zapato", "Camisa", "Sombrero",
    "Reloj", "Gafas", "Llave", "Martillo", "Tijeras", "Cuchara", "Tenedor", "Cuchillo", "Plato", "Vaso",
    "Dinosaurio", "Dragón", "Castillo", "Rey", "Reina", "Pirata", "Tesoro", "Mapa", "Brújula", "Ancla",
    "Espada", "Escudo", "Casco", "Robot", "Astronauta", "Cohete", "Planeta", "Estrella", "Alien", "Ovni"
];

const pictionaryRooms = new Map();

function getOrCreatePictionaryRoom(roomId) {
    if (!pictionaryRooms.has(roomId)) {
        pictionaryRooms.set(roomId, {
            status: 'esperando',
            players: {},
            hostId: null,
            drawerId: null,
            currentWord: '',
            round: 0,
            timer: 0,
            drawHistory: [],
            chat: [],
            settings: {
                maxRounds: 5,
                roundTime: 80
            },
            interval: null
        });
    }
    return pictionaryRooms.get(roomId);
}

function sanitizeRoom(room) {
    const cleanRoom = { ...room };
    delete cleanRoom.interval;
    // No enviamos el historial de dibujo completo en cada stateUpdate si es muy grande, 
    // pero para este MVP lo mantendremos simple.
    return cleanRoom;
}

export default function registerPictionaryHandlers(io, socket) {
    const pictionaryNamespace = io.of('/pictionary');

    socket.on('join', ({ name, roomId, isCreator }) => {
        if (!roomId) return;
        const room = getOrCreatePictionaryRoom(roomId);
        socket.join(roomId);
        socket.roomId = roomId;

        room.players[socket.id] = {
            id: socket.id,
            name: name || `Artista ${Object.keys(room.players).length + 1}`,
            points: 0,
            hasGuessed: false
        };

        if (isCreator || !room.hostId) room.hostId = socket.id;
        pictionaryNamespace.to(roomId).emit('stateUpdate', sanitizeRoom(room));
    });

    socket.on('startGame', () => {
        const room = pictionaryRooms.get(socket.roomId);
        if (room && room.hostId === socket.id) {
            startNewRound(room, socket.roomId);
        }
    });

    function startNewRound(room, roomId) {
        const playerIds = Object.keys(room.players);
        if (playerIds.length < 2) return;

        room.status = 'jugando';
        room.drawHistory = [];
        room.round += 1;
        
        // Seleccionar dibujante (rotación)
        const currentDrawerIndex = room.drawerId ? (playerIds.indexOf(room.drawerId) + 1) % playerIds.length : 0;
        room.drawerId = playerIds[currentDrawerIndex];
        
        // Seleccionar palabra
        room.currentWord = PICTIONARY_WORDS[Math.floor(Math.random() * PICTIONARY_WORDS.length)];
        
        // Resetear aciertos
        playerIds.forEach(id => room.players[id].hasGuessed = false);
        
        room.timer = room.settings.roundTime;
        room.chat.push({ system: true, message: `¡Nueva ronda! El dibujante se está preparando...` });

        if (room.interval) clearInterval(room.interval);
        room.interval = setInterval(() => {
            room.timer -= 1;
            
            if (room.timer <= 0) {
                endRound(room, roomId);
            } else {
                pictionaryNamespace.to(roomId).emit('timerUpdate', room.timer);
            }
        }, 1000);

        pictionaryNamespace.to(roomId).emit('stateUpdate', sanitizeRoom(room));
        // Avisar específicamente al dibujante cuál es su palabra
        pictionaryNamespace.to(room.drawerId).emit('yourWord', room.currentWord);
    }

    function endRound(room, roomId) {
        clearInterval(room.interval);
        room.status = 'resultado';
        room.chat.push({ system: true, message: `La palabra era: ${room.currentWord}` });
        pictionaryNamespace.to(roomId).emit('stateUpdate', sanitizeRoom(room));

        // Esperar 5 segundos antes de la siguiente ronda o finalizar
        setTimeout(() => {
            if (room.round >= room.settings.maxRounds * Object.keys(room.players).length) {
                room.status = 'final';
                pictionaryNamespace.to(roomId).emit('stateUpdate', sanitizeRoom(room));
            } else {
                startNewRound(room, roomId);
            }
        }, 5000);
    }

    socket.on('draw', (data) => {
        const room = pictionaryRooms.get(socket.roomId);
        if (room && room.status === 'jugando' && room.drawerId === socket.id) {
            room.drawHistory.push(data);
            socket.to(socket.roomId).emit('draw', data);
        }
    });

    socket.on('clearCanvas', () => {
        const room = pictionaryRooms.get(socket.roomId);
        if (room && room.status === 'jugando' && room.drawerId === socket.id) {
            room.drawHistory = [];
            pictionaryNamespace.to(socket.roomId).emit('clearCanvas');
        }
    });

    socket.on('sendMessage', (message) => {
        const room = pictionaryRooms.get(socket.roomId);
        if (!room) return;

        const player = room.players[socket.id];
        if (!player) return;

        // Verificar si es la palabra correcta (y no es el dibujante)
        if (room.status === 'jugando' && socket.id !== room.drawerId && !player.hasGuessed) {
            if (message.toLowerCase().trim() === room.currentWord.toLowerCase().trim()) {
                player.hasGuessed = true;
                player.points += Math.max(10, room.timer); // Más puntos si adivina rápido
                
                // Puntos para el dibujante también
                if (room.players[room.drawerId]) {
                    room.players[room.drawerId].points += 5;
                }

                room.chat.push({ system: true, message: `¡${player.name} adivinó la palabra!` });
                pictionaryNamespace.to(socket.roomId).emit('stateUpdate', sanitizeRoom(room));

                // Si todos adivinaron, terminar ronda antes
                const guidersCount = Object.values(room.players).filter(p => p.hasGuessed).length;
                if (guidersCount === Object.keys(room.players).length - 1) {
                    endRound(room, socket.roomId);
                }
                return;
            }
        }

        room.chat.push({ name: player.name, message });
        if (room.chat.length > 20) room.chat.shift();
        pictionaryNamespace.to(socket.roomId).emit('message', { name: player.name, message });
    });

    socket.on('disconnect', () => {
        const room = pictionaryRooms.get(socket.roomId);
        if (room) {
            delete room.players[socket.id];
            if (Object.keys(room.players).length === 0) {
                if (room.interval) clearInterval(room.interval);
                pictionaryRooms.delete(socket.roomId);
            } else {
                if (socket.id === room.hostId) room.hostId = Object.keys(room.players)[0];
                if (socket.id === room.drawerId) endRound(room, socket.roomId);
                pictionaryNamespace.to(socket.roomId).emit('stateUpdate', sanitizeRoom(room));
            }
        }
    });
}
