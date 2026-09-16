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


def test_valid_shot_gets_positive_reward() -> None:
    env = SoccerEnv()
    env.reset()

    env.rl_pos[0] = np.array([200.0, 300.0], dtype=np.float32)

    env.possessor = ("rl", 0)
    env._attach_ball_to_possessor()

    actions = np.array([9, 0, 0, 0, 0])

    _, reward, _, _, _ = env.step(actions)

    assert reward > 0


def test_invalid_shot_gets_penalty() -> None:
    env = SoccerEnv()
    env.reset()

    actions = np.array([9, 0, 0, 0, 0])

    _, reward, _, _, _ = env.step(actions)

    assert reward < 0


def test_rl_player_can_pass_to_teammate() -> None:
    env = SoccerEnv()
    env.reset()

    # Player 0 has possession.
    env.possessor = ("rl", 0)
    env._attach_ball_to_possessor()

    # Action 11 = pass to teammate 1.
    actions = np.array([11, 0, 0, 0, 0])

    env._apply_rl_actions(actions)

    # Ball should leave the passer's possession.
    assert env.possessor is None

    # Environment should remember who the pass is intended for.
    assert env.pending_pass is not None
    assert env.pending_pass[0] == 0
    assert env.pending_pass[1] == 1

    # Ball should now be moving.
    assert np.linalg.norm(env.ball_vel) > 0

def test_non_possessor_cannot_pass() -> None:
    env = SoccerEnv()
    env.reset()

    # Player 0 has possession.
    env.possessor = ("rl", 0)
    env._attach_ball_to_possessor()

    original_velocity = env.ball_vel.copy()

    # Player 1 tries to pass to player 2.
    # Action 12 = pass to teammate 2.
    actions = np.array([0, 12, 0, 0, 0])

    env._apply_rl_actions(actions)

    # Player 0 should still have possession.
    assert env.possessor == ("rl", 0)

    # No pass should have started.
    assert env.pending_pass is None

    assert np.allclose(env.ball_vel, original_velocity)


def test_self_pass_does_nothing() -> None:
    env = SoccerEnv()
    env.reset()

    env.possessor = ("rl", 0)
    env._attach_ball_to_possessor()

    original_velocity = env.ball_vel.copy()

    # Action 10 = pass to teammate 0.
    # Since player 0 is the possessor, this would be a self-pass.
    actions = np.array([10, 0, 0, 0, 0])

    env._apply_rl_actions(actions)

    assert env.possessor == ("rl", 0)
    assert env.pending_pass is None
    assert np.allclose(env.ball_vel, original_velocity)


def test_completed_pass_gets_positive_reward() -> None:
    env = SoccerEnv()
    env.reset()

    # Put the passer and receiver close together so the pass
    # can be completed within one simulation step.
    env.rl_pos[0] = np.array([600.0, 300.0], dtype=np.float32)
    env.rl_pos[1] = np.array([545.0, 300.0], dtype=np.float32)

    # Make player 0 face left.
    env.rl_facing[0] = np.array([-1.0, 0.0], dtype=np.float32)

    env.possessor = ("rl", 0)
    env._attach_ball_to_possessor()

    # Player 0 passes to player 1.
    actions = np.array([11, 0, 0, 0, 0])

    _, reward, _, _, info = env.step(actions)

    assert info["pass_completed"] is True
    assert info["pass_intercepted"] is False

    assert env.possessor == ("rl", 1)

    # Completed pass contributes +0.03 reward.
    assert reward >= 0.03


def test_intercepted_pass_does_not_get_completion_reward() -> None:
    env = SoccerEnv()
    env.reset()

    env.rl_pos[0] = np.array([600.0, 300.0], dtype=np.float32)
    env.rl_pos[1] = np.array([500.0, 300.0], dtype=np.float32)

    env.rl_facing[0] = np.array([-1.0, 0.0], dtype=np.float32)

    # Put a scripted player between the passer and receiver.
    env.user_pos[0] = np.array([545.0, 300.0], dtype=np.float32)

    env.possessor = ("rl", 0)
    env._attach_ball_to_possessor()

    # Player 0 passes toward player 1.
    actions = np.array([11, 0, 0, 0, 0])

    _, reward, _, _, info = env.step(actions)

    assert info["pass_completed"] is False
    assert info["pass_intercepted"] is True

    assert env.possessor is not None
    assert env.possessor[0] == "user"

    # The intercepted pass should not receive the +0.03 completion reward.
    assert reward < 0.03


