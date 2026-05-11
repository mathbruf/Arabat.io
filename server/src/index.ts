import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import path from 'path';

const app = express();
app.use(cors());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
  },
});

interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  color: number;
}

const players: Record<string, Player> = {};

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// FNV-1a — stable hash across runs, identical for identical inputs.
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Hue derived from id → all clients render the same color for the same player.
function colorForId(id: string): number {
  const hue = hashString(id) % 360;
  const s = 0.65;
  const l = 0.55;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = hue / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp < 1) { r1 = c; g1 = x; }
  else if (hp < 2) { r1 = x; g1 = c; }
  else if (hp < 3) { g1 = c; b1 = x; }
  else if (hp < 4) { g1 = x; b1 = c; }
  else if (hp < 5) { r1 = x; b1 = c; }
  else { r1 = c; b1 = x; }
  const m = l - c / 2;
  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);
  return (r << 16) | (g << 8) | b;
}

function nameForId(id: string): string {
  return `P-${id.substring(0, 4)}`;
}

io.on('connection', (socket: Socket) => {
  console.log(`Player connected: ${socket.id}`);

  const newPlayer: Player = {
    id: socket.id,
    name: nameForId(socket.id),
    x: randomBetween(100, 700),
    y: randomBetween(100, 500),
    color: colorForId(socket.id),
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

// Serve the built client. Only enabled when the build output exists, so a
// server-only local dev run (no client build) still boots without errors.
import { existsSync } from 'fs';
const clientDist = path.resolve(__dirname, '../../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.send('arabat-io server is running (no client build present)');
  });
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
