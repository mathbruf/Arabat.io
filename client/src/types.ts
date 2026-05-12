export interface PlayerData {
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

export interface ObstacleData {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
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
  obstacles: ObstacleData[];
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

export interface TickPayload {
  moved: { id: string; x: number; y: number }[];
  removed: string[];
  hits: PlayerHitPayload[];
  deaths: PlayerDiedPayload[];
}

export type UpgradeType = 'health' | 'damage' | 'speed';

export interface PlayerStatsPayload {
  playerId: string;
  hp: number;
  maxHp: number;
}
