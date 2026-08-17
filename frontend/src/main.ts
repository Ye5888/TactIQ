import Phaser from 'phaser';
import { Player } from './entities/Player';
import { ONE_TWO_ONE, formationToWorldPositions, type Formation } from './data/formations';
import { FormationSelectScene } from './scenes/FormationSelectScene';
import { DraftScene } from './scenes/DraftScene';
import { MainScene } from './scenes/MainScene';
import type { RosterPlayer } from './data/roster';


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