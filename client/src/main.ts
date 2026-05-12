import Phaser from 'phaser';
import { GameScene } from './GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#0b1023',
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
  scene: [GameScene],
};

new Phaser.Game(config);
