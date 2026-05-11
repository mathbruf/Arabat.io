import { PlayerData } from '../types';
import { InputController } from '../input/InputController';
import { PlayerAvatar, PLAYER_RADIUS } from './PlayerAvatar';

export { PLAYER_RADIUS };

const SPEED = 240;

export class LocalPlayer {
  readonly id: string;
  readonly avatar: PlayerAvatar;
  private input: InputController;
  private worldW: number;
  private worldH: number;
  private x: number;
  private y: number;

  constructor(
    scene: Phaser.Scene,
    data: PlayerData,
    input: InputController,
    world: { width: number; height: number },
  ) {
    this.id = data.id;
    this.input = input;
    this.worldW = world.width;
    this.worldH = world.height;
    this.x = data.x;
    this.y = data.y;
    this.avatar = new PlayerAvatar(scene, data, true);
  }

  update(deltaSeconds: number): void {
    const dir = this.input.getMoveDirection();
    if (dir.x === 0 && dir.y === 0) return;
    let nx = this.x + dir.x * SPEED * deltaSeconds;
    let ny = this.y + dir.y * SPEED * deltaSeconds;
    nx = clamp(nx, PLAYER_RADIUS, this.worldW - PLAYER_RADIUS);
    ny = clamp(ny, PLAYER_RADIUS, this.worldH - PLAYER_RADIUS);
    this.x = nx;
    this.y = ny;
    this.avatar.setPosition(nx, ny);
  }

  get position(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  applyServerPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.avatar.setPosition(x, y);
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

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
