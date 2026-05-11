import { PlayerData } from '../types';
import { InputController } from '../input/InputController';
import { PlayerAvatar, PLAYER_RADIUS } from './PlayerAvatar';
import { Obstacle } from './Obstacle';

export { PLAYER_RADIUS };

const SPEED = 240;

export class LocalPlayer {
  readonly id: string;
  readonly avatar: PlayerAvatar;
  private input: InputController;
  private worldW: number;
  private worldH: number;
  private obstacles: Obstacle[];
  private x: number;
  private y: number;

  constructor(
    scene: Phaser.Scene,
    data: PlayerData,
    input: InputController,
    world: { width: number; height: number },
    obstacles: Obstacle[],
  ) {
    this.id = data.id;
    this.input = input;
    this.worldW = world.width;
    this.worldH = world.height;
    this.obstacles = obstacles;
    this.x = data.x;
    this.y = data.y;
    this.avatar = new PlayerAvatar(scene, data, true);
  }

  update(deltaSeconds: number, shootDir?: { x: number; y: number } | null): void {
    const dir = this.input.getMoveDirection();
    const moving = dir.x !== 0 || dir.y !== 0;

    if (moving) {
      const step = SPEED * deltaSeconds;
      let nx = clamp(this.x + dir.x * step, PLAYER_RADIUS, this.worldW - PLAYER_RADIUS);
      if (this.collidesAt(nx, this.y)) nx = this.x;
      let ny = clamp(this.y + dir.y * step, PLAYER_RADIUS, this.worldH - PLAYER_RADIUS);
      if (this.collidesAt(nx, ny)) ny = this.y;
      if (nx !== this.x || ny !== this.y) {
        this.x = nx;
        this.y = ny;
        this.avatar.setPosition(nx, ny);
      }
    }

    if (shootDir && (shootDir.x !== 0 || shootDir.y !== 0)) {
      this.avatar.setFacing(shootDir.x, shootDir.y);
    } else if (moving) {
      this.avatar.setFacing(dir.x, dir.y);
    }
  }

  private collidesAt(x: number, y: number): boolean {
    for (const o of this.obstacles) {
      if (o.overlapsCircle(x, y, PLAYER_RADIUS)) return true;
    }
    return false;
  }

  get position(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  getSprite(): Phaser.GameObjects.Sprite {
    return this.avatar.getSprite();
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
