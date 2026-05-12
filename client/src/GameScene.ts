import Phaser from 'phaser';
import {
  BulletData,
  BulletRemovedPayload,
  JoinRejectedPayload,
  JoinedPayload,
  PlayerData,
  PlayerDiedPayload,
  PlayerHitPayload,
  PlayerStatsPayload,
  TickPayload,
  UpgradeType,
} from './types';
import { InputController } from './input/InputController';
import { LocalPlayer } from './entities/LocalPlayer';
import { RemotePlayer } from './entities/RemotePlayer';
import { Bullet, ensureBulletTexture } from './entities/Bullet';
import { Obstacle } from './entities/Obstacle';
import { NetworkClient } from './net/NetworkClient';
import { Menu } from './ui/Menu';
import { MinimapHUD } from './ui/MinimapHUD';
import { XpHUD } from './ui/XpHUD';
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
  private minimap!: MinimapHUD;
  private xpHUD!: XpHUD;

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
    this.load.atlasXML(
      'characters',
      'assets/kenney_top-down-shooter/Spritesheet/spritesheet_characters.png',
      'assets/kenney_top-down-shooter/Spritesheet/spritesheet_characters.xml',
    );
    this.load.image('floor_tile', 'assets/kenney_top-down-shooter/PNG/Tiles/tile_01.png');
    ensureBulletTexture(this);
  }

  create() {
    this.setupBackground();

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.inputCtl = new InputController(this);

    this.menu = new Menu((name) => this.handleMenuSubmit(name));
    this.minimap = new MinimapHUD(this, WORLD_WIDTH, WORLD_HEIGHT);
    this.minimap.setVisible(false);
    this.xpHUD = new XpHUD((type) => this.handleUpgrade(type));

    this.network = new NetworkClient(resolveServerUrl(), {
      onConnect: () => this.menu.setConnected(true),
      onDisconnect: () => {
        this.menu.setConnected(false);
        this.menu.resetBusy();
      },
      onJoined: (payload) => this.handleJoined(payload),
      onJoinRejected: (payload) => this.handleJoinRejected(payload),
      onNewPlayer: (player) => this.handleNewPlayer(player),
      onTick: (payload) => this.handleTick(payload),
      onUserDisconnected: (id) => this.handleDisconnect(id),
      onBulletSpawned: (bullet) => this.handleBulletSpawned(bullet),
      onPlayerRespawned: (player) => this.handlePlayerRespawned(player),
      onPlayerStatsUpdated: (payload) => this.handlePlayerStatsUpdated(payload),
    });

    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.localPlayer) this.leaveToMenu();
    });

    this.menu.show('intro');
  }

  update(_time: number, deltaMs: number) {
    const dt = deltaMs / 1000;

    if (this.localPlayer) {
      const shootDir = this.inputCtl.getShootDirection();
      this.localPlayer.update(dt, shootDir);
      this.maybeSendPosition(deltaMs);
      this.maybeShoot();

      const cam = this.cameras.main;
      this.minimap.update(
        this.localPlayer.position.x,
        this.localPlayer.position.y,
        this.remotePlayers,
        cam.scrollX,
        cam.scrollY,
        cam.width,
        cam.height,
      );
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

    this.cameras.main.startFollow(this.localPlayer.getSprite(), true, 0.12, 0.12);
    this.minimap.setVisible(true);
    this.xpHUD.show();
    this.xpHUD.reset();

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

  private handleTick(payload: TickPayload): void {
    for (const move of payload.moved) this.handlePlayerMoved(move);
    for (const id of payload.removed) this.handleBulletRemoved({ id });
    for (const hit of payload.hits) this.handlePlayerHit(hit);
    for (const death of payload.deaths) this.handlePlayerDied(death);
  }

  private handlePlayerMoved(player: { id: string; x: number; y: number }): void {
    if (player.id === this.selfId) return;
    const remote = this.remotePlayers.get(player.id);
    if (remote) remote.setTarget(player.x, player.y);
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

    if (payload.killerId === this.selfId) {
      this.xpHUD.onKill();
    }

    if (payload.playerId === this.selfId) {
      const killerName = this.lookupName(payload.killerId);
      this.cameras.main.stopFollow();
      this.minimap.setVisible(false);
      this.xpHUD.hide();
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
      this.cameras.main.startFollow(this.localPlayer.getSprite(), true, 0.12, 0.12);
      this.minimap.setVisible(true);
      this.xpHUD.show();
      this.xpHUD.reset();
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
    const localAlive = this.localPlayer ? 1 : 0;
    this.menu.setPlayerCount(this.remotePlayers.size + localAlive);
  }

  private refreshLeaderboard(): void {
    const entries = Array.from(this.kills.entries()).map(([id, v]) => ({
      id,
      name: v.name,
      kills: v.kills,
    }));
    entries.sort((a, b) => b.kills - a.kills || a.name.localeCompare(b.name));
    this.menu.setLeaderboard(entries, this.selfId);
  }

  private spawnObstacles(
    obstacleData: { id: string; x: number; y: number; w: number; h: number }[],
  ): void {
    for (const o of this.obstacles) o.destroy();
    this.obstacles = obstacleData.map((d) => new Obstacle(this, d));
  }

  private leaveToMenu(): void {
    this.cameras.main.stopFollow();
    this.minimap.setVisible(false);
    this.xpHUD.hide();
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

  private handleUpgrade(type: UpgradeType): void {
    if (type === 'speed') {
      this.localPlayer?.increaseSpeed(0.15);
    } else {
      this.network.sendUpgrade(type);
    }
  }

  private handlePlayerStatsUpdated(payload: PlayerStatsPayload): void {
    if (payload.playerId === this.selfId) {
      this.localPlayer?.setStats(payload.hp, payload.maxHp);
    } else {
      this.remotePlayers.get(payload.playerId)?.setStats(payload.hp, payload.maxHp);
    }
  }

  private setupBackground(): void {
    this.add
      .tileSprite(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 'floor_tile')
      .setDepth(-10);

    const g = this.add.graphics();
    g.setDepth(-9);
    g.lineStyle(4, 0x2a3b66, 0.8);
    g.strokeRect(2, 2, WORLD_WIDTH - 4, WORLD_HEIGHT - 4);
  }
}
