import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ONE_TWO_ONE, formationToWorldPositions, type Formation } from '../data/formations';
import type { RosterPlayer } from '../data/roster';
import { buildObservation } from '../rl/observation';
import { buildActionMask } from '../rl/actionMask';
import { predictActions } from '../rl/onnxPolicy';


type PhysicsCircle = Phaser.GameObjects.Arc & { body: Phaser.Physics.Arcade.Body };

export class MainScene extends Phaser.Scene {
    // class fields — declared here, assigned in create()
    private player!: Player;
    private team: Player[] = [];
    private opponents: Player[] = [];
    private ball!: PhysicsCircle;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private spaceKey!: Phaser.Input.Keyboard.Key;
    private score = { user: 0, rl: 0 };
    private scoreText!: Phaser.GameObjects.Text;
    private timeRemaining = 120; // seconds — a 2 minute match
    private timerText!: Phaser.GameObjects.Text;
    private matchOver = false;
    private chosenFormation: Formation = ONE_TWO_ONE;
    private squad: RosterPlayer[] = [];
    private nameLabels: Phaser.GameObjects.Text[] = [];
    private possessor: Player | null = null;

    private rlActions: number[] = [0, 0, 0, 0, 0];
    private lastRLDecisionTime = 0;
    private rlInferenceRunning = false;
    
    private readonly RL_DECISION_INTERVAL = 100; // milliseconds
    private readonly RL_SPEED = 150;
    private readonly KICK_SPEED = 400;
    private pendingPass: {
        receiverIndex: number;
    } | null = null;

    constructor() {
        super('MainScene'); // scene key — Phaser identifies scenes by string key
    }

    preload() {
        // empty for now, same as before
    }

    init(data: { formation?: Formation; squad?: RosterPlayer[] }) {
        if (data.formation) {
            this.chosenFormation = data.formation;
        }
        if (data.squad) {
            this.squad = data.squad;
        }
    }

    private createGoalZone(
        x: number,
        width: number,
        height: number,
        onGoal: () => void
    ) {
        const zone = this.add.rectangle(
            x,
            300,
            width,
            height,
            0x0000ff,
            0
        );

        this.physics.add.existing(zone, true);

        this.physics.add.overlap(this.ball, zone, () => {
            // Match the Python environment:
            // a possessed ball cannot score.
            if (this.possessor !== null) {
                return;
            }

            onGoal();
        });
    }

    private updateScoreText() {
        this.scoreText.setText(`${this.score.user} - ${this.score.rl}`);
    }

    private getRandomizedRLOpponentPositions() {
        const positions = formationToWorldPositions(
            ONE_TWO_ONE,
            'right'
        ).map(pos => ({
            x: pos.x,
            y: pos.y
        }));

        // Randomize which RL player gets each formation slot.
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(
                Math.random() * (i + 1)
            );

            [positions[i], positions[j]] =
                [positions[j], positions[i]];
        }

