import Phaser from 'phaser';
import { GameScene } from './GameScene';

const VIEWPORT_W = 1280;
const VIEWPORT_H = 720;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: VIEWPORT_W,
  height: VIEWPORT_H,
  backgroundColor: '#0b1023',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
  scene: [GameScene],
};

new Phaser.Game(config);
