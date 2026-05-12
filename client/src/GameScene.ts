import Phaser from 'phaser';
import {
  BulletData,
  BulletRemovedPayload,
  JoinRejectedPayload,
  JoinedPayload,
  PlayerData,
  PlayerDiedPayload,
  PlayerHitPayload,
  PlayerPositionUpdate,
  StateUpdate,
} from './types';
import { InputController } from './input/InputController';
import { LocalPlayer, PLAYER_RADIUS } from './entities/LocalPlayer';
import { RemotePlayer } from './entities/RemotePlayer';
import { Bullet, ensureBulletTexture } from './entities/Bullet';
import { Obstacle } from './entities/Obstacle';
import { NetworkClient } from './net/NetworkClient';
import { Menu } from './ui/Menu';
import { WORLD_WIDTH, WORLD_HEIGHT } from './constants';

const POSITION_SEND_HZ = 20;
const SEND_INTERVAL_MS = 1000 / POSITION_SEND_HZ;
const SHOOT_COOLDOWN_MS = 500;

function resolveServerUrl(): string {
  const raw = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? '';
  if (raw) return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  if (import.meta.env.DEV) return 'http://localhost:3000';
  return '';
}

export class GameScene extends Phaser.Scene {
  private inputCtl!: InputController;
  private network!: NetworkClient;
  private menu!: Menu;

  private localPlayer?: LocalPlayer;
  private selfId?: string;
  private lastSelfName = '';

  private remotePlayers = new Map<string, RemotePlayer>();
  private bullets = new Map<string, Bullet>();
  private obstacles: Obstacle[] = [];
  private kills = new Map<string, { name: string; kills: number }>();

