import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { WORLD_WIDTH, WORLD_HEIGHT } from './constants';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
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
