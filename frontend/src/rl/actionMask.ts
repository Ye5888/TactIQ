import { Player } from "../entities/Player";

const N_PLAYERS = 5;
const N_ACTIONS_PER_PLAYER = 15;

export function buildActionMask(
    opponents: Player[],
    possessor: Player | null
): boolean[] {
    const masks: boolean[] = [];

    for (let i = 0; i < N_PLAYERS; i++) {
        // Start with every action allowed.
        const playerMask = new Array(
            N_ACTIONS_PER_PLAYER
        ).fill(true);

        // Is RL player i currently holding the ball?
        const hasPossession =
            possessor === opponents[i];

        if (!hasPossession) {
            // 0-8 = movement
            // 9   = shoot
            // 10-14 = passes
            //
            // Players without the ball cannot shoot/pass.
            for (let action = 9; action < 15; action++) {
                playerMask[action] = false;
            }
        } else {
            // Player has possession.
            //
            // It can shoot and pass, but can't pass to itself.
            const selfPassAction = 10 + i;
            playerMask[selfPassAction] = false;
        }

        masks.push(...playerMask);
    }

    if (masks.length !== 75) {
        throw new Error(
            `Expected 75 action-mask values, got ${masks.length}`
        );
    }

    return masks;
}