        // Match training-time ±75px starting-position jitter.
        return positions.map(pos => ({
            x: Phaser.Math.Clamp(
                pos.x + Phaser.Math.FloatBetween(-75, 75),
                0,
                1200
            ),
            y: Phaser.Math.Clamp(
                pos.y + Phaser.Math.FloatBetween(-75, 75),
                0,
                600
            )
        }));
    }

    private resetKickoff() {
        // Reset ball
        this.ball.setPosition(600, 300);
        this.ball.body.setVelocity(0, 0);
        this.possessor = null;
        this.pendingPass = null;

        // Reset user team to selected formation
        const userPositions = formationToWorldPositions(
            this.chosenFormation,
            'left'
        );

        for (let i = 0; i < this.team.length; i++) {
            this.team[i].setPosition(
                userPositions[i].x,
                userPositions[i].y
            );

            this.team[i].body.setVelocity(0, 0);

            // User attacks toward the right.
            this.team[i].facing = { x: 1, y: 0 };
        }

        // Reset RL team
        const opponentPositions = this.getRandomizedRLOpponentPositions();

        for (let i = 0; i < this.opponents.length; i++) {
            this.opponents[i].setPosition(
                opponentPositions[i].x,
                opponentPositions[i].y
            );

            this.opponents[i].body.setVelocity(0, 0);

            // RL attacks toward the left.
            this.opponents[i].facing = { x: -1, y: 0 };
        }

        // Give control back to the first user player.
        this.player = this.team[0];

        // Don't carry PPO actions over from before the goal.
        this.rlActions = [0, 0, 0, 0, 0];
    }

    private createWall(
        x: number,
        y: number,
        width: number,
        height: number
    ) {
        const wall = this.add.rectangle(
            x,
            y,
            width,
            height,
            0xff0000,
            0
        );

        this.physics.add.existing(wall, true);
        this.physics.add.collider(this.ball, wall);
    }

    private updateControlledPlayer() {
        let nearest = this.team[0];
        let nearestDist = Phaser.Math.Distance.Between(nearest.x, nearest.y, this.ball.x, this.ball.y);

        for (const teammate of this.team) {
            const dist = Phaser.Math.Distance.Between(teammate.x, teammate.y, this.ball.x, this.ball.y);
            if (dist < nearestDist) {
                nearest = teammate;
                nearestDist = dist;
            }
        }

        if (nearest !== this.player) {
            this.player.body.setVelocity(0, 0);
            this.player = nearest;
        }
    }

    private updatePossession() {
        if (this.possessor !== null) {
            return;
            // Ball is already taken, return. This will change later
        }

        const pickupRange = 20;
        const allPlayers = [...this.team, ...this.opponents];

        let closest: Player | null = null;
        let closestDist = Infinity;

        for (const candidate of allPlayers) {
            const dist = Phaser.Math.Distance.Between(candidate.x, candidate.y, this.ball.x, this.ball.y);
            if (dist < pickupRange && dist < closestDist) {
                closest = candidate;
                closestDist = dist;
            }
        }

        if (closest !== null) {
            this.possessor = closest;

            // The pass is over once anybody gains possession.
            if (this.pendingPass !== null) {
                this.pendingPass = null;
            }
        }
    }

    private enforceFreeBallBounds() {
        // Possessed ball is handled by updateBallFollow().
        if (this.possessor !== null) {
            return;
        }

        const inGoalMouth =
            this.ball.y >= 255 &&
            this.ball.y <= 345;

        // Top wall
        if (this.ball.y < 0) {
            this.ball.y = 0;

            if (this.ball.body.velocity.y < 0) {
                this.ball.body.setVelocityY(
            -this.ball.body.velocity.y
                );
            }
        }

        // Bottom wall
        if (this.ball.y > 600) {
            this.ball.y = 600;

            if (this.ball.body.velocity.y > 0) {
                this.ball.body.setVelocityY(
                    -this.ball.body.velocity.y
                );
            }
        }

        // Left/right walls should only be open at the goal mouth.
        if (!inGoalMouth) {
            if (this.ball.x < 0) {
                this.ball.x = 0;

                if (this.ball.body.velocity.x < 0) {
                    this.ball.body.setVelocityX(
                        -this.ball.body.velocity.x
                    );
                }
            }

            if (this.ball.x > 1200) {
                this.ball.x = 1200;

                if (this.ball.body.velocity.x > 0) {
                    this.ball.body.setVelocityX(
                        -this.ball.body.velocity.x
                    );
                }
            }
        }
    }

    private updateBallFollow() {
        if (this.possessor === null) {
            return;
        }

        const offset = 15;

        const attachedX =
            this.possessor.x +
            this.possessor.facing.x * offset;

        const attachedY =
            this.possessor.y +
            this.possessor.facing.y * offset;

        // Match the training environment:
        // a possessed ball stays inside the pitch.
        const clampedX = Phaser.Math.Clamp(
            attachedX,
            0,
            1200
        );

        const clampedY = Phaser.Math.Clamp(
            attachedY,
            0,
            600
        );

        this.ball.setPosition(
            clampedX,
            clampedY
        );

        this.ball.body.setVelocity(0, 0);
    }

    private createGoalOutline(side: 'left' | 'right') {
        const depth = 40;
        const height = 90;

        const x =
            side === 'left'
                ? -depth / 2
                : 1200 + depth / 2;

        this.add
            .rectangle(
                x,
                300,
                depth,
                height,
                0xffffff,
                0
            )
            .setStrokeStyle(4, 0xffffff);
    }

    private async updateRLPolicy(time: number) {
        // Only make a new decision every 100 ms.
        if (time - this.lastRLDecisionTime < this.RL_DECISION_INTERVAL) {
            return;
        }

        // Don't start another ONNX inference if one is still running.
        if (this.rlInferenceRunning) {
            return;
        }

        this.lastRLDecisionTime = time;
        this.rlInferenceRunning = true;

        try {
            const observation = buildObservation(
                this.team,
                this.opponents,
                this.ball,
                this.possessor,
                this.score.rl,
                this.score.user,
                this.timeRemaining
            );

            const actionMask = buildActionMask(
                this.opponents,
                this.possessor
            );

            this.rlActions = await predictActions(
                observation,
                actionMask
            );
        } catch (error) {
            console.error("RL inference failed:", error);
        } finally {
            this.rlInferenceRunning = false;
        }
    }

    private randomNormal(): number {
        // Box-Muller transform: standard normal distribution
        let u = 0;
        let v = 0;

        while (u === 0) {
            u = Math.random();
        }

        while (v === 0) {
            v = Math.random();
        }

        return (
            Math.sqrt(-2 * Math.log(u)) *
            Math.cos(2 * Math.PI * v)
        );
    }

    private applyRLPass(
        passer: Player,
        passerIndex: number,
        receiverIndex: number
    ) {
        passer.body.setVelocity(0, 0);

        // Only the player with the ball can pass.
        if (this.possessor !== passer) {
            return;
        }

        // Can't pass to yourself.
        if (receiverIndex === passerIndex) {
            return;
        }

        const receiver = this.opponents[receiverIndex];

        if (!receiver) {
            return;
        }

        this.pendingPass = {
            receiverIndex
        };

        // RL attacks LEFT, so lead the pass 60px toward the left goal.
        const targetX = Math.max(
            0,
            receiver.x - 60
        );

        const targetY = receiver.y;

        const dx = targetX - this.ball.x;
        const dy = targetY - this.ball.y;

        const magnitude = Math.sqrt(
            dx * dx + dy * dy
        );

        if (magnitude < 0.000001) {
            this.pendingPass = null;
            return;
        }

        // Release the ball.
        this.possessor = null;

        this.ball.body.setVelocity(
            (dx / magnitude) * this.KICK_SPEED,
            (dy / magnitude) * this.KICK_SPEED
        );

        // TEMP for testing.
        console.log(
            `RL PASS: ${passerIndex} -> ${receiverIndex}`
        );
    }

    private moveRLReceiverTowardBall(player: Player) {
        const dx = this.ball.x - player.x;
        const dy = this.ball.y - player.y;

        const magnitude = Math.sqrt(
            dx * dx + dy * dy
        );

        if (magnitude < 0.000001) {
            player.body.setVelocity(0, 0);
            return;
        }

        const dirX = dx / magnitude;
        const dirY = dy / magnitude;

        player.facing.x = dirX;
        player.facing.y = dirY;

        player.body.setVelocity(
            dirX * this.RL_SPEED,
            dirY * this.RL_SPEED
        );
    }

    private applyRLShoot(player: Player) {
        // Shooting means the player itself stops moving.
        player.body.setVelocity(0, 0);

        // Only the player currently possessing the ball can shoot.
        if (this.possessor !== player) {
            return;
        }

        // RL attacks the LEFT goal.
        const distanceFromGoal = player.x;

        // Same distance-based inaccuracy used during training.
        const shotErrorStd =
            10 + 0.08 * distanceFromGoal;

        const yError =
            this.randomNormal() * shotErrorStd;

        // Aim slightly beyond the left goal line.
        const targetX = -50;
        const targetY = 300 + yError;

        const dx = targetX - this.ball.x;
        const dy = targetY - this.ball.y;

        const magnitude = Math.sqrt(
            dx * dx + dy * dy
        );

        if (magnitude < 0.000001) {
            return;
        }

        this.pendingPass = null;

        // Release possession before kicking.
        this.possessor = null;

        this.ball.body.setVelocity(
            (dx / magnitude) * this.KICK_SPEED,
            (dy / magnitude) * this.KICK_SPEED
        );

        // TEMP: useful while testing.
        console.log(
            "RL SHOT",
            "from:",
            player.x,
            player.y,
            "target:",
            targetX,
            targetY
        );
    }

    private applyRLMovement(
        player: Player,
        action: number
    ) {
        let vx = 0;
        let vy = 0;

        switch (action) {
            case 1: // up
                vy = -this.RL_SPEED;
                break;

            case 2: // down
                vy = this.RL_SPEED;
                break;

            case 3: // left
                vx = -this.RL_SPEED;
                break;

            case 4: // right
                vx = this.RL_SPEED;
                break;

            case 5: // up-left
                vx = -this.RL_SPEED;
                vy = -this.RL_SPEED;
                break;

            case 6: // up-right
                vx = this.RL_SPEED;
                vy = -this.RL_SPEED;
                break;

            case 7: // down-left
                vx = -this.RL_SPEED;
                vy = this.RL_SPEED;
                break;

            case 8: // down-right
                vx = this.RL_SPEED;
                vy = this.RL_SPEED;
                break;

            // 0 = idle
            // 9-14 will be handled separately
        }

        // Python normalizes diagonal movement so it isn't faster.
        if (vx !== 0 && vy !== 0) {
            const scale = 1 / Math.sqrt(2);
            vx *= scale;
            vy *= scale;
        }

        if (vx !== 0 || vy !== 0) {
            const magnitude = Math.sqrt(vx * vx + vy * vy);

            player.facing.x = vx / magnitude;
            player.facing.y = vy / magnitude;
        }

        player.body.setVelocity(vx, vy);
    }

    private endMatch() {
        this.player.body.setVelocity(0, 0);
        this.ball.body.setVelocity(0, 0);
        for (const opponent of this.opponents) {
            opponent.body.setVelocity(0, 0);
        }

        let resultText: string;

        if (this.score.user > this.score.rl) {
            resultText = 'You Win!';
        } else if (this.score.rl > this.score.user) {
            resultText = 'You Lose!';
        } else {
            resultText = 'Draw!';
        }

        const banner = this.add.text(400, 300, `${resultText}\nFinal Score: ${this.score.user} - ${this.score.rl}`, {
            fontSize: '48px',
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5, 0.5);
        banner.setScrollFactor(0);
    }

    create() {
        // Draw the pitch background — sized/centered to the new 1200x600 world (was 800x600)
        this.add.rectangle(600, 300, 1200, 600, 0x2e7d32);

        // Physics objects (player, ball) can't move past these bounds
        this.physics.world.setBounds(0, 0, 1200, 600);

        // Camera can't scroll past these bounds either — keeps the view locked to the pitch
        this.cameras.main.setBounds(-60, 0, 1320, 600);

        // Team creation, with different players
        // Create user team
        const startingPositions =
            formationToWorldPositions(
                this.chosenFormation,
                'left'
            );

        startingPositions.forEach((pos, index) => {
            const player = new Player(
                this,
                pos.x,
                pos.y,
                0xffffff
            );

            // User attacks toward the right.
            player.facing = { x: 1, y: 0 };

            this.team.push(player);

            const name =
                this.squad[index]?.name ??
                `Player ${index + 1}`;

            const label = this.add.text(
                pos.x,
                pos.y - 25,
                name,
                {
                    fontSize: '12px',
                    color: '#ffffff'
                }
            ).setOrigin(0.5, 1);

            this.nameLabels.push(label);
        });

        this.player = this.team[0];


        // Create RL team using randomized training-style positions
        const opponentPositions =
            this.getRandomizedRLOpponentPositions();

        for (const pos of opponentPositions) {
            const opponent = new Player(
                this,
                pos.x,
                pos.y,
                0xff0000
            );

            // RL attacks toward the left.
            opponent.facing = { x: -1, y: 0 };

            this.opponents.push(opponent);
        }

        // Create the ball: black circle with a bouncy, drag-slowed physics body
        this.ball = this.add.circle(600, 300, 10, 0x000000) as PhysicsCircle;
        this.physics.add.existing(this.ball);
        this.ball.body.setCircle(10);
        this.ball.body.setCollideWorldBounds(false);
        this.ball.body.setBounce(1);
        this.ball.body.setDamping(true);
        this.ball.body.setDrag(0.434388);

        const wallThickness = 20;

        // Top and bottom sidelines — solid across the full pitch width, no gaps
        this.createWall(600, -wallThickness / 2, 1200, wallThickness);
        this.createWall(600, 600 + wallThickness / 2, 1200, wallThickness);

        // Left goal line — split in two, leaving a gap at the goal mouth (y 255–345)
        this.createWall(-wallThickness / 2, 127.5, wallThickness, 255);
        this.createWall(-wallThickness / 2, 472.5, wallThickness, 255);

        // Right goal line — same gap, mirrored to the other side
        this.createWall(1200 + wallThickness / 2, 127.5, wallThickness, 255);
        this.createWall(1200 + wallThickness / 2, 472.5, wallThickness, 255);

        this.createGoalZone(-40, 40, 100, () => {
            this.score.rl++;
            this.updateScoreText();
            this.resetKickoff();
        });
        this.createGoalZone(1240, 40, 100, () => {
            this.score.user++;
            this.updateScoreText();
            this.resetKickoff();
        });

        this.createGoalOutline('left');
        this.createGoalOutline('right');

        // Create the score text, horizontally centered near top
        this.scoreText = this.add.text(400, 20, '0 - 0', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5, 0);
        this.scoreText.setScrollFactor(0);

        // Create timer text, similar to the score text
        this.timerText = this.add.text(400, 60, '2:00', { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5, 0);
        this.timerText.setScrollFactor(0);

        // Set up input: arrow keys for movement, spacebar for kicking
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Camera follows the ball, easing toward it each frame instead of snapping instantly
        this.cameras.main.startFollow(this.ball, true, 0.08, 0);

    }

    

    update(_time: number, delta: number) {
        // Update the nearest player
        this.updateControlledPlayer();
        this.updatePossession();
        this.updateBallFollow();
        this.enforceFreeBallBounds();
        void this.updateRLPolicy(_time);

        // Update time
        this.timeRemaining -= delta / 1000;
        if (this.timeRemaining < 0) {
            this.timeRemaining = 0;
        }

        // Move name labels according to player position
        for (let i = 0; i < this.team.length; i++) {
            this.nameLabels[i].setPosition(this.team[i].x, this.team[i].y - 25);
        }

        if (this.timeRemaining === 0 && !this.matchOver) {
            this.matchOver = true;
            this.endMatch();
        }

        if (this.matchOver) {
            return;
        }

        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = Math.floor(this.timeRemaining % 60);
        this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`);

        // Movement and Direction (arrow keys)
        if (this.cursors.left.isDown) {
            this.player.body.setVelocityX(-200);
            this.player.facing.x = -1;
        } else if (this.cursors.right.isDown) {
            this.player.body.setVelocityX(200);
            this.player.facing.x = 1;
        } else {
            this.player.body.setVelocityX(0);
        }

        if (this.cursors.up.isDown) {
            this.player.body.setVelocityY(-200);
            this.player.facing.y = -1;
        } else if (this.cursors.down.isDown) {
            this.player.body.setVelocityY(200);
            this.player.facing.y = 1;
        } else {
            this.player.body.setVelocityY(0);
        }


        // Kicking Mechanic
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.ball.x, this.ball.y);
            const kickRange = 40;

            if (dist < kickRange) {
                const kickSpeed = 400;

                const magnitude = Math.sqrt(this.player.facing.x ** 2 + this.player.facing.y ** 2);
                const normalizedX = this.player.facing.x / magnitude;
                const normalizedY = this.player.facing.y / magnitude;
                
                this.possessor = null;
                this.ball.body.setVelocity(normalizedX * kickSpeed, normalizedY * kickSpeed);
            }
        }


        // RL opponent movement
        for (let i = 0; i < this.opponents.length; i++) {
            const opponent = this.opponents[i];
            const action = this.rlActions[i];

            // While a pass is flying, the intended receiver chases it.
            // Other RL players wait, matching the training environment.
            if (
                this.pendingPass !== null &&
                this.possessor === null
            ) {
                if (i === this.pendingPass.receiverIndex) {
                    this.moveRLReceiverTowardBall(opponent);
                } else {
                    opponent.body.setVelocity(0, 0);
                }

                continue;
            }

            if (action === 9) {
                this.applyRLShoot(opponent);
            } else if (action >= 10 && action <= 14) {
                const receiverIndex = action - 10;

                this.applyRLPass(
                    opponent,
                    i,
                    receiverIndex
                );
            } else {
                this.applyRLMovement(
                    opponent,
                    action
                );
            }
        }
    }
}