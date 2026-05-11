import Phaser from 'phaser';
import { PlayerData } from './types';
import { InputController } from './input/InputController';
import { LocalPlayer, PLAYER_RADIUS } from './entities/LocalPlayer';
import { RemotePlayer } from './entities/RemotePlayer';
import { NetworkClient } from './net/NetworkClient';

const POSITION_SEND_HZ = 20;
const SEND_INTERVAL_MS = 1000 / POSITION_SEND_HZ;

export class GameScene extends Phaser.Scene {
  private inputCtl!: InputController;
  private network!: NetworkClient;
  private localPlayer?: LocalPlayer;
  private remotePlayers = new Map<string, RemotePlayer>();
  private sendAccumMs = 0;
  private lastSentX = Number.NaN;
  private lastSentY = Number.NaN;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    const gfx = this.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(PLAYER_RADIUS, PLAYER_RADIUS, PLAYER_RADIUS);
    gfx.generateTexture('circle', PLAYER_RADIUS * 2, PLAYER_RADIUS * 2);
    gfx.destroy();
  }

  create() {
    this.inputCtl = new InputController(this);

    const serverUrl = import.meta.env.VITE_SERVER_URL || window.location.origin;
    this.network = new NetworkClient(serverUrl, {
      onCurrentPlayers: (players) => this.handleCurrentPlayers(players),
      onNewPlayer: (player) => this.handleNewPlayer(player),
      onPlayerMoved: (player) => this.handlePlayerMoved(player),
      onUserDisconnected: (id) => this.handleDisconnect(id),
    });
  }

  update(_time: number, deltaMs: number) {
    const dt = deltaMs / 1000;

    if (this.localPlayer) {
      this.localPlayer.update(dt);
      this.maybeSendPosition(deltaMs);
    }

    for (const remote of this.remotePlayers.values()) {
      remote.update(dt);
    }
  }

  private handleCurrentPlayers(players: Record<string, PlayerData>) {
    for (const player of Object.values(players)) {
      if (player.id === this.network.id) {
        this.localPlayer = new LocalPlayer(this, player, this.inputCtl);
      } else {
        this.addRemote(player);
      }
    }
  }

  private handleNewPlayer(player: PlayerData) {
    if (player.id === this.network.id) return;
    this.addRemote(player);
  }

  private handlePlayerMoved(player: PlayerData) {
    const remote = this.remotePlayers.get(player.id);
    if (remote) remote.setTarget(player.x, player.y);
  }

  private handleDisconnect(id: string) {
    const remote = this.remotePlayers.get(id);
    if (!remote) return;
    remote.destroy();
    this.remotePlayers.delete(id);
  }

  private addRemote(player: PlayerData) {
    if (this.remotePlayers.has(player.id)) return;
    this.remotePlayers.set(player.id, new RemotePlayer(this, player));
  }

  private maybeSendPosition(deltaMs: number) {
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
}
