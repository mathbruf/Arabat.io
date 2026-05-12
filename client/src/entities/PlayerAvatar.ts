import Phaser from 'phaser';
import { PlayerData } from '../types';

export const PLAYER_RADIUS = 16;
const LABEL_OFFSET_Y = 36;
const HPBAR_OFFSET_Y = 22;
const HPBAR_WIDTH = 36;
const HPBAR_HEIGHT = 5;
const SPRITE_SCALE = 0.75;


const FRAMES = [
  'survivor1_gun.png',
  'hitman1_gun.png',
  'manBlue_gun.png',
  'manBrown_gun.png',
  'manOld_gun.png',
  'robot1_gun.png',
  'soldier1_gun.png',
  'womanGreen_gun.png',
  'zombie1_gun.png',
];

function frameForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return FRAMES[Math.abs(h) % FRAMES.length];
}

export class PlayerAvatar {
  readonly id: string;
  private scene: Phaser.Scene;
  private readonly _color: number;
  private readonly isLocal: boolean;
  private sprite: Phaser.GameObjects.Sprite;
  private ring: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private hpBar: Phaser.GameObjects.Graphics;
  private hp: number;
  private maxHp: number;
  private flashTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, data: PlayerData, isLocal: boolean) {
    this.id = data.id;
    this.scene = scene;
    this._color = data.color;
    this.isLocal = isLocal;
    this.hp = data.hp;
    this.maxHp = data.maxHp;

    const frame = isLocal ? 'survivor1_gun.png' : frameForId(data.id);
    this.sprite = scene.add.sprite(data.x, data.y, 'characters', frame);
    this.sprite.setScale(SPRITE_SCALE);
    this.sprite.setDepth(2);
    if (!isLocal) this.sprite.setAlpha(0.92);

    this.ring = scene.add.graphics();
    this.ring.setDepth(1);
    this.redrawRing(data.x, data.y);

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
    this.ring.clear();
    this.redrawRing(x, y);
  }

  /** dx/dy: any direction vector; rotates sprite to face that direction. */
  setFacing(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;
    this.sprite.setRotation(Math.atan2(dy, dx));
  }

  setHp(hp: number): void {
    this.hp = Math.max(0, Math.min(this.maxHp, hp));
    this.drawHpBar(this.sprite.x, this.sprite.y);
  }

  setStats(hp: number, maxHp: number): void {
    this.maxHp = maxHp;
    this.hp = Math.max(0, Math.min(maxHp, hp));
    this.drawHpBar(this.sprite.x, this.sprite.y);
  }

  setName(name: string): void {
    this.label.setText(name);
  }

  dashFlash(): void {
    this.sprite.setScale(SPRITE_SCALE * 1.35);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: SPRITE_SCALE,
      scaleY: SPRITE_SCALE,
      duration: 180,
      ease: 'Power2',
    });
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
        // Fade white tint back to no tint by blending toward pure white then clearing
        const alpha = 1 - t;
        this.sprite.setAlpha(this.isLocal ? 1 : 0.92 + 0.08 * (1 - alpha));
      },
      onComplete: () => {
        this.sprite.clearTint();
        this.sprite.setAlpha(this.isLocal ? 1 : 0.92);
      },
    });
  }

  setVisible(visible: boolean): void {
    this.sprite.setVisible(visible);
    this.label.setVisible(visible);
    this.hpBar.setVisible(visible);
    this.ring.setVisible(visible);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
  get color(): number { return this._color; }
  getSprite(): Phaser.GameObjects.Sprite { return this.sprite; }

  destroy(): void {
    this.flashTween?.stop();
    this.sprite.destroy();
    this.label.destroy();
    this.hpBar.destroy();
    this.ring.destroy();
  }

  private redrawRing(x: number, y: number): void {
    const g = this.ring;
    if (this.isLocal) {
      g.lineStyle(2.5, 0xffffff, 0.9);
      g.strokeCircle(x, y, PLAYER_RADIUS + 4);
    } else {
      g.lineStyle(2, this._color, 0.8);
      g.strokeCircle(x, y, PLAYER_RADIUS + 2);
    }
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
      g.fillStyle(hpColorAt(ratio), 1);
      g.fillRoundedRect(left, top, fillW, h, 1.5);
    }
  }
}

function hpColorAt(ratio: number): number {
  if (ratio > 0.6) return 0x67e08a;
  if (ratio > 0.3) return 0xf2c94c;
  return 0xff6b6b;
}
