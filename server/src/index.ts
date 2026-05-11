import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { existsSync } from 'fs';

const app = express();
app.use(cors());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
  },
});

const WORLD_W = 1280;
const WORLD_H = 720;
const PLAYER_RADIUS = 16;
const MAX_HP = 100;
const BULLET_RADIUS = 4;
const BULLET_SPEED = 600;
const BULLET_LIFETIME_MS = 1500;
const BULLET_DAMAGE = 20;
const SHOOT_COOLDOWN_MS = 500;
const TICK_HZ = 30;
const TICK_MS = 1000 / TICK_HZ;
const NAME_MAX_LEN = 16;

interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  color: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  kills: number;
}

interface Bullet {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  spawnedAt: number;
}

interface Obstacle {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const OBSTACLES: Obstacle[] = [
  { id: 'o1', x: 180, y: 160, w: 120, h: 60 },
  { id: 'o2', x: 980, y: 160, w: 120, h: 60 },
  { id: 'o3', x: 180, y: 500, w: 120, h: 60 },
  { id: 'o4', x: 980, y: 500, w: 120, h: 60 },
  { id: 'o5', x: 560, y: 80, w: 160, h: 50 },
  { id: 'o6', x: 560, y: 590, w: 160, h: 50 },
  { id: 'o7', x: 460, y: 320, w: 80, h: 80 },
  { id: 'o8', x: 740, y: 320, w: 80, h: 80 },
];

const players: Record<string, Player> = {};
const bullets: Record<string, Bullet> = {};
const lastShotAt: Record<string, number> = {};
let bulletSeq = 0;

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function circleRectOverlap(cx: number, cy: number, r: number, o: Obstacle): boolean {
  const closestX = Math.max(o.x, Math.min(cx, o.x + o.w));
  const closestY = Math.max(o.y, Math.min(cy, o.y + o.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

function pointInRect(px: number, py: number, o: Obstacle): boolean {
  return px >= o.x && px <= o.x + o.w && py >= o.y && py <= o.y + o.h;
}

function positionFreeForPlayer(x: number, y: number): boolean {
  for (const o of OBSTACLES) {
    if (circleRectOverlap(x, y, PLAYER_RADIUS, o)) return false;
  }
  return true;
}

function randomSpawn(): { x: number; y: number } {
  const pad = PLAYER_RADIUS * 4;
  for (let i = 0; i < 32; i++) {
    const x = randomBetween(pad, WORLD_W - pad);
    const y = randomBetween(pad, WORLD_H - pad);
    if (positionFreeForPlayer(x, y)) return { x, y };
  }
  // Fallback: world center (kept free by obstacle layout).
  return { x: WORLD_W / 2, y: WORLD_H / 2 };
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

const CONTROL_CHAR_RE = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');

function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(CONTROL_CHAR_RE, '').trim().slice(0, NAME_MAX_LEN);
  return cleaned.length === 0 ? null : cleaned;
}

function clampToWorld(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(PLAYER_RADIUS, Math.min(WORLD_W - PLAYER_RADIUS, x)),
    y: Math.max(PLAYER_RADIUS, Math.min(WORLD_H - PLAYER_RADIUS, y)),
  };
}

io.on('connection', (socket: Socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join', (data: unknown) => {
    if (players[socket.id]) return;
    const name = sanitizeName((data as { name?: unknown })?.name);
    if (!name) {
      socket.emit('joinRejected', { reason: 'invalid_name' });
      return;
    }
    const spawn = randomSpawn();
    const player: Player = {
      id: socket.id,
      name,
      x: spawn.x,
      y: spawn.y,
      color: colorForId(socket.id),
      hp: MAX_HP,
      maxHp: MAX_HP,
      alive: true,
      kills: 0,
    };
    players[socket.id] = player;
    socket.emit('joined', {
      self: player,
      players,
      bullets: Object.values(bullets),
      obstacles: OBSTACLES,
      world: { width: WORLD_W, height: WORLD_H },
    });
    socket.broadcast.emit('newPlayer', player);
    console.log(`Player joined: ${name} (${socket.id})`);
  });

  socket.on('playerMovement', (data: { x: number; y: number }) => {
    const player = players[socket.id];
    if (!player || !player.alive) return;
    if (typeof data?.x !== 'number' || typeof data?.y !== 'number') return;
    const clamped = clampToWorld(data.x, data.y);
    // Slide along obstacles: take whichever single axis is free.
    let nx = clamped.x;
    let ny = clamped.y;
    if (!positionFreeForPlayer(nx, ny)) {
      if (positionFreeForPlayer(nx, player.y)) {
        ny = player.y;
      } else if (positionFreeForPlayer(player.x, ny)) {
        nx = player.x;
      } else {
        return; // movement fully blocked; ignore
      }
    }
    player.x = nx;
    player.y = ny;
    socket.broadcast.emit('playerMoved', player);
  });

  socket.on('shoot', (data: unknown) => {
    const player = players[socket.id];
    if (!player || !player.alive) return;
    const { dx, dy } = (data as { dx?: number; dy?: number }) ?? {};
    if (typeof dx !== 'number' || typeof dy !== 'number') return;
    const sdx = Math.sign(Math.trunc(dx));
    const sdy = Math.sign(Math.trunc(dy));
    // Require strictly one cardinal axis; reject diagonals and zeros.
    if ((sdx === 0) === (sdy === 0)) return;
    const now = Date.now();
    if (now - (lastShotAt[socket.id] ?? 0) < SHOOT_COOLDOWN_MS) return;
    lastShotAt[socket.id] = now;
    const bullet: Bullet = {
      id: `b${++bulletSeq}`,
      ownerId: socket.id,
      x: player.x + sdx * (PLAYER_RADIUS + BULLET_RADIUS + 2),
      y: player.y + sdy * (PLAYER_RADIUS + BULLET_RADIUS + 2),
      vx: sdx * BULLET_SPEED,
      vy: sdy * BULLET_SPEED,
      color: player.color,
      spawnedAt: now,
    };
    bullets[bullet.id] = bullet;
    io.emit('bulletSpawned', bullet);
  });

  socket.on('respawn', (data: unknown) => {
    const player = players[socket.id];
    if (!player || player.alive) return;
    const requestedName = sanitizeName((data as { name?: unknown })?.name);
    if (requestedName) player.name = requestedName;
    const spawn = randomSpawn();
    player.x = spawn.x;
    player.y = spawn.y;
    player.hp = MAX_HP;
    player.alive = true;
    io.emit('playerRespawned', player);
    console.log(`Player respawned: ${player.name} (${socket.id})`);
  });

  socket.on('leaveGame', () => {
    if (!players[socket.id]) return;
    delete players[socket.id];
    delete lastShotAt[socket.id];
    io.emit('userDisconnected', socket.id);
    console.log(`Player left: ${socket.id}`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    if (players[socket.id]) {
      delete players[socket.id];
      io.emit('userDisconnected', socket.id);
    }
    delete lastShotAt[socket.id];
  });
});

let lastTickAt = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = (now - lastTickAt) / 1000;
  lastTickAt = now;

  for (const id in bullets) {
    const b = bullets[id];
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (
      now - b.spawnedAt > BULLET_LIFETIME_MS ||
      b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H
    ) {
      delete bullets[id];
      io.emit('bulletRemoved', { id });
      continue;
    }

    let hitObstacle = false;
    for (const o of OBSTACLES) {
      if (pointInRect(b.x, b.y, o)) {
        hitObstacle = true;
        break;
      }
    }
    if (hitObstacle) {
      delete bullets[id];
      io.emit('bulletRemoved', { id });
      continue;
    }

    for (const pid in players) {
      if (pid === b.ownerId) continue;
      const p = players[pid];
      if (!p.alive) continue;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const r = PLAYER_RADIUS + BULLET_RADIUS;
      if (dx * dx + dy * dy <= r * r) {
        p.hp = Math.max(0, p.hp - BULLET_DAMAGE);
        io.emit('playerHit', {
          playerId: p.id,
          hp: p.hp,
          attackerId: b.ownerId,
          bulletId: b.id,
        });
        delete bullets[id];
        io.emit('bulletRemoved', { id });
        if (p.hp <= 0) {
          p.alive = false;
          const killer = players[b.ownerId];
          if (killer) killer.kills += 1;
          io.emit('playerDied', { playerId: p.id, killerId: b.ownerId });
        }
        break;
      }
    }
  }
}, TICK_MS);

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
