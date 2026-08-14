import Phaser from 'phaser';
import { ROSTER, type RosterPlayer } from '../data/roster';
import { Formation } from '../data/formations';

export class DraftScene extends Phaser.Scene {
    private formation!: Formation;
    private picks: RosterPlayer[] = [];

    constructor() {
        super('DraftScene');
    }

    init(data: { formation: Formation }) {
        this.formation = data.formation
    }

    create() {
        this.add.text(400, 40, 'Draft Your Squad (pick 5)', { fontSize: '28px', color: '#ffffff' }).setOrigin(0.5, 0);

        ROSTER.forEach((candidate, index) => {
            const y = 100 + index * 40;
            const label = this.add.text(400, y, `${candidate.name}  (pace ${candidate.pace}, shot ${candidate.shot})`, {
                fontSize: '20px',
                color: '#ffffff',
            }).setOrigin(0.5, 0);

            label.setInteractive({ useHandCursor: true });
            label.on('pointerdown', () => {
                if (this.picks.includes(candidate)) {
                    return;
                }

                this.picks.push(candidate);
                label.setColor('#888888');
                label.disableInteractive();

                if (this.picks.length === 5) {
                    this.scene.start('MainScene', { formation: this.formation, squad: this.picks });
                }
            });
        });
    }
}