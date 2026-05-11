import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

interface Player {
  id: string;
  x: number;
  y: number;
  color: number;
}

const players: Record<string, Player> = {};

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomColor(): number {
  const colors = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xe91e63];
  return colors[Math.floor(Math.random() * colors.length)];
}

io.on('connection', (socket: Socket) => {
  console.log(`Player connected: ${socket.id}`);

  const newPlayer: Player = {
    id: socket.id,
    x: randomBetween(100, 700),
    y: randomBetween(100, 500),
    color: randomColor(),
  };
  players[socket.id] = newPlayer;

  socket.emit('currentPlayers', players);
  socket.broadcast.emit('newPlayer', newPlayer);

  socket.on('playerMovement', (data: { x: number; y: number }) => {
    const player = players[socket.id];
    if (!player) return;
    player.x = data.x;
    player.y = data.y;
    socket.broadcast.emit('playerMoved', player);
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];
    io.emit('userDisconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
