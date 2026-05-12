import type { UpgradeType } from '../types';

const XP_PER_KILL = 100;

function xpToNextLevel(level: number): number {
  return Math.floor(XP_PER_KILL * Math.pow(1.5, level - 1));
}

export class XpHUD {
  private wrap: HTMLElement;
  private levelEl: HTMLElement;
  private fillEl: HTMLElement;
  private labelEl: HTMLElement;
  private overlay: HTMLElement;
  private levelNumEl: HTMLElement;

  private xp = 0;
  private level = 1;
  private pendingLevelUps = 0;
  private onUpgrade: (type: UpgradeType) => void;

  private keyHandler: (e: KeyboardEvent) => void;

  constructor(onUpgrade: (type: UpgradeType) => void) {
    this.onUpgrade = onUpgrade;
    this.wrap = get('xp-bar-wrap');
    this.levelEl = get('xp-level');
    this.fillEl = get('xp-fill');
    this.labelEl = get('xp-label');
    this.overlay = get('upgrade-overlay');
    this.levelNumEl = get('upg-level-num');

    this.keyHandler = (e: KeyboardEvent) => {
      if (this.overlay.hidden) return;
      if (e.key === '1') { e.preventDefault(); this.choose('health'); }
      else if (e.key === '2') { e.preventDefault(); this.choose('damage'); }
      else if (e.key === '3') { e.preventDefault(); this.choose('speed'); }
    };
    document.addEventListener('keydown', this.keyHandler);

    get('upg-btn-1').addEventListener('click', () => this.choose('health'));
    get('upg-btn-2').addEventListener('click', () => this.choose('damage'));
    get('upg-btn-3').addEventListener('click', () => this.choose('speed'));
  }

  show(): void {
    this.wrap.hidden = false;
    this.refresh();
  }

  hide(): void {
    this.wrap.hidden = true;
    this.overlay.hidden = true;
  }

  reset(): void {
    this.xp = 0;
    this.level = 1;
    this.pendingLevelUps = 0;
    this.overlay.hidden = true;
    this.refresh();
  }

  onKill(): void {
    this.xp += XP_PER_KILL;
    let needed = xpToNextLevel(this.level);
    while (this.xp >= needed) {
      this.xp -= needed;
      this.level++;
      this.pendingLevelUps++;
      needed = xpToNextLevel(this.level);
    }
    this.refresh();
    if (this.pendingLevelUps > 0 && this.overlay.hidden) {
      this.showNextUpgrade();
    }
  }

  private showNextUpgrade(): void {
    this.levelNumEl.textContent = String(this.level);
    this.overlay.hidden = false;
  }

  private choose(type: UpgradeType): void {
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
    this.overlay.hidden = true;
    this.onUpgrade(type);
    this.refresh();
    if (this.pendingLevelUps > 0) {
      setTimeout(() => {
        if (this.pendingLevelUps > 0) this.showNextUpgrade();
      }, 350);
    }
  }

  private refresh(): void {
    const needed = xpToNextLevel(this.level);
    const ratio = needed > 0 ? Math.min(1, this.xp / needed) : 1;
    this.levelEl.textContent = `Lvl ${this.level}`;
    this.fillEl.style.width = `${ratio * 100}%`;
    this.labelEl.textContent = `${this.xp} / ${needed} XP`;
  }
}

function get(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}
