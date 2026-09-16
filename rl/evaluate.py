from pathlib import Path

import numpy as np
from sb3_contrib import MaskablePPO

from soccer_env import SoccerEnv


ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "models" / "baseline_500k.zip"

ACTION_NAMES = [
    "idle",
    "up",
    "down",
    "left",
    "right",
    "up-left",
    "up-right",
    "down-left",
    "down-right",
    "shoot",
    "pass-to-0",
    "pass-to-1",
    "pass-to-2",
    "pass-to-3",
    "pass-to-4",
]


def main(episodes: int = 20) -> None:
    env = SoccerEnv()
    model = MaskablePPO.load(MODEL_PATH)

    wins = draws = losses = 0
    total_rl = total_user = 0

    action_counts = np.zeros(15, dtype=np.int64)

    rl_possessions = 0
    user_possessions = 0

    valid_rl_shots = 0
    scripted_kicks = 0

    rl_pass_attempts = 0
    rl_completed_passes = 0
    rl_intercepted_passes = 0

    rl_dribble_goals = 0
    rl_shot_goals = 0
    rl_other_goals = 0
    
    rl_possession_x = []
    shot_x_positions = []

    min_ball_x = env.WIDTH
    max_ball_x = 0.0

    rng = np.random.default_rng(42)

    for _ in range(episodes):
        obs, _ = env.reset()

        # Slightly randomize starting positions so each episode
        # is not the exact same deterministic match.
        env.user_pos += rng.uniform(-30, 30, size=env.user_pos.shape)
        env.rl_pos += rng.uniform(-30, 30, size=env.rl_pos.shape)

        env.user_pos[:, 0] = np.clip(
            env.user_pos[:, 0],
            0,
            env.WIDTH,
        )
        env.user_pos[:, 1] = np.clip(
            env.user_pos[:, 1],
            0,
            env.HEIGHT,
        )

        env.rl_pos[:, 0] = np.clip(
            env.rl_pos[:, 0],
            0,
            env.WIDTH,
        )
        env.rl_pos[:, 1] = np.clip(
            env.rl_pos[:, 1],
            0,
            env.HEIGHT,
        )

        env.ball_pos[:] = [
            rng.uniform(540, 660),
            rng.uniform(220, 380),
        ]

        env.ball_vel[:] = 0
        env.possessor = None

        # Rebuild the observation after changing the environment state.
        obs = env._get_obs()

        done = False
        info = {}

        previous_possessor = env.possessor
        last_ball_action = None

        while not done:
            action_masks = env.action_masks()

            action, _ = model.predict(
                obs,
                deterministic=True,
                action_masks=action_masks,
            )

            # Count all actions selected by the RL team.
            for player_action in action:
                action_counts[int(player_action)] += 1

            # Track what is happening to the ball before this step.
            # Track what the player with the ball is trying to do.
            if env.possessor is not None and env.possessor[0] == "rl":
                possessor_index = env.possessor[1]
                possessor_action = int(action[possessor_index])

                # Action 9 = shoot.
                if possessor_action == 9:
                    valid_rl_shots += 1
                    last_ball_action = "rl_shot"

                # Actions 10-14 = pass to RL players 0-4.
                elif 10 <= possessor_action <= 14:
                    receiver_index = possessor_action - 10

                    # Ignore self-passes because the environment does too.
                    if receiver_index != possessor_index:
                        rl_pass_attempts += 1
                        last_ball_action = "rl_pass"

                else:
                    last_ball_action = "rl_dribble"

            elif env.possessor is not None and env.possessor[0] == "user":
                # Scripted team automatically kicks when it has possession.
                scripted_kicks += 1
                last_ball_action = "scripted_kick"

            previous_rl_score = env.rl_score
            
            if env.possessor is not None and env.possessor[0] == "rl":
                possessor_index = env.possessor[1]
                rl_possession_x.append(float(env.rl_pos[possessor_index][0]))
                
            # Record the location of actual RL shots before env.step(),
            # because shooting clears possession.
            if env.possessor is not None and env.possessor[0] == "rl":
                shooter_index = env.possessor[1]

                if action[shooter_index] == 9:
                    shot_x_positions.append(
                        float(env.rl_pos[shooter_index][0])
                    )

            obs, _, terminated, truncated, info = env.step(action)
            if info["pass_completed"]:
                rl_completed_passes += 1

            if info["pass_intercepted"]:
                rl_intercepted_passes += 1

            # If RL scored during this step, record how the goal happened.
            if env.rl_score > previous_rl_score:
                if last_ball_action == "rl_shot":
                    rl_shot_goals += 1

                elif last_ball_action == "rl_dribble":
                    rl_dribble_goals += 1

                else:
                    rl_other_goals += 1

                # Goal causes a kickoff reset, so clear the previous action.
                last_ball_action = None

            # Track how far the ball travels horizontally.
            min_ball_x = min(
                min_ball_x,
                float(env.ball_pos[0]),
            )
            max_ball_x = max(
                max_ball_x,
                float(env.ball_pos[0]),
            )

            # Count possession changes.
            current_possessor = env.possessor

            if current_possessor != previous_possessor:
                if current_possessor is not None:
                    if current_possessor[0] == "rl":
                        rl_possessions += 1

                    elif current_possessor[0] == "user":
                        user_possessions += 1

            previous_possessor = current_possessor

            done = terminated or truncated

        rl_score = info["rl_score"]
        user_score = info["user_score"]

        total_rl += rl_score
        total_user += user_score

        if rl_score > user_score:
            wins += 1

        elif rl_score == user_score:
            draws += 1

        else:
            losses += 1

    print(f"Episodes: {episodes}")
    print(f"RL record: {wins}W {draws}D {losses}L")
    print(f"Goals: RL {total_rl} - {total_user} scripted")

    print()
    print("Possession events:")
    print(f"RL: {rl_possessions}")
    print(f"Scripted: {user_possessions}")

    print()
    print("RL ball actions:")
    print(f"Valid shots: {valid_rl_shots}")
    print(f"Pass attempts: {rl_pass_attempts}")
    print(f"Completed passes: {rl_completed_passes}")
    print(f"Intercepted passes: {rl_intercepted_passes}")
    print(f"Scripted kicks: {scripted_kicks}")

    print()
    print("RL goal types:")
    print(f"Dribble goals: {rl_dribble_goals}")
    print(f"Shot goals: {rl_shot_goals}")
    print(f"Other goals: {rl_other_goals}")
    
    print("\nRL possession positions:")

    if rl_possession_x:
        print(f"Minimum x: {min(rl_possession_x):.1f}")
        print(f"Average x: {np.mean(rl_possession_x):.1f}")

        close_possessions = sum(x <= 400 for x in rl_possession_x)

        print(f"Possession steps at x <= 400: {close_possessions}")

    print()
    print("Ball horizontal range:")
    print(f"Minimum x: {min_ball_x:.1f}")
    print(f"Maximum x: {max_ball_x:.1f}")
    
    print("\nRL shot positions:")

    if shot_x_positions:
        print(f"Minimum x: {min(shot_x_positions):.1f}")
        print(f"Average x: {np.mean(shot_x_positions):.1f}")
        print(f"Maximum x: {max(shot_x_positions):.1f}")
        
    print(f"Shots x 0-100:   {sum(0 <= x <= 100 for x in shot_x_positions)}")
    print(f"Shots x 100-200: {sum(100 < x <= 200 for x in shot_x_positions)}")
    print(f"Shots x 200-300: {sum(200 < x <= 300 for x in shot_x_positions)}")
    print(f"Shots x 300-400: {sum(300 < x <= 400 for x in shot_x_positions)}")

    print()
    print("RL action usage:")

    total_actions = action_counts.sum()

    for action_id, count in enumerate(action_counts):
        percentage = (
            count / total_actions * 100
            if total_actions > 0
            else 0
        )

        print(
            f"{ACTION_NAMES[action_id]:<12}"
            f"{count:>8} "
            f"({percentage:5.1f}%)"
        )


if __name__ == "__main__":
    main()