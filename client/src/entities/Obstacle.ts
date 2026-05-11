import Phaser from 'phaser';
import { ObstacleData } from '../types';

export class Obstacle {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  private gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, data: ObstacleData) {
    this.id = data.id;
    this.x = data.x;
    this.y = data.y;
    this.w = data.w;
    this.h = data.h;

    this.gfx = scene.add.graphics();
    this.gfx.setDepth(-5);
    this.draw();
  }

  private draw(): void {
    const g = this.gfx;
    const { x, y, w, h } = this;

    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(x + 3, y + 4, w, h, 4);

    g.fillStyle(0x3b4970, 1);
    g.fillRoundedRect(x, y, w, h, 4);

    g.lineStyle(2, 0x6f87b8, 1);
    g.strokeRoundedRect(x, y, w, h, 4);

    g.lineStyle(1, 0x1d2540, 0.7);
    g.beginPath();
    g.moveTo(x + 6, y + h / 2);
    g.lineTo(x + w - 6, y + h / 2);
    g.strokePath();
    g.beginPath();
    g.moveTo(x + w / 2, y + 6);
    g.lineTo(x + w / 2, y + h - 6);
    g.strokePath();
  }

  // Closest point on rectangle to (cx, cy); used by callers for circle-rect tests.
  closestPointTo(cx: number, cy: number): { x: number; y: number } {
    return {
      x: Math.max(this.x, Math.min(cx, this.x + this.w)),
      y: Math.max(this.y, Math.min(cy, this.y + this.h)),
    };
  }

  overlapsCircle(cx: number, cy: number, r: number): boolean {
    const p = this.closestPointTo(cx, cy);
    const dx = cx - p.x;
    const dy = cy - p.y;
    return dx * dx + dy * dy < r * r;
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
