import { PlayerData } from '../types';
import { PlayerAvatar } from './PlayerAvatar';

const INTERP_RATE = 14;

export class RemotePlayer {
  readonly id: string;
  readonly avatar: PlayerAvatar;
  readonly color: number;
  name: string;
  private targetX: number;
  private targetY: number;
  private x: number;
  private y: number;
  private _alive = true;

  constructor(scene: Phaser.Scene, data: PlayerData) {
    this.id = data.id;
    this.name = data.name;
    this.color = data.color;
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
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    this.x += dx * t;
    this.y += dy * t;
    this.avatar.setPosition(this.x, this.y);
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      this.avatar.setFacing(dx, dy);
    }
  }

  get alive(): boolean { return this._alive; }

  setHp(hp: number): void {
    this.avatar.setHp(hp);
  }

  flash(): void {
    this.avatar.flash();
  }

  setVisible(v: boolean): void {
    this._alive = v;
    this.avatar.setVisible(v);
  }

  destroy(): void {
    this.avatar.destroy();
  }
}
