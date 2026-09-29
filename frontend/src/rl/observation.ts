import { Player } from "../entities/Player";

const WIDTH = 1200;
const HEIGHT = 600;
const KICK_SPEED = 400;

export function buildObservation(
    team: Player[],
    opponents: Player[],
    ball: {
        x: number;
        y: number;
        body: Phaser.Physics.Arcade.Body;
    },
    possessor: Player | null,
    leftNetScore: number,
    rightNetScore: number,
    timeRemaining: number
): Float32Array {
    const obs: number[] = [];

    // --------------------------------------------------
    // 1. USER TEAM POSITIONS
    // --------------------------------------------------

    for (const player of team) {
        obs.push(player.x / WIDTH * 2 - 1);
        obs.push(player.y / HEIGHT * 2 - 1);
    }

    // --------------------------------------------------
    // 2. RL TEAM POSITIONS
    // --------------------------------------------------

    for (const opponent of opponents) {
        obs.push(opponent.x / WIDTH * 2 - 1);
        obs.push(opponent.y / HEIGHT * 2 - 1);
    }

    // --------------------------------------------------
    // 3. BALL POSITION
    // --------------------------------------------------

    obs.push(ball.x / WIDTH * 2 - 1);
    obs.push(ball.y / HEIGHT * 2 - 1);

    // --------------------------------------------------
    // 4. BALL VELOCITY
    // --------------------------------------------------

    obs.push(
        Phaser.Math.Clamp(
            ball.body.velocity.x / KICK_SPEED,
            -1,
            1
        )
    );

    obs.push(
        Phaser.Math.Clamp(
            ball.body.velocity.y / KICK_SPEED,
            -1,
            1
        )
    );

    // --------------------------------------------------
    // 5. POSSESSION ONE-HOT
    //
    // [none,
    //  user0 ... user4,
    //  rl0   ... rl4]
    // --------------------------------------------------

    const possession = new Array(11).fill(0);

    if (possessor === null) {
        possession[0] = 1;
    } else {
        const userIndex = team.indexOf(possessor);

        if (userIndex !== -1) {
            possession[1 + userIndex] = 1;
        } else {
            const rlIndex = opponents.indexOf(possessor);

            if (rlIndex !== -1) {
                possession[6 + rlIndex] = 1;
            }
        }
    }

    obs.push(...possession);

    // --------------------------------------------------
    // 6. SCORE DIFFERENCE
    //
    // SoccerEnv:
    //     (rl_score - user_score) / 5
    //
    // RL attacks LEFT in Phaser, so scoring in leftNet
    // means an RL goal.
    // --------------------------------------------------

    const scoreDiff = Phaser.Math.Clamp(
        (leftNetScore - rightNetScore) / 5,
        -1,
        1
    );

    obs.push(scoreDiff);

    // --------------------------------------------------
    // 7. TIME REMAINING
    // --------------------------------------------------

    obs.push(
        Phaser.Math.Clamp(
            timeRemaining / 120,
            0,
            1
        )
    );

    if (obs.length !== 37) {
        throw new Error(
            `Expected 37 observation values, got ${obs.length}`
        );
    }

    return new Float32Array(obs);
}