def test_action_space_supports_passing() -> None:
    env = SoccerEnv()

    valid_actions = np.array([0, 9, 10, 11, 14], dtype=np.int64)

    assert env.action_space.contains(valid_actions)

    invalid_actions = np.array([0, 9, 10, 11, 15], dtype=np.int64)

    assert not env.action_space.contains(invalid_actions)
    
def test_non_possessor_pass_gets_penalty():
    env = SoccerEnv()
    env.reset()

    # RL player 0 has possession.
    env.possessor = ("rl", 0)
    env._attach_ball_to_possessor()

    # Player 1 tries to pass to player 2.
    # Action 12 = pass-to-2.
    # Player 1 does not have the ball, so this should be invalid.
    actions = np.array([0, 12, 0, 0, 0])

    _, reward, _, _, _ = env.step(actions)

    assert reward < 0
    
def test_self_pass_gets_penalty():
    env = SoccerEnv()
    env.reset()

    # RL player 0 has possession.
    env.possessor = ("rl", 0)
    env._attach_ball_to_possessor()

    # Action 10 = pass-to-0.
    # Since player 0 already has the ball, this is a self-pass.
    actions = np.array([10, 0, 0, 0, 0])

    _, reward, _, _, _ = env.step(actions)

    assert reward < 0

def test_non_possessor_ball_actions_are_masked():
    env = SoccerEnv()
    env.reset()

    env.possessor = ("rl", 0)

    masks = env.action_masks()

    # Each player gets 15 mask entries.
    player_1_mask = masks[15:30]

    # Player 1 does not possess the ball.
    assert np.all(player_1_mask[:9])
    assert not np.any(player_1_mask[9:15])


def test_possessor_can_shoot_and_pass():
    env = SoccerEnv()
    env.reset()

    env.possessor = ("rl", 0)

    # Put the possessor in the attacking half so shooting is legal.
    env.rl_pos[0] = np.array([400.0, 300.0], dtype=np.float32)

    masks = env.action_masks()

    player_0_mask = masks[0:15]

    # Idle/movement + shooting should be valid.
    assert np.all(player_0_mask[:10])

    # Cannot pass to itself.
    assert player_0_mask[10] == False

    # Can pass to all other teammates.
    assert np.all(player_0_mask[11:15])
    
def test_shoot_is_masked_outside_attacking_half():
    env = SoccerEnv()
    env.reset()

    env.possessor = ("rl", 0)

    # RL attacks left, so x=900 is too far from the target goal.
    env.rl_pos[0] = np.array([900.0, 300.0], dtype=np.float32)

    masks = env.action_masks()
    player_0_mask = masks[:15]

    assert player_0_mask[9] == False
    
def test_shoot_is_allowed_in_attacking_half():
    env = SoccerEnv()
    env.reset()

    env.possessor = ("rl", 0)

    # x=400 is inside the attacking half.
    env.rl_pos[0] = np.array([400.0, 300.0], dtype=np.float32)

    masks = env.action_masks()
    player_0_mask = masks[:15]

    assert player_0_mask[9] == True
    
def test_dribbling_across_goal_line_does_not_score():
    env = SoccerEnv()
    env.reset()

    env.rl_pos[0] = np.array([0.0, 300.0], dtype=np.float32)
    env.rl_facing[0] = np.array([-1.0, 0.0], dtype=np.float32)
    env.possessor = ("rl", 0)

    env._attach_ball_to_possessor()

    reward = env._handle_goal_if_needed()

    assert env.rl_score == 0
    assert reward == 0.0
    assert env.ball_pos[0] >= 0.0


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
        test_valid_shot_gets_positive_reward,
        test_invalid_shot_gets_penalty,
        test_rl_player_can_pass_to_teammate,
        test_non_possessor_cannot_pass,
        test_self_pass_does_nothing,
        test_completed_pass_gets_positive_reward,
        test_intercepted_pass_does_not_get_completion_reward,
        test_action_space_supports_passing,
        test_non_possessor_pass_gets_penalty,
        test_self_pass_gets_penalty,
        test_non_possessor_ball_actions_are_masked,
        test_possessor_can_shoot_and_pass,
        test_shoot_is_masked_outside_attacking_half,
        test_shoot_is_allowed_in_attacking_half,
        test_dribbling_across_goal_line_does_not_score,
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
