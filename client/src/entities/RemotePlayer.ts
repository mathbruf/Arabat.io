import Phaser from 'phaser';
import { PlayerData } from '../types';

const LABEL_OFFSET_Y = 28;
// Higher = snappier interp toward latest network position.
const INTERP_RATE = 12;

export class RemotePlayer {
  readonly id: string;
  private sprite: Phaser.GameObjects.Sprite;
  private label: Phaser.GameObjects.Text;
  private targetX: number;
  private targetY: number;

  constructor(scene: Phaser.Scene, data: PlayerData) {
    this.id = data.id;
    this.targetX = data.x;
    this.targetY = data.y;

    this.sprite = scene.add.sprite(data.x, data.y, 'circle');
    this.sprite.setTint(data.color);
    this.sprite.setAlpha(0.9);

    this.label = scene.add
      .text(data.x, data.y - LABEL_OFFSET_Y, data.name, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1);
  }

  setTarget(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  update(deltaSeconds: number): void {
    // Exponential smoothing — frame-rate independent.
    const t = 1 - Math.exp(-INTERP_RATE * deltaSeconds);
    this.sprite.x += (this.targetX - this.sprite.x) * t;
    this.sprite.y += (this.targetY - this.sprite.y) * t;
    this.label.setPosition(this.sprite.x, this.sprite.y - LABEL_OFFSET_Y);
  }

  destroy(): void {
    this.sprite.destroy();
    this.label.destroy();
  }
}
