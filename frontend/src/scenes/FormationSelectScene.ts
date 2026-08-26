import Phaser from 'phaser';

export class FormationSelectScene extends Phaser.Scene {
    constructor() {
        super('FormationSelectScene');
    }

    async create() {
        type FormationDoc = {
            _id: string;
            name: string;
            slots: { x: number; y: number }[];
        };

        const loadingText = this.add.text(400, 300, 'Loading...', { fontSize: '28px', color: '#ffffff' }).setOrigin(0.5);

        const response = await fetch("http://127.0.0.1:8000/formations");
        const formations: FormationDoc[] = await response.json();

        loadingText.destroy();

        this.add.text(400, 60, 'Choose a Formation', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5, 0);

        formations.forEach((formation, index) => {
            const y = 150 + index * 50;
            const label = this.add.text(400, y, formation.name, { fontSize: '28px', color: '#ffffff' }).setOrigin(0.5, 0);
            label.setInteractive({ useHandCursor: true });
            label.on('pointerdown', () => {
                this.scene.start('DraftScene', { formation: formation.slots });
            });
        });
    }
}