import Phaser from 'phaser';
import { BulletData } from '../types';

export const BULLET_RADIUS = 4;
const TEXTURE_KEY = 'bullet';

export function ensureBulletTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEY)) return;
  const gfx = scene.make.graphics({ x: 0, y: 0 });
  gfx.fillStyle(0xffffff, 1);
  gfx.fillCircle(BULLET_RADIUS, BULLET_RADIUS, BULLET_RADIUS);
  gfx.generateTexture(TEXTURE_KEY, BULLET_RADIUS * 2, BULLET_RADIUS * 2);
  gfx.destroy();
}

export class Bullet {
  readonly id: string;
  readonly ownerId: string;
  private sprite: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite;
  private startX: number;
  private startY: number;
  private vx: number;
  private vy: number;
  private startedAtMs: number;

  constructor(scene: Phaser.Scene, data: BulletData) {
    this.id = data.id;
    this.ownerId = data.ownerId;
    this.startX = data.x;
    this.startY = data.y;
    this.vx = data.vx;
    this.vy = data.vy;
    this.startedAtMs = performance.now();

    this.glow = scene.add.sprite(data.x, data.y, TEXTURE_KEY);
    this.glow.setTint(data.color);
    this.glow.setAlpha(0.35);
    this.glow.setScale(2.2);
    this.glow.setDepth(4);

    this.sprite = scene.add.sprite(data.x, data.y, TEXTURE_KEY);
    this.sprite.setTint(0xffffff);
    this.sprite.setDepth(5);
  }

  update(): void {
    const elapsed = (performance.now() - this.startedAtMs) / 1000;
    const x = this.startX + this.vx * elapsed;
    const y = this.startY + this.vy * elapsed;
    this.sprite.setPosition(x, y);
    this.glow.setPosition(x, y);
  }

  destroy(): void {
    this.sprite.destroy();
    this.glow.destroy();
  }
}
