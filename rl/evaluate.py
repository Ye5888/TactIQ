from pathlib import Path

from stable_baselines3 import PPO

from soccer_env import SoccerEnv


ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "models" / "tactiq_opponent.zip"


def main(episodes: int = 20) -> None:
    env = SoccerEnv()
    model = PPO.load(MODEL_PATH)

    wins = draws = losses = 0
    total_rl = total_user = 0

    for _ in range(episodes):
        obs, _ = env.reset()
        done = False
        info = {}

        while not done:
            action, _ = model.predict(obs, deterministic=True)
            obs, _, terminated, truncated, info = env.step(action)
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


if __name__ == "__main__":
    main()
