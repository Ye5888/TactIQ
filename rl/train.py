from pathlib import Path

from stable_baselines3 import PPO
from stable_baselines3.common.env_checker import check_env
from stable_baselines3.common.vec_env import DummyVecEnv

from soccer_env import SoccerEnv


ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / "models"
MODEL_DIR.mkdir(exist_ok=True)


def main() -> None:
    # Catch Gymnasium API/space mistakes before spending time training.
    check_env(SoccerEnv(), warn=True)

    env = DummyVecEnv([lambda: SoccerEnv()])

    model = PPO(
        "MlpPolicy",
        env,
        verbose=1,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=256,
        gamma=0.99,
        gae_lambda=0.95,
        ent_coef=0.01,
        tensorboard_log=str(ROOT / "runs"),
    )

    model.learn(total_timesteps=50_000, progress_bar=True)
    model.save(MODEL_DIR / "tactiq_opponent")


if __name__ == "__main__":
    main()