  private sendAccumMs = 0;
  private lastSentX = Number.NaN;
  private lastSentY = Number.NaN;
  private lastShootAtMs = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    const gfx = this.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(PLAYER_RADIUS, PLAYER_RADIUS, PLAYER_RADIUS);
    gfx.generateTexture('circle', PLAYER_RADIUS * 2, PLAYER_RADIUS * 2);
    gfx.destroy();
    ensureBulletTexture(this);
  }

  create() {
    this.drawArenaBackground();
    this.inputCtl = new InputController(this);

    this.menu = new Menu((name) => this.handleMenuSubmit(name));

    this.network = new NetworkClient(resolveServerUrl(), {
      onConnect: () => this.menu.setConnected(true),
      onDisconnect: () => {
        this.menu.setConnected(false);
        this.menu.resetBusy();
      },
      onJoined: (payload) => this.handleJoined(payload),
      onJoinRejected: (payload) => this.handleJoinRejected(payload),
      onState: (update) => this.handleState(update),
    });

    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.localPlayer) this.leaveToMenu();
    });

    this.menu.show('intro');
  }

  update(_time: number, deltaMs: number) {
    const dt = deltaMs / 1000;

    if (this.localPlayer) {
      this.localPlayer.update(dt);
      this.maybeSendPosition(deltaMs);
      this.maybeShoot();
    }

    for (const remote of this.remotePlayers.values()) {
      remote.update(dt);
    }

    for (const bullet of this.bullets.values()) {
      bullet.update();
    }
  }

  private handleMenuSubmit(name: string): void {
    if (!this.network.connected) {
      this.menu.setError('Not connected. Trying to reconnect…');
      this.menu.resetBusy();
      return;
    }
    this.lastSelfName = name;
    if (this.selfId && !this.localPlayer) {
      this.network.respawn(name);
    } else {
      this.network.join(name);
    }
  }

  private handleJoined(payload: JoinedPayload): void {
    this.selfId = payload.self.id;
    this.menu.hide();
    this.menu.resetBusy();
    this.lastSelfName = payload.self.name;

    this.spawnObstacles(payload.obstacles);
    this.localPlayer = new LocalPlayer(
      this,
      payload.self,
      this.inputCtl,
      payload.world,
      this.obstacles,
    );
    this.lastSentX = payload.self.x;
    this.lastSentY = payload.self.y;

    this.kills.clear();
    for (const player of Object.values(payload.players)) {
      this.kills.set(player.id, { name: player.name, kills: player.kills });
      if (player.id !== payload.self.id) this.spawnRemote(player);
    }
    for (const bullet of payload.bullets) {
      this.spawnBullet(bullet);
    }
    this.refreshPlayerCount();
    this.refreshLeaderboard();
  }

  private handleJoinRejected(payload: JoinRejectedPayload): void {
    const msg =
      payload.reason === 'invalid_name'
        ? 'Invalid name. Try something else.'
        : `Join failed: ${payload.reason}`;
    this.menu.setError(msg);
    this.menu.resetBusy();
  }

  private handleNewPlayer(player: PlayerData): void {
    if (player.id === this.selfId) return;
    this.spawnRemote(player);
    this.kills.set(player.id, { name: player.name, kills: player.kills });
    this.refreshPlayerCount();
    this.refreshLeaderboard();
  }

  private handleState(update: StateUpdate): void {
    for (const player of update.joined) this.handleNewPlayer(player);
    for (const player of update.respawned) this.handlePlayerRespawned(player);
    for (const bullet of update.spawnedBullets) this.handleBulletSpawned(bullet);
    for (const pos of update.players) this.applyPlayerPosition(pos);
    for (const hit of update.hits) this.handlePlayerHit(hit);
    for (const death of update.deaths) this.handlePlayerDied(death);
    for (const id of update.removedBullets) this.handleBulletRemoved({ id });
    for (const id of update.left) this.handleDisconnect(id);
  }

  private applyPlayerPosition(pos: PlayerPositionUpdate): void {
    if (pos.id === this.selfId) {
      // self position is client-authoritative; hp arrives via hits
      return;
    }
    const remote = this.remotePlayers.get(pos.id);
    if (!remote) return;
    remote.setTarget(pos.x, pos.y);
    remote.setHp(pos.hp);
  }

  private handleDisconnect(id: string): void {
    const remote = this.remotePlayers.get(id);
    if (remote) {
      remote.destroy();
      this.remotePlayers.delete(id);
    }
    this.kills.delete(id);
    this.refreshPlayerCount();
    this.refreshLeaderboard();
  }

  private handleBulletSpawned(bullet: BulletData): void {
    this.spawnBullet(bullet);
  }

  private handleBulletRemoved(payload: BulletRemovedPayload): void {
    const b = this.bullets.get(payload.id);
    if (!b) return;
    b.destroy();
    this.bullets.delete(payload.id);
  }

  private handlePlayerHit(payload: PlayerHitPayload): void {
    if (payload.playerId === this.selfId) {
      this.localPlayer?.setHp(payload.hp);
      this.localPlayer?.flash();
      this.cameras.main.shake(80, 0.004);
    } else {
      const remote = this.remotePlayers.get(payload.playerId);
      if (remote) {
        remote.setHp(payload.hp);
        remote.flash();
      }
    }
  }

  private handlePlayerDied(payload: PlayerDiedPayload): void {
    const killerEntry = this.kills.get(payload.killerId);
    if (killerEntry) killerEntry.kills += 1;
    this.refreshLeaderboard();

    if (payload.playerId === this.selfId) {
      const killerName = this.lookupName(payload.killerId);
      this.localPlayer?.destroy();
      this.localPlayer = undefined;
      this.menu.show('death', { killerName });
    } else {
      const remote = this.remotePlayers.get(payload.playerId);
      if (remote) remote.setVisible(false);
    }
  }

  private handlePlayerRespawned(player: PlayerData): void {
    const entry = this.kills.get(player.id);
    if (entry) entry.name = player.name;
    this.refreshLeaderboard();

    if (player.id === this.selfId) {
      this.localPlayer = new LocalPlayer(
        this,
        player,
        this.inputCtl,
        { width: WORLD_WIDTH, height: WORLD_HEIGHT },
        this.obstacles,
      );
      this.lastSentX = player.x;
      this.lastSentY = player.y;
      this.menu.hide();
      this.menu.resetBusy();
    } else {
      const existing = this.remotePlayers.get(player.id);
      if (existing) {
        existing.destroy();
        this.remotePlayers.delete(player.id);
      }
      this.spawnRemote(player);
    }
  }

  private spawnRemote(player: PlayerData): void {
    if (this.remotePlayers.has(player.id)) return;
    const r = new RemotePlayer(this, player);
    r.setHp(player.hp);
    if (!player.alive) r.setVisible(false);
    this.remotePlayers.set(player.id, r);
  }

  private spawnBullet(data: BulletData): void {
    if (this.bullets.has(data.id)) return;
    this.bullets.set(data.id, new Bullet(this, data));
  }

  private lookupName(id: string): string | null {
    if (id === this.selfId) return this.lastSelfName || null;
    return this.remotePlayers.get(id)?.name ?? null;
  }

  private refreshPlayerCount(): void {
    // +1 for the local player when alive (not in remote map).
    const localAlive = this.localPlayer ? 1 : 0;
    this.menu.setPlayerCount(this.remotePlayers.size + localAlive);
  }

  private refreshLeaderboard(): void {
    const entries = Array.from(this.kills.entries()).map(([id, v]) => ({
      id,
      name: v.name,
      kills: v.kills,
    }));
    entries.sort((a, b) =>
      b.kills - a.kills || a.name.localeCompare(b.name),
    );
    this.menu.setLeaderboard(entries, this.selfId);
  }

  private spawnObstacles(obstacleData: { id: string; x: number; y: number; w: number; h: number }[]): void {
    for (const o of this.obstacles) o.destroy();
    this.obstacles = obstacleData.map((d) => new Obstacle(this, d));
  }

  private leaveToMenu(): void {
    this.network.leaveGame();
    this.localPlayer?.destroy();
    this.localPlayer = undefined;
    for (const r of this.remotePlayers.values()) r.destroy();
    this.remotePlayers.clear();
    for (const b of this.bullets.values()) b.destroy();
    this.bullets.clear();
    for (const o of this.obstacles) o.destroy();
    this.obstacles = [];
    this.kills.clear();
    this.selfId = undefined;
    this.refreshLeaderboard();
    this.menu.setPlayerCount(0);
    this.menu.show('intro');
  }

  private maybeSendPosition(deltaMs: number): void {
    if (!this.localPlayer) return;
    this.sendAccumMs += deltaMs;
    if (this.sendAccumMs < SEND_INTERVAL_MS) return;
    this.sendAccumMs = 0;

    const { x, y } = this.localPlayer.position;
    const rx = Math.round(x);
    const ry = Math.round(y);
    if (rx === this.lastSentX && ry === this.lastSentY) return;
    this.lastSentX = rx;
    this.lastSentY = ry;
    this.network.sendPosition(rx, ry);
  }

  private maybeShoot(): void {
    const dir = this.inputCtl.getShootDirection();
    if (!dir) return;
    const now = performance.now();
    if (now - this.lastShootAtMs < SHOOT_COOLDOWN_MS) return;
    this.lastShootAtMs = now;
    this.network.shoot(dir.x, dir.y);
  }

  private drawArenaBackground(): void {
    const g = this.add.graphics();
    g.setDepth(-10);

    g.fillStyle(0x0b1023, 1);
    g.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Soft vignette via concentric stroked rects.
    g.lineStyle(1, 0x18213e, 0.5);
    const step = 60;
    for (let x = step; x < WORLD_WIDTH; x += step) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, WORLD_HEIGHT);
      g.strokePath();
    }
    for (let y = step; y < WORLD_HEIGHT; y += step) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(WORLD_WIDTH, y);
      g.strokePath();
    }

    g.lineStyle(3, 0x2a3b66, 0.7);
    g.strokeRect(2, 2, WORLD_WIDTH - 4, WORLD_HEIGHT - 4);
  }
}
