import Phaser from 'phaser';
import { Player } from './entities/Player';
import { ONE_TWO_ONE, formationToWorldPositions, type Formation } from './data/formations';
import { FormationSelectScene } from './scenes/FormationSelectScene';
import { DraftScene } from './scenes/DraftScene';
import type { RosterPlayer } from './data/roster';


type PhysicsCircle = Phaser.GameObjects.Arc & { body: Phaser.Physics.Arcade.Body };

class MainScene extends Phaser.Scene {
  // class fields — declared here, assigned in create()
  private player!: Player;
  private team: Player[] = [];
  private opponents: Player[] = [];
  private ball!: PhysicsCircle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private facing = { x: 0, y: 1 };
  private score = { leftNet: 0, rightNet: 0 };
  private scoreText!: Phaser.GameObjects.Text;
  private timeRemaining = 120; // seconds — a 2 minute match
  private timerText!: Phaser.GameObjects.Text;
  private matchOver = false;
  private chosenFormation: Formation = ONE_TWO_ONE;
  private squad: RosterPlayer[] = [];

  constructor() {
    super('MainScene'); // scene key — Phaser identifies scenes by string key
  }

  preload() {
    // empty for now, same as before
  }

  init(data: { formation?: Formation; squad?: RosterPlayer[] }) {
    if (data.formation) {
      this.chosenFormation = data.formation;
    }
    if (data.squad) {
      this.squad = data.squad;
    }
  }

  private createGoalZone(x: number, width: number, height: number, onGoal: () => void) {
    const zone = this.add.rectangle(x, 300, width, height, 0x0000ff, 0);
    this.physics.add.existing(zone, true);
    this.physics.add.overlap(this.ball, zone, onGoal);
  }

  private updateScoreText() {
    this.scoreText.setText(`${this.score.leftNet} - ${this.score.rightNet}`);
  }

  private resetKickoff() {
    this.ball.setPosition(600, 300);
    this.ball.body.setVelocity(0, 0);
    this.player.setPosition(600, 300);
    this.player.body.setVelocity(0, 0);
  }

  private createWall(x: number, y: number, width: number, height: number) {
    const wall = this.add.rectangle(x, y, width, height, 0xff0000, 0); // alpha 0 = invisible
    this.physics.add.existing(wall, true); // true = static body, never moves
    this.physics.add.collider(this.ball, wall);
  }

  private updateControlledPlayer() {
    let nearest = this.team[0];
    let nearestDist = Phaser.Math.Distance.Between(nearest.x, nearest.y, this.ball.x, this.ball.y);

    for (const teammate of this.team) {
      const dist = Phaser.Math.Distance.Between(teammate.x, teammate.y, this.ball.x, this.ball.y);
      if (dist < nearestDist) {
        nearest = teammate;
        nearestDist = dist;
      }
    }

    if (nearest !== this.player) {
      this.player.body.setVelocity(0, 0);
      this.player = nearest;
    }
  }



