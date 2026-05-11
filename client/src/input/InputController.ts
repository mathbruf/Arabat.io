import Phaser from 'phaser';

export type ShootDir = { x: -1 | 0 | 1; y: -1 | 0 | 1 };

export class InputController {
  private wasd: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private arrows: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    this.wasd = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.arrows = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    };
  }

  getMoveDirection(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.wasd.left.isDown) x -= 1;
    if (this.wasd.right.isDown) x += 1;
    if (this.wasd.up.isDown) y -= 1;
    if (this.wasd.down.isDown) y += 1;
    const len = Math.hypot(x, y);
    if (len > 0) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  // Cardinal only; arbitrary precedence if multiple arrows are held.
  getShootDirection(): ShootDir | null {
    if (this.arrows.up.isDown) return { x: 0, y: -1 };
    if (this.arrows.down.isDown) return { x: 0, y: 1 };
    if (this.arrows.left.isDown) return { x: -1, y: 0 };
    if (this.arrows.right.isDown) return { x: 1, y: 0 };
    return null;
  }
}
