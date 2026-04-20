const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    socket.on('joinRoom', ({ roomId, username }) => {
        let room = rooms.get(roomId);

        if (!room) {
            room = {
                id: roomId,
                players: [],
                board: Array(9).fill(null),
                scores: { x: 0, o: 0 },
                startingPlayerIndex: 0, // 0 for the first player, 1 for the second
                currentTurn: null, // Socket ID of the player who's turn it is
                gameActive: false
            };
            rooms.set(roomId, room);
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

        // Notificar que se unió exitosamente para mostrar el ID de sala
        socket.emit('roomJoined', { roomId, symbol: playerSymbol });

        console.log(`Jugador ${username} se unió a la sala ${roomId} como ${playerSymbol}`);

        if (room.players.length === 2) {
            room.gameActive = true;
            // First time, the first player starts
            room.currentTurn = room.players[room.startingPlayerIndex].id;
            io.to(roomId).emit('gameStart', {
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
        const room = rooms.get(roomId);
        if (!room || !room.gameActive || room.currentTurn !== socket.id) return;

        const player = room.players.find(p => p.id === socket.id);
        if (room.board[index] === null) {
            room.board[index] = player.symbol;
            
            const winResult = checkWinner(room.board);
            if (winResult) {
                if (winResult === 'draw') {
                    io.to(roomId).emit('gameEnd', { board: room.board, winner: 'draw' });
                } else {
                    const winner = room.players.find(p => p.symbol === winResult);
                    room.scores[winResult.toLowerCase()]++;
                    io.to(roomId).emit('gameEnd', { board: room.board, winner, scores: room.scores });
                }
                room.gameActive = false;
            } else {
                // Change turn
                const otherPlayer = room.players.find(p => p.id !== socket.id);
                room.currentTurn = otherPlayer.id;
                io.to(roomId).emit('moveMade', { board: room.board, nextTurn: room.currentTurn });
            }
        }
    });

    socket.on('restartGame', (roomId) => {
        const room = rooms.get(roomId);
        if (!room) return;

        // Alternar quién empieza
        room.startingPlayerIndex = (room.startingPlayerIndex + 1) % 2;
        room.board = Array(9).fill(null);
        room.gameActive = true;
        room.currentTurn = room.players[room.startingPlayerIndex].id;

        io.to(roomId).emit('gameStart', {
            players: room.players,
            currentTurn: room.currentTurn,
            board: room.board,
            scores: room.scores
        });
    });

    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
        for (const [roomId, room] of rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                room.gameActive = false;
                room.board = Array(9).fill(null);
                io.to(roomId).emit('playerLeft', 'Tu oponente se ha desconectado');
                if (room.players.length === 0) {
                    rooms.delete(roomId);
                }
                break;
            }
        }
    });
});

function checkWinner(board) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
        [0, 4, 8], [2, 4, 6]             // Diags
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
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
