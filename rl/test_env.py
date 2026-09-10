import numpy as np

from stable_baselines3.common.env_checker import check_env

from soccer_env import SoccerEnv


def test_gymnasium_interface() -> None:
    """
    Verify that SoccerEnv follows the Gymnasium API expected by
    Stable-Baselines3.
    """
    env = SoccerEnv()
    check_env(env, warn=True)


def test_reset() -> None:
    """
    Resetting should restore the initial match state and return a valid
    observation.
    """
    env = SoccerEnv()

    obs, info = env.reset()

    assert obs.shape == (37,)
    assert obs.dtype == np.float32
    assert env.observation_space.contains(obs)

    assert env.rl_score == 0
    assert env.user_score == 0
    assert env.steps == 0
    assert env.possessor is None

    assert np.allclose(env.ball_pos, [600.0, 300.0])
    assert np.allclose(env.ball_vel, [0.0, 0.0])
    assert info == {}


def test_rl_player_moves_right() -> None:
    """
    Action 4 represents moving right. The player's x-coordinate should
    increase by speed * timestep.
    """
    env = SoccerEnv()
    env.reset()

    old_x = env.rl_pos[0, 0]

    actions = np.array([4, 0, 0, 0, 0])
    env.step(actions)

    expected_x = old_x + env.RL_SPEED * env.DT

    assert np.isclose(env.rl_pos[0, 0], expected_x)


def test_player_cannot_leave_pitch() -> None:
    """
    Players should be clamped to the field boundaries.
    """
    env = SoccerEnv()
    env.reset()

    env.rl_pos[0] = np.array(
        [env.WIDTH - 1.0, 300.0],
        dtype=np.float32,
    )

    actions = np.array([4, 0, 0, 0, 0])
    env.step(actions)

    assert env.rl_pos[0, 0] == env.WIDTH


def test_rl_can_gain_possession() -> None:
    """
    If the ball is within pickup range of an RL player, that player
    should gain possession.
    """
    env = SoccerEnv()
    env.reset()

    env.ball_pos = env.rl_pos[0].copy()

    env._update_possession()

    assert env.possessor == ("rl", 0)


def test_rl_player_can_kick() -> None:
    """
    A possessing RL player should be able to kick toward the left goal.
    """
    env = SoccerEnv()
    env.reset()

    env.possessor = ("rl", 0)

    env._attach_ball_to_possessor()

    actions = np.array([9, 0, 0, 0, 0])
    env._apply_rl_actions(actions)

    assert env.possessor is None

    # RL attacks the left goal, so the ball should move left.
    assert env.ball_vel[0] < 0

    assert np.isclose(
        np.linalg.norm(env.ball_vel),
        env.KICK_SPEED,
    )


def test_non_possessor_cannot_kick() -> None:
    """
    A player who does not possess the ball should not be able to kick it.
    """
    env = SoccerEnv()
    env.reset()

    original_velocity = env.ball_vel.copy()

    actions = np.array([9, 0, 0, 0, 0])
    env._apply_rl_actions(actions)

    assert env.possessor is None
    assert np.allclose(env.ball_vel, original_velocity)


def test_rl_goal() -> None:
    """
    A ball crossing the left goal line inside the goal mouth should
    count as an RL goal and produce a positive goal reward.
    """
    env = SoccerEnv()
    env.reset()

    env.ball_pos[:] = [-1.0, 300.0]

    reward = env._handle_goal_if_needed()

    assert reward == 1.0
    assert env.rl_score == 1
    assert env.user_score == 0

    # A goal should reset the ball for kickoff.
    assert np.allclose(env.ball_pos, [600.0, 300.0])
    assert env.possessor is None


def test_user_goal() -> None:
    """
    A ball crossing the right goal line inside the goal mouth should
    count as a user goal and give the RL agent a negative reward.
    """
    env = SoccerEnv()
    env.reset()

    env.ball_pos[:] = [env.WIDTH + 1.0, 300.0]

    reward = env._handle_goal_if_needed()

    assert reward == -1.0
    assert env.user_score == 1
    assert env.rl_score == 0

    assert np.allclose(env.ball_pos, [600.0, 300.0])


def test_ball_bounces_off_top_wall() -> None:
    """
    The ball should bounce rather than leave the pitch through the
    top boundary.
    """
    env = SoccerEnv()
    env.reset()

    env.ball_pos[:] = [600.0, 1.0]
    env.ball_vel[:] = [0.0, -100.0]

    env._update_free_ball()

    assert env.ball_pos[1] == 0.0
    assert env.ball_vel[1] > 0


def test_match_truncates_after_time_limit() -> None:
    """
    A match should stop once MAX_STEPS has been reached.
    """
    env = SoccerEnv()
    env.reset()

    env.steps = env.MAX_STEPS - 1

    actions = np.zeros(env.N_PLAYERS, dtype=np.int64)

    _, _, terminated, truncated, _ = env.step(actions)

    assert terminated is False
    assert truncated is True


def test_observation_after_reset_is_valid() -> None:
    """
    Every value in the observation should remain inside the declared
    observation space.
    """
    env = SoccerEnv()
    obs, _ = env.reset()

    assert np.all(obs >= -1.0)
    assert np.all(obs <= 1.0)
    assert env.observation_space.contains(obs)
    
    
def test_valid_kick_gets_positive_reward() -> None:
    env = SoccerEnv()
    env.reset()

    env.possessor = ("rl", 0)
    env._attach_ball_to_possessor()

    actions = np.array([9, 0, 0, 0, 0])

    _, reward, _, _, _ = env.step(actions)

    assert reward > 0

def test_invalid_kick_gets_penalty() -> None:
    env = SoccerEnv()
    env.reset()

    actions = np.array([9, 0, 0, 0, 0])

    _, reward, _, _, _ = env.step(actions)

    assert reward < 0


def run_tests() -> None:
    tests = [
        test_gymnasium_interface,
        test_reset,
        test_rl_player_moves_right,
        test_player_cannot_leave_pitch,
        test_rl_can_gain_possession,
        test_rl_player_can_kick,
        test_non_possessor_cannot_kick,
        test_rl_goal,
        test_user_goal,
        test_ball_bounces_off_top_wall,
        test_match_truncates_after_time_limit,
        test_observation_after_reset_is_valid,
        test_valid_kick_gets_positive_reward,
        test_invalid_kick_gets_penalty
    ]

    passed = 0

    for test in tests:
        try:
            test()
            print(f"PASS: {test.__name__}")
            passed += 1

        except AssertionError:
            print(f"FAIL: {test.__name__}")
            raise

    print(f"\n{passed}/{len(tests)} tests passed.")


if __name__ == "__main__":
    run_tests()