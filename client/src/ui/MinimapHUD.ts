import Phaser from 'phaser';
import { RemotePlayer } from '../entities/RemotePlayer';

const MM_WIDTH = 200;
const MM_HEIGHT = 113; // 16:9 to match world aspect
const PADDING = 12;

export class MinimapHUD {
  private gfx: Phaser.GameObjects.Graphics;
  private readonly mmX: number;
  private readonly mmY: number;
  private readonly worldW: number;
  private readonly worldH: number;

  constructor(scene: Phaser.Scene, worldW: number, worldH: number) {
    this.worldW = worldW;
    this.worldH = worldH;
    this.mmX = scene.scale.width - MM_WIDTH - PADDING;
    this.mmY = PADDING;

    this.gfx = scene.add.graphics();
    this.gfx.setScrollFactor(0);
    this.gfx.setDepth(200);
  }

  update(
    localX: number,
    localY: number,
    remotePlayers: Map<string, RemotePlayer>,
    camScrollX: number,
    camScrollY: number,
    camW: number,
    camH: number,
  ): void {
    const g = this.gfx;
    g.clear();

    const mx = this.mmX;
    const my = this.mmY;

    // Dark background with border
    g.fillStyle(0x000000, 0.75);
    g.fillRoundedRect(mx - 2, my - 2, MM_WIDTH + 4, MM_HEIGHT + 4, 3);
    g.fillStyle(0x0b1023, 0.88);
    g.fillRect(mx, my, MM_WIDTH, MM_HEIGHT);

    const toMM = (wx: number, wy: number) => ({
      x: mx + (wx / this.worldW) * MM_WIDTH,
      y: my + (wy / this.worldH) * MM_HEIGHT,
    });

    // Camera viewport rectangle
    const vpPos = toMM(camScrollX, camScrollY);
    const vpW = (camW / this.worldW) * MM_WIDTH;
    const vpH = (camH / this.worldH) * MM_HEIGHT;
    g.lineStyle(1, 0x4488ff, 0.5);
    g.strokeRect(vpPos.x, vpPos.y, vpW, vpH);

    // Remote players (colored dots)
    for (const rp of remotePlayers.values()) {
      if (!rp.alive) continue;
      const pos = toMM(rp.avatar.x, rp.avatar.y);
      g.fillStyle(rp.color, 1);
      g.fillCircle(pos.x, pos.y, 2.5);
    }

    // Local player (bright white, slightly bigger)
    const lp = toMM(localX, localY);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(lp.x, lp.y, 3.5);

    // Border
    g.lineStyle(1, 0x4466aa, 0.9);
    g.strokeRect(mx, my, MM_WIDTH, MM_HEIGHT);
  }

  setVisible(v: boolean): void {
    this.gfx.setVisible(v);
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
