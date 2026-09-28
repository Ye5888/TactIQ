from pathlib import Path

from sb3_contrib import MaskablePPO
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

    model = MaskablePPO.load(
        MODEL_DIR / "role_randomized_scratch_500k.zip",
        env=env,
    )

    model.learn(
        total_timesteps=1_000_000,
        reset_num_timesteps=False,
    )

    model.save(
        MODEL_DIR / "role_randomized_scratch_1500k.zip"
    )


if __name__ == "__main__":
    main()
