const tictactoeRooms = new Map();

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

export default function registerTicTacToeHandlers(io, socket) {
    const tictactoeNamespace = io.of('/tictactoe');

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
}
