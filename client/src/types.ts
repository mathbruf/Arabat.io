export interface PlayerData {
  id: string;
  name: string;
  x: number;
  y: number;
  color: number;
  hp: number;
  maxHp: number;
  alive: boolean;
}

export interface BulletData {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  spawnedAt: number;
}

export interface JoinedPayload {
  self: PlayerData;
  players: Record<string, PlayerData>;
  bullets: BulletData[];
  world: { width: number; height: number };
}

export interface PlayerHitPayload {
  playerId: string;
  hp: number;
  attackerId: string;
  bulletId: string;
}

export interface PlayerDiedPayload {
  playerId: string;
  killerId: string;
}

export interface BulletRemovedPayload {
  id: string;
}

export interface JoinRejectedPayload {
  reason: string;
}
