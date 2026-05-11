import Phaser from 'phaser';
import { PlayerData } from '../types';

export const PLAYER_RADIUS = 16;
const LABEL_OFFSET_Y = 38;
const HPBAR_OFFSET_Y = 24;
const HPBAR_WIDTH = 36;
const HPBAR_HEIGHT = 5;

export class PlayerAvatar {
  readonly id: string;
  private scene: Phaser.Scene;
  private color: number;
  private sprite: Phaser.GameObjects.Sprite;
  private ring?: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private hpBar: Phaser.GameObjects.Graphics;
  private hp: number;
  private maxHp: number;
  private flashTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, data: PlayerData, isLocal: boolean) {
    this.id = data.id;
    this.scene = scene;
    this.color = data.color;
    this.hp = data.hp;
    this.maxHp = data.maxHp;

    this.sprite = scene.add.sprite(data.x, data.y, 'circle');
    this.sprite.setTint(data.color);
    this.sprite.setDepth(2);
    if (!isLocal) this.sprite.setAlpha(0.92);

    if (isLocal) {
      this.ring = scene.add.graphics();
      this.ring.setDepth(1);
      this.drawRing(data.x, data.y);
    }

    this.label = scene.add
      .text(data.x, data.y - LABEL_OFFSET_Y, data.name, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '13px',
        fontStyle: isLocal ? '700' : '500',
        color: isLocal ? '#ffffff' : '#e6eaf2',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(3);

    this.hpBar = scene.add.graphics();
    this.hpBar.setDepth(3);
    this.drawHpBar(data.x, data.y);
  }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
    this.label.setPosition(x, y - LABEL_OFFSET_Y);
    this.drawHpBar(x, y);
    if (this.ring) this.drawRing(x, y);
  }

  setHp(hp: number): void {
    this.hp = Math.max(0, Math.min(this.maxHp, hp));
    this.drawHpBar(this.sprite.x, this.sprite.y);
  }

  setName(name: string): void {
    this.label.setText(name);
  }

  flash(): void {
    this.flashTween?.stop();
    this.sprite.setTint(0xffffff);
    this.flashTween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 180,
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 1;
        const blended = blendColors(0xffffff, this.color, t);
        this.sprite.setTint(blended);
      },
      onComplete: () => {
        this.sprite.setTint(this.color);
      },
    });
  }

  setVisible(visible: boolean): void {
    this.sprite.setVisible(visible);
    this.label.setVisible(visible);
    this.hpBar.setVisible(visible);
    if (this.ring) this.ring.setVisible(visible);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  destroy(): void {
    this.flashTween?.stop();
    this.sprite.destroy();
    this.label.destroy();
    this.hpBar.destroy();
    this.ring?.destroy();
  }

  private drawHpBar(x: number, y: number): void {
    const g = this.hpBar;
    g.clear();
    const w = HPBAR_WIDTH;
    const h = HPBAR_HEIGHT;
    const left = x - w / 2;
    const top = y - HPBAR_OFFSET_Y;
    const ratio = this.maxHp > 0 ? this.hp / this.maxHp : 0;

    g.fillStyle(0x000000, 0.55);
    g.fillRoundedRect(left - 1, top - 1, w + 2, h + 2, 2);

    g.fillStyle(0x1c2540, 1);
    g.fillRoundedRect(left, top, w, h, 1.5);

    const fillW = Math.max(0, Math.round(w * ratio));
    if (fillW > 0) {
      const fillColor = hpColorAt(ratio);
      g.fillStyle(fillColor, 1);
      g.fillRoundedRect(left, top, fillW, h, 1.5);
    }
  }

  private drawRing(x: number, y: number): void {
    const g = this.ring!;
    g.clear();
    g.lineStyle(2.5, 0xffffff, 0.9);
    g.strokeCircle(x, y, PLAYER_RADIUS + 3);
  }
}

function hpColorAt(ratio: number): number {
  // Green > yellow > red.
  if (ratio > 0.6) return 0x67e08a;
  if (ratio > 0.3) return 0xf2c94c;
  return 0xff6b6b;
}

function blendColors(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