  private endMatch() {
    this.player.body.setVelocity(0, 0);
    this.ball.body.setVelocity(0, 0);
    for (const opponent of this.opponents) {
      opponent.body.setVelocity(0, 0);
    }

    let resultText: string;

    if (this.score.leftNet > this.score.rightNet) {
      resultText = 'You Lose!';
    } else if (this.score.rightNet > this.score.leftNet) {
      resultText = 'You Win!';
    } else {
      resultText = 'Draw!';
    }

    const banner = this.add.text(400, 300, `${resultText}\nFinal Score: ${this.score.leftNet} - ${this.score.rightNet}`, {
      fontSize: '48px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5, 0.5);
    banner.setScrollFactor(0);
  }

  create() {
    // Draw the pitch background — sized/centered to the new 1200x600 world (was 800x600)
    this.add.rectangle(600, 300, 1200, 600, 0x2e7d32);

    // Physics objects (player, ball) can't move past these bounds
    this.physics.world.setBounds(0, 0, 1200, 600);

    // Camera can't scroll past these bounds either — keeps the view locked to the pitch
    this.cameras.main.setBounds(0, 0, 1200, 600);

    // Team creation, with different players
    const startingPositions = formationToWorldPositions(this.chosenFormation, 'left');

    for (const pos of startingPositions) {
      this.team.push(new Player(this, pos.x, pos.y, 0xffffff));
    }

    this.player = this.team[0];

    const opponentPositions = formationToWorldPositions(ONE_TWO_ONE, 'right');

    for (const pos of opponentPositions) {
      this.opponents.push(new Player(this, pos.x, pos.y, 0xff0000));
    }

    // Create the ball: black circle with a bouncy, drag-slowed physics body
    this.ball = this.add.circle(600, 300, 10, 0x000000) as PhysicsCircle;
    this.physics.add.existing(this.ball);
    this.ball.body.setCircle(10);
    this.ball.body.setCollideWorldBounds(false);
    this.ball.body.setBounce(1);
    this.ball.body.setDamping(true);
    this.ball.body.setDrag(0.5);

    const wallThickness = 20;

    // Top and bottom sidelines — solid across the full pitch width, no gaps
    this.createWall(600, -wallThickness / 2, 1200, wallThickness);
    this.createWall(600, 600 + wallThickness / 2, 1200, wallThickness);

    // Left goal line — split in two, leaving a gap at the goal mouth (y 255–345)
    this.createWall(-wallThickness / 2, 127.5, wallThickness, 255);
    this.createWall(-wallThickness / 2, 472.5, wallThickness, 255);

    // Right goal line — same gap, mirrored to the other side
    this.createWall(1200 + wallThickness / 2, 127.5, wallThickness, 255);
    this.createWall(1200 + wallThickness / 2, 472.5, wallThickness, 255);

    this.createGoalZone(-40, 40, 100, () => {
      this.score.leftNet++;
      this.updateScoreText();
      this.resetKickoff();
    });
    this.createGoalZone(1240, 40, 100, () => {
      this.score.rightNet++;
      this.updateScoreText();
      this.resetKickoff();
    });

    // Create the score text, horizontally centered near top
    this.scoreText = this.add.text(400, 20, '0 - 0', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5, 0);
    this.scoreText.setScrollFactor(0);

    // Create timer text, similar to the score text
    this.timerText = this.add.text(400, 60, '2:00', { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5, 0);
    this.timerText.setScrollFactor(0);

    // Set up input: arrow keys for movement, spacebar for kicking
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Player and ball physically collide with each other
    this.physics.add.collider(this.team, this.ball);
    this.physics.add.collider(this.opponents, this.ball);

    // Camera follows the ball, easing toward it each frame instead of snapping instantly
    this.cameras.main.startFollow(this.ball, true, 0.08, 0.08);
  }

  update(_time: number, delta: number) {
    // Update the nearest player
    this.updateControlledPlayer();

    // Update time
    this.timeRemaining -= delta / 1000;
    if (this.timeRemaining < 0) {
      this.timeRemaining = 0;
    }

    if (this.timeRemaining === 0 && !this.matchOver) {
      this.matchOver = true;
      this.endMatch();
    }

    if (this.matchOver) {
      return;
    }

    const minutes = Math.floor(this.timeRemaining / 60);
    const seconds = Math.floor(this.timeRemaining % 60);
    this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`);

    // Movement and Direction (arrow keys)
    if (this.cursors.left.isDown) {
      this.player.body.setVelocityX(-200);
      this.facing.x = -1;
    } else if (this.cursors.right.isDown) {
      this.player.body.setVelocityX(200);
      this.facing.x = 1;
    } else {
      this.player.body.setVelocityX(0);
    }

    if (this.cursors.up.isDown) {
      this.player.body.setVelocityY(-200);
      this.facing.y = -1;
    } else if (this.cursors.down.isDown) {
      this.player.body.setVelocityY(200);
      this.facing.y = 1;
    } else {
      this.player.body.setVelocityY(0);
    }


    // Kicking Mechanic
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.ball.x, this.ball.y);
      const kickRange = 40;

      if (dist < kickRange) {
        const kickSpeed = 400;

        const magnitude = Math.sqrt(this.facing.x ** 2 + this.facing.y ** 2);
        const normalizedX = this.facing.x / magnitude;
        const normalizedY = this.facing.y / magnitude;

        this.ball.body.setVelocity(normalizedX * kickSpeed, normalizedY * kickSpeed);
      }
    }


    // Have opponents chase ball, and then kick whenever dist < kickRange
    const kickRange = 40;
    const kickSpeed = 400;

    for (const opponent of this.opponents) {
      opponent.moveToward(this.ball.x, this.ball.y, 150);

      const distToBall = Phaser.Math.Distance.Between(opponent.x, opponent.y, this.ball.x, this.ball.y);
      if (distToBall < kickRange) {
        const dx = 0 - this.ball.x;
        const dy = 300 - this.ball.y;
        const magnitude = Math.sqrt(dx * dx + dy * dy);
        this.ball.body.setVelocity((dx / magnitude) * kickSpeed, (dy / magnitude) * kickSpeed);
      }
    }
  }
}

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