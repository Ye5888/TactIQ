from __future__ import annotations

import math
from typing import Any

import gymnasium as gym
import numpy as np
from gymnasium import spaces


class SoccerEnv(gym.Env[np.ndarray, np.ndarray]):
    """Lightweight 5v5 soccer environment used to train TactIQ's opponent policy.

    The red/RL team attacks the left goal. The white/scripted team attacks the
    right goal. This environment intentionally models only the mechanics the
    policy needs; Phaser remains the source of truth for rendering/gameplay.
    """

    metadata = {"render_modes": []}

    WIDTH = 1200.0
    HEIGHT = 600.0
    GOAL_Y_MIN = 255.0
    GOAL_Y_MAX = 345.0

    N_PLAYERS = 5
    DT = 0.10
    MATCH_SECONDS = 120.0
    MAX_STEPS = int(MATCH_SECONDS / DT)

    RL_SPEED = 150.0
    SCRIPTED_SPEED = 150.0
    KICK_SPEED = 400.0
    PICKUP_RANGE = 20.0
    BALL_DRAG = 0.92

    # idle, 8 directions, kick
    N_ACTIONS_PER_PLAYER = 10

    MOVE_DIRECTIONS = np.array(
        [
            [0.0, 0.0],
            [0.0, -1.0],
            [0.0, 1.0],
            [-1.0, 0.0],
            [1.0, 0.0],
            [-1.0, -1.0],
            [1.0, -1.0],
            [-1.0, 1.0],
            [1.0, 1.0],
        ],
        dtype=np.float32,
    )

    # Matches ONE_TWO_ONE mirrored onto each side of the Phaser pitch.
    LEFT_START = np.array(
        [[48, 300], [150, 300], [330, 120], [330, 480], [510, 300]],
        dtype=np.float32,
    )
    RIGHT_START = np.array(
        [[1152, 300], [1050, 300], [870, 120], [870, 480], [690, 300]],
        dtype=np.float32,
    )

    def __init__(self, seed: int | None = None):
        super().__init__()

        # One action for each RL-controlled opponent.
        self.action_space = spaces.MultiDiscrete(
            np.full(self.N_PLAYERS, self.N_ACTIONS_PER_PLAYER, dtype=np.int64)
        )

        # 10 players * xy = 20
        # ball xy + velocity xy = 4
        # possession one-hot: none + 5 user + 5 RL = 11
        # score difference + normalized remaining time = 2
        # total = 37
        self.observation_space = spaces.Box(
            low=-1.0,
            high=1.0,
            shape=(37,),
            dtype=np.float32,
        )

        self.user_pos = np.zeros((self.N_PLAYERS, 2), dtype=np.float32)
        self.rl_pos = np.zeros((self.N_PLAYERS, 2), dtype=np.float32)
        self.rl_facing = np.tile(np.array([-1.0, 0.0], dtype=np.float32), (self.N_PLAYERS, 1))
        self.user_facing = np.tile(np.array([1.0, 0.0], dtype=np.float32), (self.N_PLAYERS, 1))

        self.ball_pos = np.zeros(2, dtype=np.float32)
        self.ball_vel = np.zeros(2, dtype=np.float32)
        self.possessor: tuple[str, int] | None = None
        self.rl_score = 0
        self.user_score = 0
        self.steps = 0

        if seed is not None:
            self.reset(seed=seed)

    def reset(
        self,
        *,
        seed: int | None = None,
        options: dict[str, Any] | None = None,
    ) -> tuple[np.ndarray, dict[str, Any]]:
        super().reset(seed=seed)

        self.user_pos = self.LEFT_START.copy()
        self.rl_pos = self.RIGHT_START.copy()
        self.rl_facing[:] = (-1.0, 0.0)
        self.user_facing[:] = (1.0, 0.0)
        self.ball_pos[:] = (600.0, 300.0)
        self.ball_vel[:] = 0.0
        self.possessor = None
        self.rl_score = 0
        self.user_score = 0
        self.steps = 0

        return self._get_obs(), {}

    def step(self, action: np.ndarray):
        self.steps += 1
        previous_ball_x = float(self.ball_pos[0])
        previous_possessor = self.possessor

        self._apply_rl_actions(np.asarray(action, dtype=np.int64))
        self._apply_scripted_user()
        self._update_free_ball()
        self._update_possession()
        self._attach_ball_to_possessor()

        goal_reward = self._handle_goal_if_needed()

        reward = goal_reward

        # Small dense shaping rewards. The RL team attacks LEFT, so decreasing
        # ball x is progress when RL has possession.
        if self.possessor is not None and self.possessor[0] == "rl":
            progress = (previous_ball_x - float(self.ball_pos[0])) / self.WIDTH
            reward += 0.08 * progress

        if previous_possessor != self.possessor:
            if self.possessor is not None and self.possessor[0] == "rl":
                reward += 0.03
            elif self.possessor is not None and self.possessor[0] == "user":
                reward -= 0.03

        terminated = False
        truncated = self.steps >= self.MAX_STEPS

        if truncated:
            # Encourage the final outcome, not just isolated touches.
            score_diff = self.rl_score - self.user_score
            reward += 0.5 * np.sign(score_diff)

        info = {
            "rl_score": self.rl_score,
            "user_score": self.user_score,
            "possessor": self.possessor,
        }
        return self._get_obs(), float(reward), terminated, truncated, info

    def _apply_rl_actions(self, actions: np.ndarray) -> None:
        for i, action in enumerate(actions):
            if action == 9:  # kick toward the left goal
                if self.possessor == ("rl", i):
                    target = np.array([0.0, 300.0], dtype=np.float32)
                    self._kick(i, "rl", target)
                continue

            direction = self.MOVE_DIRECTIONS[action].copy()
            norm = float(np.linalg.norm(direction))
            if norm > 0:
                direction /= norm
                self.rl_facing[i] = direction
                self.rl_pos[i] += direction * self.RL_SPEED * self.DT
                self._clamp_player(self.rl_pos[i])

    def _apply_scripted_user(self) -> None:
        # Baseline opponent used only during training: all white players chase
        # the ball, and the possessor shoots at the right goal.
        for i in range(self.N_PLAYERS):
            if self.possessor == ("user", i):
                target = np.array([self.WIDTH, 300.0], dtype=np.float32)
                self._kick(i, "user", target)
                continue

            delta = self.ball_pos - self.user_pos[i]
            distance = float(np.linalg.norm(delta))
            if distance > 1e-6:
                direction = delta / distance
                self.user_facing[i] = direction
                self.user_pos[i] += direction * self.SCRIPTED_SPEED * self.DT
                self._clamp_player(self.user_pos[i])

    def _kick(self, index: int, team: str, target: np.ndarray) -> None:
        if self.possessor != (team, index):
            return

        delta = target - self.ball_pos
        norm = float(np.linalg.norm(delta))
        if norm < 1e-6:
            return

        self.possessor = None
        self.ball_vel = delta / norm * self.KICK_SPEED

    def _update_free_ball(self) -> None:
        if self.possessor is not None:
            self.ball_vel[:] = 0.0
            return

        self.ball_pos += self.ball_vel * self.DT
        self.ball_vel *= self.BALL_DRAG

        # Bounce off top and bottom walls.
        if self.ball_pos[1] < 0.0:
            self.ball_pos[1] = 0.0
            self.ball_vel[1] *= -1.0
        elif self.ball_pos[1] > self.HEIGHT:
            self.ball_pos[1] = self.HEIGHT
            self.ball_vel[1] *= -1.0

        # Bounce off left/right walls unless inside the goal mouth.
        in_goal_mouth = self.GOAL_Y_MIN <= self.ball_pos[1] <= self.GOAL_Y_MAX
        if not in_goal_mouth:
            if self.ball_pos[0] < 0.0:
                self.ball_pos[0] = 0.0
                self.ball_vel[0] *= -1.0
            elif self.ball_pos[0] > self.WIDTH:
                self.ball_pos[0] = self.WIDTH
                self.ball_vel[0] *= -1.0

    def _update_possession(self) -> None:
        if self.possessor is not None:
            return

        best: tuple[str, int] | None = None
        best_dist = self.PICKUP_RANGE

        for team, positions in (("user", self.user_pos), ("rl", self.rl_pos)):
            for i, pos in enumerate(positions):
                dist = float(np.linalg.norm(pos - self.ball_pos))
                if dist < best_dist:
                    best = (team, i)
                    best_dist = dist

        self.possessor = best
        if best is not None:
            self.ball_vel[:] = 0.0

    def _attach_ball_to_possessor(self) -> None:
        if self.possessor is None:
            return

        team, i = self.possessor
        if team == "rl":
            pos = self.rl_pos[i]
            facing = self.rl_facing[i]
        else:
            pos = self.user_pos[i]
            facing = self.user_facing[i]

        self.ball_pos = pos + facing * 15.0
        self.ball_vel[:] = 0.0

    def _handle_goal_if_needed(self) -> float:
        in_goal_mouth = self.GOAL_Y_MIN <= self.ball_pos[1] <= self.GOAL_Y_MAX
        if not in_goal_mouth:
            return 0.0

        if self.ball_pos[0] < 0.0:
            self.rl_score += 1
            self._reset_kickoff()
            return 1.0

        if self.ball_pos[0] > self.WIDTH:
            self.user_score += 1
            self._reset_kickoff()
            return -1.0

        return 0.0

    def _reset_kickoff(self) -> None:
        self.user_pos = self.LEFT_START.copy()
        self.rl_pos = self.RIGHT_START.copy()
        self.ball_pos[:] = (600.0, 300.0)
        self.ball_vel[:] = 0.0
        self.possessor = None

    def _clamp_player(self, pos: np.ndarray) -> None:
        pos[0] = np.clip(pos[0], 0.0, self.WIDTH)
        pos[1] = np.clip(pos[1], 0.0, self.HEIGHT)

    def _get_obs(self) -> np.ndarray:
        # Positions normalized to [-1, 1].
        def norm_positions(positions: np.ndarray) -> np.ndarray:
            result = positions.copy()
            result[:, 0] = result[:, 0] / self.WIDTH * 2.0 - 1.0
            result[:, 1] = result[:, 1] / self.HEIGHT * 2.0 - 1.0
            return result.reshape(-1)

        user = norm_positions(self.user_pos)
        rl = norm_positions(self.rl_pos)

        ball_xy = np.array(
            [
                self.ball_pos[0] / self.WIDTH * 2.0 - 1.0,
                self.ball_pos[1] / self.HEIGHT * 2.0 - 1.0,
            ],
            dtype=np.float32,
        )
        ball_v = np.clip(self.ball_vel / self.KICK_SPEED, -1.0, 1.0).astype(np.float32)

        possession = np.zeros(11, dtype=np.float32)
        if self.possessor is None:
            possession[0] = 1.0
        else:
            team, i = self.possessor
            possession[1 + i if team == "user" else 6 + i] = 1.0

        score_diff = np.clip((self.rl_score - self.user_score) / 5.0, -1.0, 1.0)
        time_remaining = 1.0 - (self.steps / self.MAX_STEPS)

        obs = np.concatenate(
            [
                user,
                rl,
                ball_xy,
                ball_v,
                possession,
                np.array([score_diff, time_remaining], dtype=np.float32),
            ]
        )
        return obs.astype(np.float32)
