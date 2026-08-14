import Phaser from 'phaser';
import { FORMATIONS } from '../data/formations';

export class FormationSelectScene extends Phaser.Scene {
    constructor() {
        super('FormationSelectScene');
    }

    create() {
        this.add.text(400, 60, 'Choose a Formation', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5, 0);

        FORMATIONS.forEach((option, index) => {
            const y = 150 + index * 50;
            const label = this.add.text(400, y, option.name, { fontSize: '28px', color: '#ffffff' }).setOrigin(0.5, 0);
            label.setInteractive({ useHandCursor: true });
            label.on('pointerdown', () => {
                this.scene.start('DraftScene', { formation: option.formation });
            });
        });
    }
}