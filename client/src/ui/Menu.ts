const NAME_MAX_LEN = 16;
const STORAGE_KEY = 'arabat.lastName';

export type MenuMode = 'intro' | 'death';

export interface MenuDeathContext {
  killerName: string | null;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  kills: number;
}

export class Menu {
  private overlay: HTMLDivElement;
  private subEl: HTMLDivElement;
  private input: HTMLInputElement;
  private button: HTMLButtonElement;
  private errorEl: HTMLDivElement;
  private hud: HTMLDivElement;
  private hudCount: HTMLElement;
  private connBanner: HTMLDivElement;
  private leaderboard: HTMLDivElement;
  private leaderboardRows: HTMLDivElement;

  constructor(private onSubmit: (name: string) => void) {
    this.overlay = mustGet<HTMLDivElement>('menu-overlay');
    this.subEl = mustGet<HTMLDivElement>('menu-sub');
    this.input = mustGet<HTMLInputElement>('name-input');
    this.button = mustGet<HTMLButtonElement>('play-button');
    this.errorEl = mustGet<HTMLDivElement>('menu-error');
    this.hud = mustGet<HTMLDivElement>('hud');
    this.hudCount = mustGet<HTMLElement>('hud-count');
    this.connBanner = mustGet<HTMLDivElement>('conn-banner');
    this.leaderboard = mustGet<HTMLDivElement>('leaderboard');
    this.leaderboardRows = mustGet<HTMLDivElement>('leaderboard-rows');

    this.button.addEventListener('click', () => this.submit());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submit();
      }
    });
    this.input.addEventListener('input', () => this.clearError());

    const saved = readStored();
    if (saved) this.input.value = saved;
  }

  show(mode: MenuMode, ctx?: MenuDeathContext): void {
    if (mode === 'intro') {
      this.subEl.classList.remove('death');
      this.subEl.textContent = 'Enter your name to drop into the arena.';
      this.button.textContent = 'Play';
    } else {
      this.subEl.classList.add('death');
      const killer = ctx?.killerName ? ` by <strong>${escapeHtml(ctx.killerName)}</strong>` : '';
      this.subEl.innerHTML = `You were eliminated${killer}.`;
      this.button.textContent = 'Respawn';
    }
    this.overlay.hidden = false;
    this.hud.hidden = true;
    this.leaderboard.hidden = true;
    this.clearError();
    requestAnimationFrame(() => {
      this.input.focus();
      this.input.select();
    });
  }

  hide(): void {
    this.overlay.hidden = true;
    this.hud.hidden = false;
    this.leaderboard.hidden = false;
  }

  setLeaderboard(entries: LeaderboardEntry[], selfId: string | undefined): void {
    if (entries.length === 0) {
      this.leaderboardRows.innerHTML = '<div class="lb-empty">No players yet.</div>';
      return;
    }
    const max = Math.min(8, entries.length);
    let html = '';
    for (let i = 0; i < max; i++) {
      const e = entries[i];
      const isSelf = e.id === selfId;
      html += `<div class="lb-row${isSelf ? ' lb-self' : ''}">`;
      html += `<span class="lb-rank">${i + 1}.</span>`;
      html += `<span class="lb-name">${escapeHtml(e.name)}</span>`;
      html += `<span class="lb-kills">${e.kills}</span>`;
      html += `</div>`;
    }
    this.leaderboardRows.innerHTML = html;
  }

  setError(msg: string): void {
    this.errorEl.textContent = msg;
  }

  clearError(): void {
    this.errorEl.textContent = '';
  }

  setPlayerCount(n: number): void {
    this.hudCount.textContent = String(n);
  }

  setConnected(connected: boolean): void {
    this.connBanner.hidden = connected;
  }

  setBusy(busy: boolean): void {
    this.button.disabled = busy;
  }

  private submit(): void {
    const name = this.input.value.trim().slice(0, NAME_MAX_LEN);
    if (name.length === 0) {
      this.setError('Name cannot be empty.');
      this.input.focus();
      return;
    }
    writeStored(name);
    this.setBusy(true);
    this.onSubmit(name);
  }

  resetBusy(): void {
    this.setBusy(false);
  }
}

function mustGet<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing DOM element: #${id}`);
  return el as T;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // ignore (e.g., private mode)
  }
}
