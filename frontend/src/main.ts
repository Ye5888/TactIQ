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
  this.player = this.add.circle(400, 300, 15, 0xffffff) as PhysicsCircle;
  this.physics.add.existing(this.player);
  this.player.body.setCircle(15);
  this.player.body.setCollideWorldBounds(true);

  this.ball = this.add.circle(400, 300, 10, 0x000000) as PhysicsCircle;
  this.physics.add.existing(this.ball);
  this.ball.body.setCircle(10);
  this.ball.body.setCollideWorldBounds(true);
  this.ball.body.setBounce(1);
  this.ball.body.setDamping(true);
  this.ball.body.setDrag(0.5);

  this.cursors = this.input.keyboard!.createCursorKeys();
  this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

  this.physics.add.collider(this.player, this.ball);
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