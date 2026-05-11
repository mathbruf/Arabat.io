import { PlayerData } from '../types';
import { PlayerAvatar } from './PlayerAvatar';

// Higher = snappier interp toward latest network position.
const INTERP_RATE = 14;

export class RemotePlayer {
  readonly id: string;
  readonly avatar: PlayerAvatar;
  name: string;
  private targetX: number;
  private targetY: number;
  private x: number;
  private y: number;

  constructor(scene: Phaser.Scene, data: PlayerData) {
    this.id = data.id;
    this.name = data.name;
    this.targetX = data.x;
    this.targetY = data.y;
    this.x = data.x;
    this.y = data.y;
    this.avatar = new PlayerAvatar(scene, data, false);
  }

  setTarget(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  update(deltaSeconds: number): void {
    const t = 1 - Math.exp(-INTERP_RATE * deltaSeconds);
    this.x += (this.targetX - this.x) * t;
    this.y += (this.targetY - this.y) * t;
    this.avatar.setPosition(this.x, this.y);
  }

  setHp(hp: number): void {
    this.avatar.setHp(hp);
  }

  flash(): void {
    this.avatar.flash();
  }

  setVisible(v: boolean): void {
    this.avatar.setVisible(v);
  }

  destroy(): void {
    this.avatar.destroy();
  }
}
