import Phaser from 'phaser';
import { API_URL } from '../config';
import { validateFormations } from '../data/validateApi';
import { fetchValidated } from '../data/fetchApi';

export class FormationSelectScene extends Phaser.Scene {
    constructor() { super('FormationSelectScene'); }

    async create() {
        const loading = this.add.text(400, 300, 'Loading...', {
            fontSize: '28px', color: '#ffffff'
        }).setOrigin(0.5);
        const controller = new AbortController();
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => controller.abort());

        try {
            const formations = await fetchValidated(`${API_URL}/formations`, validateFormations, controller.signal);
            if (!this.scene.isActive()) return;

            loading.destroy();
            this.add.text(400, 60, 'Choose a Formation', {
                fontSize: '32px', color: '#ffffff'
            }).setOrigin(0.5, 0);

            formations.forEach((formation, index) => {
                const label = this.add.text(400, 150 + index * 50, formation.name, {
                    fontSize: '28px', color: '#ffffff'
                }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
                label.on('pointerdown', () => {
                    this.scene.start('DraftScene', { formation: formation.slots });
                });
            });
        } catch (error) {
            if (!this.scene.isActive() || controller.signal.aborted) return;
            console.error('Failed to load formations:', error);
            loading.setText('Failed to load formations');
            this.add.text(400, 360, 'Retry', {
                fontSize: '24px', color: '#ffff00'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true })
              .on('pointerdown', () => this.scene.restart());
        }
    }
}
