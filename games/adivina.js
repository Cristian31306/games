const ADIVINA_WORDS = {
    "Música": [
        "Shakira", "Karol G", "J Balvin", "Maluma", "Diomedes Díaz", 
        "Bad Bunny", "Feid", "Carlos Vives", "Juanes", "Daddy Yankee", 
        "Luis Miguel", "Camilo", "Silvestre Dangond", "Ryan Castro", "Greeicy",
        "Blessd", "Sebastián Yatra", "Manuel Turizo", "Jorge Celedón", "Pipe Bueno",
        "Dua Lipa", "Taylor Swift", "Rosalía", "Rauw Alejandro", "Bizarrap",
        "Tiësto", "Avicii", "Joe Arroyo", "Grupo Niche", "Guayacán Orquesta"
    ],
    "TV y Cine": [
        "El Chavo del 8", "Betty la Fea", "Spider-Man", "Batman", "Pedro el Escamoso", 
        "Iron Man", "Jack Sparrow", "La Roca", "Amparo Grisales", "Suso el Paspi", 
        "Joker", "Barbie", "Don Jediondo", "Piraña", "La Peliteñida",
        "La Casa de Papel", "Stranger Things", "Harry Potter", "Titanic", "Avatar",
        "Los Simpson", "Padre de Familia", "Shrek", "Toy Story", "Rey León",
        "Cobra Kai", "Pasión de Gavilanes", "La vendedora de rosas", "Narcos", "Sin senos no hay paraíso"
    ],
    "Deportes": [
        "James Rodríguez", "Luis Díaz", "Falcao García", "Lionel Messi", "Cristiano Ronaldo", 
        "Egan Bernal", "Mariana Pajón", "Neymar", "Rigoberto Urán", "René Higuita", 
        "Juanfer Quintero", "Pibe Valderrama", "Linda Caicedo", "Ronaldinho", "Usain Bolt",
        "Roger Federer", "Rafael Nadal", "Serena Williams", "LeBron James", "Stephen Curry",
        "Pau Gasol", "Caterine Ibargüen", "David Ospina", "Yerry Mina", "Cuadrado",
        "Checo Pérez", "Lewis Hamilton", "Tiger Woods", "Michael Jordan", "Kobe Bryant"
    ],
    "Tendencias": [
        "Elon Musk", "La Liendra", "Yeferson Cossio", "Westcol", "Bill Gates", 
        "Mark Zuckerberg", "Papa Francisco", "Donald Trump", "Epa Colombia", "Aida Victoria Merlano",
        "MrBeast", "Ibai Llanos", "Luisito Comunica", "Juanda", "Pautips",
        "Andrea Valdiri", "Felipe Saruma", "Dani Duke", "La Segura", "El Mindo",
        "Tulio Recomienda", "Jh de la Cruz", "Kylie Jenner", "Kim Kardashian", "Kanye West"
    ],
    "Lugares": [
        "Torre Eiffel", "Estatua de la Libertad", "Muralla China", "Coliseo Romano", "Machu Picchu",
        "Cartagena", "Medellín", "Bogotá", "San Andrés", "Caño Cristales",
        "Amazonas", "Piedra del Peñol", "Monserrate", "Parque Tayrona", "Nevado del Ruiz",
        "París", "Nueva York", "Londres", "Tokio", "Dubái",
        "Píramides de Egipto", "Cristo Redentor", "Gran Cañón", "Cataratas del Iguazú", "Disney World"
    ],
    "Comida": [
        "Bandeja Paisa", "Ajiaco", "Sancocho", "Arepa con Queso", "Empanada",
        "Tamal", "Lechona", "Mondongo", "Pizza", "Hamburguesa",
        "Sushi", "Tacos", "Pasta", "Hot Dog", "Salchipapa",
        "Chicharrón", "Buñuelo", "Natilla", "Pandebono", "Arroz con Pollo",
        "Lasagna", "Burrito", "Kebab", "Paella", "Ceviche"
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
            lastTurnResult: null,
            usedWords: []
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
            room.usedWords = []; // Resetear palabras usadas al inicio de la partida
            
            const category = room.settings.category;
            let words = [];
            
            if (category === "Aleatoria") {
                Object.values(ADIVINA_WORDS).forEach(catWords => {
                    words = words.concat(catWords);
                });
            } else {
                words = ADIVINA_WORDS[category] || ADIVINA_WORDS["Música"];
            }

            room.currentWord = words[Math.floor(Math.random() * words.length)];
            room.usedWords.push(room.currentWord);
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

            const category = room.settings.category;
            let words = [];
            
            if (category === "Aleatoria") {
                // Combinar todas las palabras de todas las categorías
                Object.values(ADIVINA_WORDS).forEach(catWords => {
                    words = words.concat(catWords);
                });
            } else {
                words = ADIVINA_WORDS[category] || ADIVINA_WORDS["Música"];
            }
            
            // Filtrar palabras que no se han usado
            let availableWords = words.filter(w => !room.usedWords.includes(w));
            
            // Si todas se usaron, reiniciar lista
            if (availableWords.length === 0) {
                room.usedWords = [];
                availableWords = words;
            }

            room.currentWord = availableWords[Math.floor(Math.random() * availableWords.length)];
            room.usedWords.push(room.currentWord);
            
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
