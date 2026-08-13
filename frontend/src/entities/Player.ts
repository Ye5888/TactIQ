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
}