const BOMBA_CATEGORIES = [
    "Marcas de cerveza", "Cosas que hay en una cocina", "Ciudades de Colombia",
    "Equipos de fútbol", "Frutas", "Animales de la selva", "Nombres que empiecen por A",
    "Cosas que se llevan a la playa", "Géneros musicales", "Personajes de Disney",
    "Marcas de carros", "Comida chatarra", "Cosas verdes", "Herramientas",
    "Cantantes famosos", "Superhéroes", "Países del mundo", "Partes del cuerpo"
];

const bombaRooms = new Map();

function getOrCreateBombaRoom(roomId) {
    if (!bombaRooms.has(roomId)) {
        bombaRooms.set(roomId, {
            status: 'esperando',
            players: {},
            hostId: null,
            currentPlayerId: null,
            currentCategory: '',
            timer: 0,
            isExploded: false,
            loserId: null,
            settings: {
                minTime: 15,
                maxTime: 40
            },
            bombInterval: null
        });
    }
    return bombaRooms.get(roomId);
}

function sanitizeRoom(room) {
    const cleanRoom = { ...room };
    delete cleanRoom.bombInterval;
    return cleanRoom;
}

export default function registerBombaHandlers(io, socket) {
    const bombaNamespace = io.of('/bomba');

    socket.on('join', ({ name, roomId, isCreator }) => {
        if (!roomId) return;
        const room = getOrCreateBombaRoom(roomId);
        socket.join(roomId);
        socket.roomId = roomId;

        room.players[socket.id] = {
            id: socket.id,
            name: name || `Jugador ${Object.keys(room.players).length + 1}`,
            lives: 3
        };

        if (isCreator || !room.hostId) room.hostId = socket.id;
        bombaNamespace.to(roomId).emit('stateUpdate', sanitizeRoom(room));
    });

    socket.on('startGame', () => {
        const room = bombaRooms.get(socket.roomId);
        if (room && room.hostId === socket.id) {
            const playerIds = Object.keys(room.players);
            if (playerIds.length < 2) return;

            room.status = 'jugando';
            room.currentPlayerId = playerIds[Math.floor(Math.random() * playerIds.length)];
            room.currentCategory = BOMBA_CATEGORIES[Math.floor(Math.random() * BOMBA_CATEGORIES.length)];
            room.isExploded = false;
            room.loserId = null;

            // Tiempo secreto de la bomba
            const time = Math.floor(Math.random() * (room.settings.maxTime - room.settings.minTime + 1)) + room.settings.minTime;
            room.timer = time;

            if (room.bombInterval) clearInterval(room.bombInterval);
            room.bombInterval = setInterval(() => {
                if (room.status !== 'jugando') {
                    clearInterval(room.bombInterval);
                    return;
                }
                room.timer -= 1;
                
                if (room.timer <= 0) {
                    clearInterval(room.bombInterval);
                    room.status = 'explosion';
                    room.isExploded = true;
                    room.loserId = room.currentPlayerId;
                    if (room.players[room.loserId]) {
                        room.players[room.loserId].lives -= 1;
                    }
                    bombaNamespace.to(socket.roomId).emit('exploded', { loserId: room.loserId });
                    bombaNamespace.to(socket.roomId).emit('stateUpdate', sanitizeRoom(room));
                }
            }, 1000);

            bombaNamespace.to(socket.roomId).emit('stateUpdate', sanitizeRoom(room));
        }
    });

    socket.on('passBomb', () => {
        const room = bombaRooms.get(socket.roomId);
        if (room && room.status === 'jugando' && room.currentPlayerId === socket.id) {
            const playerIds = Object.keys(room.players);
            const currentIndex = playerIds.indexOf(socket.id);
            const nextIndex = (currentIndex + 1) % playerIds.length;
            room.currentPlayerId = playerIds[nextIndex];

            bombaNamespace.to(socket.roomId).emit('stateUpdate', sanitizeRoom(room));
        }
    });

    socket.on('nextRound', () => {
        const room = bombaRooms.get(socket.roomId);
        if (room && room.hostId === socket.id) {
            // Nueva categoría para la siguiente ronda
            room.currentCategory = BOMBA_CATEGORIES[Math.floor(Math.random() * BOMBA_CATEGORIES.length)];
            // Resetear juego (similar a startGame pero manteniendo el perdedor actual como primer turno para que se desquite)
            socket.emit('startGame'); 
        }
    });

    socket.on('disconnect', () => {
        const room = bombaRooms.get(socket.roomId);
        if (room) {
            delete room.players[socket.id];
            if (Object.keys(room.players).length === 0) {
                if (room.bombInterval) clearInterval(room.bombInterval);
                bombaRooms.delete(socket.roomId);
            } else {
                if (socket.id === room.hostId) room.hostId = Object.keys(room.players)[0];
                if (socket.id === room.currentPlayerId) {
                    room.currentPlayerId = Object.keys(room.players)[0];
                }
                bombaNamespace.to(socket.roomId).emit('stateUpdate', sanitizeRoom(room));
            }
        }
    });
}
