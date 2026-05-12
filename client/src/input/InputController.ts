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
    // enableCapture=false: don't preventDefault on the DOM event, so the menu's
    // <input> can receive WASD/arrows as text when it has focus.
    const addKey = (code: number) => kb.addKey(code, false);
    this.wasd = {
      up: addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.arrows = {
      up: addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left: addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
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

  getShootDirection(): ShootDir | null {
    const x = (this.arrows.right.isDown ? 1 : 0) - (this.arrows.left.isDown ? 1 : 0);
    const y = (this.arrows.down.isDown ? 1 : 0) - (this.arrows.up.isDown ? 1 : 0);
    if (x === 0 && y === 0) return null;
    return { x: x as -1 | 0 | 1, y: y as -1 | 0 | 1 };
  }
}
