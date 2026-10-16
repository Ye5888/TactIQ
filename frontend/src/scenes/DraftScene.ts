import Phaser from 'phaser';
import type { RosterPlayer } from '../data/roster';
import type { Formation } from '../data/formations';
import { API_URL } from '../config';
import { validateDraftPlayers } from '../data/validateApi';
import { fetchValidated } from '../data/fetchApi';

export class DraftScene extends Phaser.Scene {
    private formation!: Formation;
    private picks: RosterPlayer[] = [];

    constructor() { super('DraftScene'); }

    init(data: { formation: Formation }) {
        this.formation = data.formation;
        this.picks = [];
    }

    async create() {
        const loading = this.add.text(400, 300, 'Loading...', {
            fontSize: '28px', color: '#ffffff'
        }).setOrigin(0.5);
        const controller = new AbortController();
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => controller.abort());

        try {
            const players = await fetchValidated(`${API_URL}/draft/players`, validateDraftPlayers, controller.signal);
            if (!this.scene.isActive()) return;

            loading.destroy();
            players.forEach((candidate, index) => {
                const label = this.add.text(400, 100 + index * 40,
                    `${candidate.name}  (pace ${candidate.pace}, shot ${candidate.shot})`,
                    { fontSize: '20px', color: '#ffffff' }
                ).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

                label.on('pointerdown', () => {
                    if (this.picks.includes(candidate) || this.picks.length >= 5) return;
                    this.picks.push(candidate);
                    label.setColor('#888888').disableInteractive();

                    if (this.picks.length === 5) {
                        this.scene.start('MainScene', {
                            formation: this.formation,
                            squad: [...this.picks]
                        });
                    }
                });
            });
        } catch (error) {
            if (!this.scene.isActive() || controller.signal.aborted) return;
            console.error('Failed to load draft:', error);
            loading.setText('Failed to load players');
            this.add.text(400, 360, 'Retry', {
                fontSize: '24px', color: '#ffff00'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true })
              .on('pointerdown', () => this.scene.restart());
        }
    }
}
