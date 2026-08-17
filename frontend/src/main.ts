import Phaser from 'phaser';
import { FormationSelectScene } from './scenes/FormationSelectScene';
import { DraftScene } from './scenes/DraftScene';
import { MainScene } from './scenes/MainScene';


const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'app',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 }, // fixes the Vector2Like error
      debug: false
    }
  },
  scene: [FormationSelectScene, DraftScene, MainScene] // pass the class itself, not an object of functions
};

new Phaser.Game(config); // not assigning to an unused variable fixes TS6133