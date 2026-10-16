import Phaser from 'phaser';
import { API_URL } from '../config';

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

        const loadingText = this.add.text(
            400, 300, 'Loading...',
            { fontSize: '28px', color: '#ffffff' }
        ).setOrigin(0.5);

        try {
            const response = await fetch(`${API_URL}/formations`);

            // fetch() doesn't automatically throw for HTTP errors.
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const formations: FormationDoc[] = await response.json();

            // Make sure we actually received usable formations.
            if (
                !Array.isArray(formations) ||
                formations.length === 0 ||
                !formations.every(f =>
                    typeof f.name === 'string' &&
                    Array.isArray(f.slots) &&
                    f.slots.length === 5 &&
                    f.slots.every(slot =>
                        Number.isFinite(slot.x) &&
                        Number.isFinite(slot.y)
                    )
                )
            ) {
                throw new Error('Invalid formation data');
            }

            loadingText.destroy();

            this.add.text(400, 60, 'Choose a Formation', {
                fontSize: '32px',
                color: '#ffffff'
            }).setOrigin(0.5, 0);

            formations.forEach((formation, index) => {
                const y = 150 + index * 50;

                const label = this.add.text(
                    400, y, formation.name,
                    { fontSize: '28px', color: '#ffffff' }
                ).setOrigin(0.5, 0);

                label.setInteractive({ useHandCursor: true });

                label.on('pointerdown', () => {
                    this.scene.start('DraftScene', {
                        formation: formation.slots
                    });
                });
            });

        } catch (error) {
            console.error('Failed to load formations:', error);

            loadingText.setText('Failed to load formations');

            const retry = this.add.text(400, 360, 'Retry', {
                fontSize: '24px',
                color: '#ffff00'
            }).setOrigin(0.5);

            retry.setInteractive({ useHandCursor: true });

            retry.on('pointerdown', () => {
                this.scene.restart();
            });
        }
    }

}