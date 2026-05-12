import { PlayerData } from '../types';
import { InputController } from '../input/InputController';
import { PlayerAvatar, PLAYER_RADIUS } from './PlayerAvatar';
import { Obstacle } from './Obstacle';

export { PLAYER_RADIUS };

const BASE_SPEED = 240;
const DASH_SPEED_MULTIPLIER = 4;
const DASH_DURATION = 0.15;
const DASH_COOLDOWN = 3.0;

export class LocalPlayer {
  readonly id: string;
  readonly avatar: PlayerAvatar;
  private input: InputController;
  private worldW: number;
  private worldH: number;
  private obstacles: Obstacle[];
  private x: number;
  private y: number;
  private speed = BASE_SPEED;
  private dashTimer = 0;
  private dashCooldown = 0;
  private dashDirX = 0;
  private dashDirY = 0;

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
    if (this.dashCooldown > 0) this.dashCooldown -= deltaSeconds;
    if (this.dashTimer > 0) this.dashTimer -= deltaSeconds;

    const dir = this.input.getMoveDirection();
    const dashing = this.dashTimer > 0;
    const moveDir = dashing ? { x: this.dashDirX, y: this.dashDirY } : dir;
    const moving = moveDir.x !== 0 || moveDir.y !== 0;

    if (moving) {
      const speed = dashing ? this.speed * DASH_SPEED_MULTIPLIER : this.speed;
      const step = speed * deltaSeconds;
      let nx = clamp(this.x + moveDir.x * step, PLAYER_RADIUS, this.worldW - PLAYER_RADIUS);
      if (this.collidesAt(nx, this.y)) nx = this.x;
      let ny = clamp(this.y + moveDir.y * step, PLAYER_RADIUS, this.worldH - PLAYER_RADIUS);
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
      this.avatar.setFacing(moveDir.x, moveDir.y);
    }
  }

  tryDash(): boolean {
    if (this.dashCooldown > 0 || this.dashTimer > 0) return false;
    const dir = this.input.getMoveDirection();
    if (dir.x === 0 && dir.y === 0) return false;
    this.dashDirX = dir.x;
    this.dashDirY = dir.y;
    this.dashTimer = DASH_DURATION;
    this.dashCooldown = DASH_COOLDOWN;
    this.avatar.dashFlash();
    return true;
  }

  get dashCooldownFraction(): number {
    return Math.max(0, this.dashCooldown / DASH_COOLDOWN);
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

  setStats(hp: number, maxHp: number): void {
    this.avatar.setStats(hp, maxHp);
  }

  increaseSpeed(factor: number): void {
    this.speed *= (1 + factor);
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
