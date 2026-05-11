import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';

interface PlayerData {
  id: string;
  x: number;
  y: number;
  color: number;
}

const SPEED = 200;
const PLAYER_SIZE = 32;

export class GameScene extends Phaser.Scene {
  private socket!: Socket;
  private localPlayer!: Phaser.Physics.Arcade.Image;
  private otherPlayers!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private lastX = 0;
  private lastY = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Generate a simple square texture at runtime — no external assets needed
    const gfx = this.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(0xffffff);
    gfx.fillRect(0, 0, PLAYER_SIZE, PLAYER_SIZE);
    gfx.generateTexture('player', PLAYER_SIZE, PLAYER_SIZE);
    gfx.destroy();
  }

  create() {
    this.otherPlayers = this.physics.add.group();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    this.socket = io('http://localhost:3000');

    this.socket.on('currentPlayers', (players: Record<string, PlayerData>) => {
      Object.values(players).forEach((player) => {
        if (player.id === this.socket.id) {
          this.addLocalPlayer(player);
        } else {
          this.addOtherPlayer(player);
        }
      });
    });

    this.socket.on('newPlayer', (player: PlayerData) => {
      this.addOtherPlayer(player);
    });

    this.socket.on('playerMoved', (player: PlayerData) => {
      this.otherPlayers.getChildren().forEach((child) => {
        const sprite = child as Phaser.Physics.Arcade.Image;
        if (sprite.name === player.id) {
          sprite.setPosition(player.x, player.y);
        }
      });
    });

    this.socket.on('userDisconnected', (id: string) => {
      this.otherPlayers.getChildren().forEach((child) => {
        const sprite = child as Phaser.Physics.Arcade.Image;
        if (sprite.name === id) {
          sprite.destroy();
        }
      });
    });
  }

  private addLocalPlayer(player: PlayerData) {
    this.localPlayer = this.physics.add.image(player.x, player.y, 'player');
    this.localPlayer.setTint(player.color);
    this.localPlayer.setCollideWorldBounds(true);
    this.lastX = player.x;
    this.lastY = player.y;
  }

  private addOtherPlayer(player: PlayerData) {
    const sprite = this.physics.add.image(player.x, player.y, 'player');
    sprite.setTint(player.color);
    sprite.setName(player.id);
    sprite.setAlpha(0.8);
    this.otherPlayers.add(sprite);
  }

  update() {
    if (!this.localPlayer) return;

    const body = this.localPlayer.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    const left = this.cursors.left.isDown || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;
    const up = this.cursors.up.isDown || this.wasd.up.isDown;
    const down = this.cursors.down.isDown || this.wasd.down.isDown;

    if (left) body.setVelocityX(-SPEED);
    else if (right) body.setVelocityX(SPEED);

    if (up) body.setVelocityY(-SPEED);
    else if (down) body.setVelocityY(SPEED);

    // Normalize diagonal movement
    if ((left || right) && (up || down)) {
      body.velocity.normalize().scale(SPEED);
    }

    const x = Math.round(this.localPlayer.x);
    const y = Math.round(this.localPlayer.y);

    if (x !== this.lastX || y !== this.lastY) {
      this.lastX = x;
      this.lastY = y;
      this.socket.emit('playerMovement', { x, y });
    }
  }
}
