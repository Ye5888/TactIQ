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

    min_ball_x = env.WIDTH
    max_ball_x = 0.0

    for _ in range(episodes):
        obs, _ = env.reset()
        done = False
        info = {}

        previous_possessor = env.possessor

        while not done:
            action, _ = model.predict(obs, deterministic=True)

            # Count all RL actions chosen.
            for player_action in action:
                action_counts[int(player_action)] += 1

            # Count RL kicks that are actually made by the player
            # currently possessing the ball.
            if env.possessor is not None and env.possessor[0] == "rl":
                possessor_index = env.possessor[1]

                if action[possessor_index] == 9:
                    successful_rl_kicks += 1

            # The scripted user automatically kicks whenever it
            # begins a step with possession.
            if env.possessor is not None and env.possessor[0] == "user":
                successful_user_kicks += 1

            obs, _, terminated, truncated, info = env.step(action)

            # Track how far the ball travels horizontally.
            min_ball_x = min(min_ball_x, float(env.ball_pos[0]))
            max_ball_x = max(max_ball_x, float(env.ball_pos[0]))

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