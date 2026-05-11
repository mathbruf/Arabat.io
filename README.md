# Arabat.io — Multiplayer Game Boilerplate

Real-time multiplayer game using Phaser 3 + TypeScript (client) and Node.js + Socket.io (server).

## Quick Start

### 1. Start the server

```bash
cd server
npm install
npm run dev
```

Server runs at `http://localhost:3000`.

### 2. Start the client

```bash
cd client
npm install
npm run dev
```

Client runs at `http://localhost:5173`.

### 3. Play

Open two browser tabs at `http://localhost:5173`. Each tab spawns a colored square. Moving one with **WASD** or **Arrow Keys** updates it in real time on the other tab.

## Project Structure

```
arabat.io/
├── client/          # Phaser 3 + Vite + TypeScript
│   └── src/
│       ├── main.ts       # Phaser game config
│       └── GameScene.ts  # Main scene with socket logic
└── server/          # Express + Socket.io + TypeScript
    └── src/
        └── index.ts      # Server with player state management
```

## Socket Events

| Event | Direction | Payload |
|---|---|---|
| `currentPlayers` | server → client | all current players |
| `newPlayer` | server → clients | new player data |
| `playerMovement` | client → server | `{ x, y }` |
| `playerMoved` | server → other clients | updated player |
| `userDisconnected` | server → clients | disconnected player id |
