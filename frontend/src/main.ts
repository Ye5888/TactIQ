import Phaser from 'phaser';


type PhysicsCircle = Phaser.GameObjects.Arc & { body: Phaser.Physics.Arcade.Body };

class MainScene extends Phaser.Scene {
  // class fields — declared here, assigned in create()
  private player!: PhysicsCircle;
  private ball!: PhysicsCircle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private facing = { x: 0, y: 1 };

constructor() {
  super('MainScene'); // scene key — Phaser identifies scenes by string key
}

preload() {
  // empty for now, same as before
}

create() {
  // Draw the pitch background — sized/centered to the new 1200x600 world (was 800x600)
  this.add.rectangle(600, 300, 1200, 600, 0x2e7d32);

  // Physics objects (player, ball) can't move past these bounds
  this.physics.world.setBounds(0, 0, 1200, 600);

  // Camera can't scroll past these bounds either — keeps the view locked to the pitch
  this.cameras.main.setBounds(0, 0, 1200, 600);

  // Create the player: white circle with a physics body, spawned at the new world center
  this.player = this.add.circle(600, 300, 15, 0xffffff) as PhysicsCircle;
  this.physics.add.existing(this.player);
  this.player.body.setCircle(15);
  this.player.body.setCollideWorldBounds(true);

  // Create the ball: black circle with a bouncy, drag-slowed physics body
  this.ball = this.add.circle(600, 300, 10, 0x000000) as PhysicsCircle;
  this.physics.add.existing(this.ball);
  this.ball.body.setCircle(10);
  this.ball.body.setCollideWorldBounds(true);
  this.ball.body.setBounce(1);
  this.ball.body.setDamping(true);
  this.ball.body.setDrag(0.5);

  // Set up input: arrow keys for movement, spacebar for kicking
  this.cursors = this.input.keyboard!.createCursorKeys();
  this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

  // Player and ball physically collide with each other
  this.physics.add.collider(this.player, this.ball);

  // Camera follows the ball, easing toward it each frame instead of snapping instantly
  this.cameras.main.startFollow(this.ball, true, 0.08, 0.08);
}

update() {
  // same body as your current update(), moved in here.
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
  scene: MainScene // pass the class itself, not an object of functions
};

new Phaser.Game(config); // not assigning to an unused variable fixes TS6133