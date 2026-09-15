# TactIQ

A browser-based 5-a-side futsal game where players choose a formation, draft a squad, and play a full match against a computer opponent. TactIQ is a full-stack learning project spanning browser game development, backend/database design, and reinforcement learning.

## Status

The core game, drafting flow, and backend are complete. Phase 4 is focused on training and balancing a reinforcement-learning opponent before integrating the final policy into the browser.

- ✅ Formation select → squad draft → full 5v5 match with scoring, timer, and win/loss flow
- ✅ Custom Phaser gameplay with movement, possession/dribbling, ball physics, shooting, goal detection, formations, and proximity-based player switching
- ✅ React + Vite shell around the Phaser game
- ✅ FastAPI + MongoDB/Beanie backend with CRUD for players and formations
- ✅ Custom Gymnasium environment for offline RL training and evaluation
- ✅ MaskablePPO agent using PyTorch, Stable-Baselines3, and sb3-contrib
- ✅ State-dependent action masking for movement, shooting, and teammate-targeted passing
- 🚧 Reward/behavior tuning for more believable passing, receiving, advancing, and shooting
- ⬜ Freeze/export the final trained policy and integrate client-side inference into the Phaser match
- ⬜ Final gameplay polish and deployment

See [`docs/DESIGN.md`](docs/DESIGN.md) for the architecture and design rationale, and [`docs/DEBUGGING_LOG.md`](docs/DEBUGGING_LOG.md) for a chronological record of bugs, RL experiments, failure modes, and fixes.

## Tech stack

- **Game / frontend:** TypeScript, Phaser 3, React, Vite
- **Backend:** Python, FastAPI, MongoDB Atlas, Beanie
- **Reinforcement learning:** Gymnasium, PyTorch, Stable-Baselines3, sb3-contrib (MaskablePPO), NumPy
- **Planned browser inference:** client-side model inference; the final export/runtime path is still being validated

## How the RL opponent works

The browser game currently uses scripted opponent decisions while candidate RL policies are trained offline in `SoccerEnv`, a custom Gymnasium environment that reproduces the important match mechanics.

Each environment step provides the policy with a compact numerical observation describing the ball, possession, and player state. The policy chooses one action for each of the five RL-controlled players. The current per-player action space contains 15 choices:

- idle and eight movement directions
- shoot
- pass to teammate 0–4

`MaskablePPO` is used because some actions are illegal depending on the game state. For example, a player without possession cannot shoot or pass, a player cannot pass to itself, and shooting is only enabled inside the configured attacking zone. Encoding these rules as action masks prevents the policy from wasting training on actions that should never be legal.

The reward function combines the actual match objective (scoring and preventing goals) with smaller shaping signals for useful behavior such as advancing possession, completing passes, and creating viable shots. Evaluation tracks behavior-level telemetry in addition to wins and losses because high win rates alone can hide reward or physics exploits.

The target behavior is not an unbeatable opponent; it is a believable one:

`gain possession → advance → pass → receive → move → shoot`

## RL development lessons

Training the opponent has involved several iterations where apparently strong results exposed weaknesses in the environment rather than genuinely good soccer behavior. Examples include policies learning to exploit attached-ball goal detection, overusing shooting when it was too accurate, and abandoning shooting when passing rewards became too attractive.

Those failures led to several changes:

- goal detection now requires the ball to be released rather than allowing a possessed ball to score
- invalid state-dependent actions are masked instead of relying only on reward penalties
- shooting is restricted to a physically reachable attacking zone
- shot inaccuracy varies with distance
- passing has explicit teammate-target actions and completion/interception telemetry
- evaluation records shot origins, possession locations, pass outcomes, goal types, and action usage rather than relying only on W/D/L

A recent capable baseline reached **17W–3D–0L** over 20 evaluation episodes and scored **218–54**, but it still heavily favored shooting and completed only one of 30 passes. Current work is therefore focused on improving team play without destroying the agent's ability to acquire possession and score.

## Running it locally

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env` with a MongoDB Atlas connection string:

```text
MONGODB_URI=your-connection-string-here
```

Then start the API:

```bash
python -m uvicorn main:app --reload
```

FastAPI's interactive API documentation is available at `http://127.0.0.1:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite development server normally opens at `http://localhost:5173`.

### RL

```bash
cd rl
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Run the environment tests before training:

```bash
python -m pytest
```

Train a candidate policy with the desired timestep budget, for example:

```bash
python train.py 100000
```

Then evaluate the trained policy with:

```bash
python evaluate.py
```

## Project structure

```text
TactIQ/
├── frontend/
│   └── src/
│       ├── scenes/       # Phaser scenes: formation select, draft, match
│       ├── entities/     # Player/game entities
│       └── data/         # Shared frontend types and game data
├── backend/
│   └── main.py           # FastAPI models and API routes
├── rl/
│   ├── soccer_env.py     # Custom Gymnasium soccer environment
│   ├── train.py          # MaskablePPO training
│   ├── evaluate.py       # Evaluation + behavior telemetry
│   └── test_env.py       # Environment/mechanics tests
└── docs/
    ├── DESIGN.md
    └── DEBUGGING_LOG.md
```

## Next steps

1. Balance passing, receiving, shooting, and possession behavior and preserve promising model checkpoints.
2. Freeze a final policy once its behavior is believable across repeated evaluations.
3. Export the model to a browser-compatible runtime and reproduce the observation/action mapping in TypeScript.
4. Replace the scripted opponent decision path in the Phaser match with policy inference.
5. Add final visual/gameplay polish, persistence where useful, and deploy the application.
