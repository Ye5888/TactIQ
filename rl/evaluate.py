from pathlib import Path

import numpy as np
from stable_baselines3 import PPO

from soccer_env import SoccerEnv


ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "models" / "tactiq_opponent.zip"

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
    "kick",
]


def main(episodes: int = 20) -> None:
    env = SoccerEnv()
    model = PPO.load(MODEL_PATH)

    wins = draws = losses = 0
    total_rl = total_user = 0

    action_counts = np.zeros(10, dtype=np.int64)

    rl_possessions = 0
    user_possessions = 0

    successful_rl_kicks = 0
    successful_user_kicks = 0

    rl_dribble_goals = 0
    rl_kick_goals = 0
    rl_other_goals = 0

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
            action, _ = model.predict(
                obs,
                deterministic=True,
            )

            # Count all actions selected by the RL team.
            for player_action in action:
                action_counts[int(player_action)] += 1

            # Track what is happening to the ball before this step.
            if (
                env.possessor is not None
                and env.possessor[0] == "rl"
            ):
                possessor_index = env.possessor[1]

                if action[possessor_index] == 9:
                    successful_rl_kicks += 1
                    last_ball_action = "rl_kick"
                else:
                    last_ball_action = "rl_dribble"

            elif (
                env.possessor is not None
                and env.possessor[0] == "user"
            ):
                # Scripted team automatically kicks when it has possession.
                successful_user_kicks += 1
                last_ball_action = "scripted_kick"

            previous_rl_score = env.rl_score

            obs, _, terminated, truncated, info = env.step(action)

            # If RL scored during this step, record how the goal happened.
            if env.rl_score > previous_rl_score:
                if last_ball_action == "rl_kick":
                    rl_kick_goals += 1

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
    print("Successful kicks:")
    print(f"RL: {successful_rl_kicks}")
    print(f"Scripted: {successful_user_kicks}")

    print()
    print("RL goal types:")
    print(f"Dribble goals: {rl_dribble_goals}")
    print(f"Kick goals: {rl_kick_goals}")
    print(f"Other goals: {rl_other_goals}")

    print()
    print("Ball horizontal range:")
    print(f"Minimum x: {min_ball_x:.1f}")
    print(f"Maximum x: {max_ball_x:.1f}")

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