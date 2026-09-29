from pathlib import Path

import torch
from torch import nn
from sb3_contrib import MaskablePPO


ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "models" / "role_randomized_finetuned_500k.zip"
ONNX_PATH = ROOT / "models" / "tactiq_v1.onnx"


class PolicyLogitsWrapper(nn.Module):
    """
    Wrap the Stable-Baselines3 policy so ONNX receives an observation
    and returns the raw action logits.

    For TactIQ:
        input:  37 observation values
        output: 75 logits = 5 players * 15 actions
    """

    def __init__(self, policy):
        super().__init__()
        self.policy = policy

    def forward(self, observation):
        features = self.policy.extract_features(observation)

        if self.policy.share_features_extractor:
            latent_pi, _ = self.policy.mlp_extractor(features)
        else:
            pi_features, vf_features = features
            latent_pi = self.policy.mlp_extractor.forward_actor(pi_features)

        return self.policy.action_net(latent_pi)


def main():
    print(f"Loading model: {MODEL_PATH}")

    model = MaskablePPO.load(MODEL_PATH)

    wrapper = PolicyLogitsWrapper(model.policy)
    wrapper.eval()

    # One observation = 37 floats.
    dummy_observation = torch.zeros(
        (1, 37),
        dtype=torch.float32,
    )

    print(f"Exporting to: {ONNX_PATH}")

    torch.onnx.export(
        wrapper,
        dummy_observation,
        ONNX_PATH,
        input_names=["observation"],
        output_names=["action_logits"],
        dynamic_axes={
            "observation": {0: "batch_size"},
            "action_logits": {0: "batch_size"},
        },
        opset_version=17,
        dynamo=False,
    )

    print("Export complete.")

    # Quick sanity check.
    with torch.no_grad():
        logits = wrapper(dummy_observation)

    print(f"Input shape:  {tuple(dummy_observation.shape)}")
    print(f"Output shape: {tuple(logits.shape)}")


if __name__ == "__main__":
    main()