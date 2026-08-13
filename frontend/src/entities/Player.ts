import Phaser from 'phaser';

export class Player extends Phaser.GameObjects.Arc {
    declare body: Phaser.Physics.Arcade.Body;

    constructor(scene: Phaser.Scene, x: number, y: number, color: number) {
        super(scene, x, y, 15, 0, 360, false, color);
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.body.setCircle(15);
        this.body.setCollideWorldBounds(true);
    }

    moveToward(targetX: number, targetY: number, speed: number) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 1) {
            this.body.setVelocity(0, 0);
            return;
        }

        const dirX = dx / distance;
        const dirY = dy / distance;
        this.body.setVelocity(dirX * speed, dirY * speed);
    }
}