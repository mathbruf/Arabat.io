import Phaser from 'phaser';
import { PlayerData } from '../types';
import { InputController } from '../input/InputController';

const SPEED = 240;
export const PLAYER_RADIUS = 16;

export class LocalPlayer {
  readonly id: string;
  private sprite: Phaser.GameObjects.Sprite;
  private input: InputController;
  private boundsW: number;
  private boundsH: number;

  constructor(scene: Phaser.Scene, data: PlayerData, input: InputController) {
    this.id = data.id;
    this.input = input;
    this.boundsW = scene.scale.width;
    this.boundsH = scene.scale.height;

    this.sprite = scene.add.sprite(data.x, data.y, 'circle');
    this.sprite.setTint(data.color);
  }

  update(deltaSeconds: number): void {
    const dir = this.input.getDirection();
    let nx = this.sprite.x + dir.x * SPEED * deltaSeconds;
    let ny = this.sprite.y + dir.y * SPEED * deltaSeconds;
    nx = Phaser.Math.Clamp(nx, PLAYER_RADIUS, this.boundsW - PLAYER_RADIUS);
    ny = Phaser.Math.Clamp(ny, PLAYER_RADIUS, this.boundsH - PLAYER_RADIUS);
    this.sprite.setPosition(nx, ny);
  }

  get position(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y };
  }
}
