from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
from sb3_contrib import MaskablePPO

from soccer_env import SoccerEnv


ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "models" / "role_randomized_finetuned_500k.zip"
ONNX_PATH = ROOT / "models" / "tactiq_v1.onnx"


def get_onnx_actions(
    session: ort.InferenceSession,
    observation: np.ndarray,
    action_mask: np.ndarray,
) -> np.ndarray:
    """
    Run the observation through ONNX, apply the same legal-action mask,
    and choose the highest-scoring legal action for each player.
    """

    # ONNX expects a batch dimension:
    # (37,) -> (1, 37)
    obs_batch = observation.astype(np.float32)[None, :]

    outputs = session.run(
        ["action_logits"],
        {"observation": obs_batch},
    )

    # Shape: (1, 75) -> (75,)
    logits = outputs[0][0]

    # TactIQ has 5 players with 15 possible actions each.
    logits = logits.reshape(5, 15)
    masks = action_mask.reshape(5, 15)

    actions = []

    for player in range(5):
        player_logits = logits[player].copy()
        player_mask = masks[player]

        # Illegal actions should never be selected.
        player_logits[~player_mask] = -np.inf

        # deterministic=True means choose the highest-scoring legal action.
        action = int(np.argmax(player_logits))
        actions.append(action)

    return np.array(actions, dtype=np.int64)


def main() -> None:
    env = SoccerEnv()

    pytorch_model = MaskablePPO.load(MODEL_PATH)

    onnx_session = ort.InferenceSession(
        str(ONNX_PATH),
        providers=["CPUExecutionProvider"],
    )

    matches = 0
    total = 0

    obs, _ = env.reset(seed=42)

    print("Comparing PyTorch MaskablePPO vs ONNX...\n")

    for step in range(1000):
        action_mask = env.action_masks()

        # Original model
        pytorch_action, _ = pytorch_model.predict(
            obs,
            deterministic=True,
            action_masks=action_mask,
        )

        # Exported model
        onnx_action = get_onnx_actions(
            onnx_session,
            obs,
            action_mask,
        )

        same = np.array_equal(
            np.asarray(pytorch_action),
            onnx_action,
        )

        total += 1

        if same:
            matches += 1
        else:
            print(f"Mismatch at step {step}")
            print(f"PyTorch: {pytorch_action}")
            print(f"ONNX:    {onnx_action}")
            print()

        # IMPORTANT:
        # Advance the environment using the ORIGINAL model's action so both
        # comparisons continue seeing the exact same game state.
        obs, _, terminated, truncated, _ = env.step(pytorch_action)

        if terminated or truncated:
            obs, _ = env.reset()

    print("--------------------------------")
    print(f"Matching decisions: {matches}/{total}")
    print(f"Match rate: {matches / total * 100:.2f}%")


if __name__ == "__main__":
    main()