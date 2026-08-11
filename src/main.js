import Phaser from 'phaser';

let player;
let ball;
let facing = { x: 0, y: 1 };
let spaceKey;
let cursors;

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'app',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  }
}

const game = new Phaser.Game(config);

function preload() {

}

function create() {
  this.add.rectangle(400, 300, 800, 600, 0x2e7d32);

  player = this.add.circle(400, 300, 15, 0xffffff);
  this.physics.add.existing(player);
  player.body.setCircle(15);
  player.body.setCollideWorldBounds(true);

  ball = this.add.circle(400, 300, 10, 0x000000);
  this.physics.add.existing(ball);
  ball.body.setCircle(10);
  ball.body.setCollideWorldBounds(true);
  ball.body.setBounce(1);
  ball.body.setDamping(true);
  ball.body.setDrag(0.5);

  cursors = this.input.keyboard.createCursorKeys();
  spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

  this.physics.add.collider(player, ball);
}

function update() {

  if (cursors.left.isDown) {
    player.body.setVelocityX(-200);
    facing.x = -1;
  } else if (cursors.right.isDown) {
    player.body.setVelocityX(200);
    facing.x = 1;
  } else {
    player.body.setVelocityX(0);
  }

  if (cursors.up.isDown) {
    player.body.setVelocityY(-200);
    facing.y = -1;
  } else if (cursors.down.isDown) {
    player.body.setVelocityY(200);
    facing.y = 1;
  } else {
    player.body.setVelocityY(0);
  }

  if (Phaser.Input.Keyboard.JustDown(spaceKey)) {
    const dist = Phaser.Math.Distance.Between(player.x, player.y, ball.x, ball.y);
    const kickRange = 40;

    if (dist < kickRange) {
      const kickSpeed = 400;

      const magnitude = Math.sqrt(facing.x ** 2 + facing.y ** 2);
      const normalizedX = facing.x / magnitude;
      const normalizedY = facing.y / magnitude;

      ball.body.setVelocity(normalizedX * kickSpeed, normalizedY * kickSpeed);
    }
  }
}

