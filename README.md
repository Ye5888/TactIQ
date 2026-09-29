# TactIQ

TactIQ is a browser-based 5-a-side futsal game where the player chooses
a formation, drafts a squad, and plays a full two-minute match against a
reinforcement-learning opponent.

The project combines a **TypeScript/Phaser game**, **React/Vite
frontend**, **FastAPI + MongoDB backend**, and a custom **Gymnasium +
MaskablePPO** training pipeline. The trained policy is exported from
PyTorch to **ONNX** and executed directly in the browser with **ONNX
Runtime Web**.

## Project Status

TactIQ is in the final integration and polish stage.

- ✅ Formation selection and five-player squad draft
- ✅ Full 5v5 Phaser match loop
- ✅ Player movement, possession, dribbling, shooting, ball physics,
  walls, goals, scoring, timer, and win/loss flow
- ✅ Proximity-based user player switching
- ✅ FastAPI + MongoDB/Beanie backend for players and formations
- ✅ Custom 5v5 Gymnasium training environment
- ✅ MaskablePPO opponent with movement, shooting, and teammate-targeted
  passing
- ✅ Role-randomized RL training
- ✅ Behavior-level evaluation for shots, passes, possession, goals, and
  action usage
- ✅ Final PPO checkpoint selected
- ✅ PyTorch policy exported to ONNX
- ✅ ONNX output verified against the original MaskablePPO policy
- ✅ Browser-side observation construction and action masking
- ✅ Client-side ONNX inference integrated into the Phaser match
- ✅ PPO-controlled movement, shooting, passing, and receiving working
  in gameplay
- 🚧 Final Python ↔ Phaser parity cleanup and edge-case testing
- ⬜ Final UI/gameplay polish
- ⬜ Production deployment

## Gameplay

A TactIQ match follows three scenes:

``` text
Formation Select
      ↓
Draft 5 Players
      ↓
2-Minute 5v5 Match
      ↓
Final Score / Result
```

The user controls the white team and attacks the right goal. The
RL-controlled red team attacks the left goal.

During the match:

- the controlled user player automatically switches to the teammate
  nearest the ball
- arrow keys move the active player
- space kicks the ball in the player’s facing direction
- possession is acquired when a player comes within pickup range
- the RL team makes a new policy decision every 100 ms
- the match ends after 120 seconds and displays the final result

## Architecture

``` text
                         TactIQ
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
      Frontend           Backend          RL Pipeline
   React + Phaser       FastAPI          Gymnasium
   TypeScript           Beanie           MaskablePPO
   Vite                 MongoDB           PyTorch
          │                 │                 │
          │                 │                 ▼
          │                 │           Trained Policy
          │                 │                 │
          │                 │                 ▼
          │                 │              ONNX
          │                 │                 │
          └─────────────────┴─────────────────┘
                            │
                            ▼
                  Browser ONNX Inference
```

React provides the application shell and creates the Phaser game. Phaser
owns the actual game lifecycle and scenes. Formation and roster data are
loaded from the FastAPI backend, while the RL opponent runs entirely
client-side during the match.

## Tech Stack

### Frontend / Game

- TypeScript
- React
- Phaser 3
- Vite
- ONNX Runtime Web

### Backend

- Python
- FastAPI
- MongoDB
- Beanie ODM
- Motor

### Reinforcement Learning

- Gymnasium
- PyTorch
- Stable-Baselines3
- sb3-contrib / MaskablePPO
- NumPy
- TensorBoard
- ONNX
- ONNX Runtime

## Reinforcement-Learning Opponent

### Training Environment

The opponent is trained in `rl/soccer_env.py`, a lightweight custom
Gymnasium environment designed to reproduce the mechanics that matter to
the policy without rendering the Phaser game.

The environment models:

- a 1200 × 600 pitch
- five user players and five RL players
- 120-second matches
- possession and ball attachment
- shooting and distance-based shot inaccuracy
- teammate-targeted passing
- pass receiving and interceptions
- ball drag and wall bouncing
- goals and kickoff resets
- randomized RL starting roles and positions
- a scripted opposing team for offline training

The RL team attacks left, matching the red opponent team in the browser
game.

### Observation Space

Each policy observation contains **37 normalized values**:

``` text
User player positions        5 × (x, y) = 10
RL player positions          5 × (x, y) = 10
Ball position                            =  2
Ball velocity                            =  2
Possession one-hot                      = 11
Score difference                        =  1
Time remaining                          =  1
                                          --
Total                                   = 37
```

Position values are normalized to `[-1, 1]`. The observation also tells
the policy who has possession, the RL/user score difference, and how
much of the match remains.

### Action Space

Each of the five RL players chooses from **15 actions**:

``` text
0       idle
1       up
2       down
3       left
4       right
5       up-left
6       up-right
7       down-left
8       down-right
9       shoot
10-14   pass to RL player 0-4
```

The policy therefore produces **75 action logits** per decision:

``` text
5 players × 15 actions = 75 logits
```

### Action Masking

TactIQ uses `MaskablePPO` so the policy cannot select actions that are
illegal for the current game state.

For example:

- players without possession cannot shoot
- players without possession cannot pass
- the possessing player cannot pass to itself
- movement remains available to every player

The same masking rules are reproduced in TypeScript before browser
actions are selected.

### Reward Design

The reward function keeps the actual match result as the main objective
while adding smaller shaping signals for useful soccer behavior.

The environment rewards or encourages:

- scoring goals
- winning the final match
- advancing the ball toward the opponent’s goal
- taking better-quality shots
- moving toward an intended pass as the receiver

It also applies small penalties to invalid ball actions. Action masks
handle most invalid decisions directly so the policy does not have to
learn basic game legality through punishment alone.

## Training and Evaluation

Training went through several iterations because high scores did not
always mean the policy had learned believable soccer.

Examples of behaviors uncovered during development included:

- exploiting goal detection while the ball was still attached to a
  player
- shooting too frequently when shots were overly accurate
- abandoning shooting when passing incentives became too attractive
- learning receiver preferences tied to fixed player IDs

Those failures led to changes such as:

- requiring the ball to be released before a goal can count
- distance-based shooting inaccuracy
- explicit teammate-targeted pass actions
- receiver movement toward an in-flight pass
- pass completion/interception tracking
- action masking
- randomized RL player IDs across formation slots
- randomized starting-position jitter
- richer evaluation telemetry instead of relying only on win/loss record

A selected final checkpoint, `role_randomized_finetuned_500k`, produced
the following 20-match evaluation during development:

``` text
Record:             19W - 1D - 0L
Goals:              96 - 19
Valid shots:        187
Pass attempts:      345
Completed passes:   265
Intercepted passes: 77
```

Evaluation also tracks possession events, shot locations, pass
distances, pass targets, goal types, action usage, and
receiver-selection behavior.

## Browser Model Deployment

The deployed opponent does **not** run Stable-Baselines3 or Python
during gameplay.

Instead:

``` text
MaskablePPO checkpoint
        │
        ▼
PyTorch policy
        │ export_model.py
        ▼
ONNX model
        │
        ▼
ONNX Runtime Web
        │
        ▼
Phaser game state
        │
        ├── buildObservation() → 37 floats
        ├── buildActionMask()  → 75 booleans
        │
        ▼
75 policy logits
        │
        ▼
highest-scoring legal action
for each of 5 RL players
        │
        ▼
Phaser movement / shot / pass
```

`rl/export_model.py` exports the policy’s raw action logits. The browser
then applies the same legal-action mask used during training and
deterministically selects the highest-scoring legal action for each
player.

### Export Verification

`rl/verify_onnx.py` runs the original MaskablePPO policy and the
exported ONNX policy on the same observations and action masks.

The selected export was tested across **1,000 policy decisions** and
produced:

``` text
Matching decisions: 1000/1000
Match rate: 100.00%
```

This verifies that the ONNX export preserves the deterministic action
decisions of the original PyTorch policy before browser integration.

## Backend API

The FastAPI backend stores players and formations in MongoDB through
Beanie.

### Players

``` text
GET     /players
GET     /players/{player_id}
POST    /players
PUT     /players/{player_id}
DELETE  /players/{player_id}
```

A player currently contains:

``` text
name
pace
shot
```

### Formations

``` text
GET     /formations
GET     /formations/{formation_id}
POST    /formations
PUT     /formations/{formation_id}
DELETE  /formations/{formation_id}
```

Each formation contains a name and a list of normalized `(x, y)`
formation slots.

## Running Locally

### Prerequisites

You will need:

- Node.js / npm
- Python
- MongoDB Atlas or another reachable MongoDB instance
- the trained RL checkpoint if you want to recreate the browser ONNX
  model

Model artifacts are intentionally excluded from Git by `.gitignore`.

### 1. Backend

``` bash
cd backend

python -m venv venv
source venv/bin/activate
# Windows: venv\Scripts\activate

pip install -r requirements.txt
```

Create `backend/.env`:

``` text
MONGODB_URI=your-mongodb-connection-string
```

Start FastAPI:

``` bash
python -m uvicorn main:app --reload
```

The API runs at:

``` text
http://127.0.0.1:8000
```

Interactive FastAPI documentation is available at:

``` text
http://127.0.0.1:8000/docs
```

### 2. RL Environment

From the repository root:

``` bash
cd rl

python -m venv venv
source venv/bin/activate
# Windows: venv\Scripts\activate

pip install -r requirements.txt
pip install sb3-contrib pytest
```

Run the environment tests:

``` bash
python -m pytest
```

Train using the checkpoint and timestep configuration currently defined
in `train.py`:

``` bash
python train.py
```

Evaluate the selected policy:

``` bash
python evaluate.py
```

### 3. Export the PPO Policy to ONNX

The current export script expects:

``` text
rl/models/role_randomized_finetuned_500k.zip
```

Place that checkpoint in `rl/models/`, then run:

``` bash
python export_model.py
```

This creates:

``` text
rl/models/tactiq_v1.onnx
```

Verify the ONNX policy against MaskablePPO:

``` bash
python verify_onnx.py
```

### 4. Make the Model Available to the Browser

From `rl/`:

``` bash
mkdir -p ../frontend/public/models
cp models/tactiq_v1.onnx ../frontend/public/models/tactiq_v1.onnx
```

The browser policy loader expects the model at:

``` text
/models/tactiq_v1.onnx
```

Because `*.onnx` and `rl/models/` are currently ignored by Git, this
step is required after a clean clone unless the model is supplied
through the deployment process.

### 5. Frontend

In another terminal:

``` bash
cd frontend
npm install
npm run dev
```

Vite normally serves the frontend at:

``` text
http://localhost:5173
```

The backend should also be running because the formation-selection and
draft scenes fetch their data from FastAPI.

## Project Structure

``` text
TactIQ/
├── backend/
│   ├── main.py                  # FastAPI app, Beanie models, CRUD routes
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   │   └── models/              # Local/deployed ONNX model location
│   ├── src/
│   │   ├── data/
│   │   │   ├── formations.ts
│   │   │   └── roster.ts
│   │   ├── entities/
│   │   │   └── Player.ts
│   │   ├── rl/
│   │   │   ├── observation.ts   # Builds the 37-value browser observation
│   │   │   ├── actionMask.ts    # Recreates training-time legal actions
│   │   │   └── onnxPolicy.ts    # Loads ONNX and selects PPO actions
│   │   ├── scenes/
│   │   │   ├── FormationSelectScene.ts
│   │   │   ├── DraftScene.ts
│   │   │   └── MainScene.ts
│   │   └── App.tsx
│   └── package.json
│
├── rl/
│   ├── soccer_env.py            # Custom Gymnasium 5v5 environment
│   ├── train.py                 # MaskablePPO training
│   ├── evaluate.py              # Match + behavior evaluation
│   ├── test_env.py              # Environment/mechanics tests
│   ├── export_model.py          # PyTorch/MaskablePPO → ONNX
│   ├── verify_onnx.py           # ONNX ↔ original policy verification
│   └── requirements.txt
│
├── .gitignore
└── README.md
```

## Key Engineering Challenges

TactIQ has required keeping the behavior of two separate game
implementations aligned:

1.  the lightweight Python environment used for RL training
2.  the Phaser implementation the player actually sees in the browser

Small differences in possession, goal detection, movement speed,
passing, shooting, or observations can change what the deployed policy
experiences. The browser integration therefore recreates the training
observation format, action masks, action meanings, and important
physics/gameplay rules as closely as possible.

Another major challenge was exporting a `MaskablePPO` policy for the
browser. Rather than attempting to deploy Stable-Baselines3 itself, the
project exports only the neural network’s raw policy logits to ONNX.
Action masking and deterministic action selection are then implemented
directly in TypeScript.

## Current Limitations / Next Steps

The core game and RL browser integration are functional. Remaining work
is focused on finishing rather than adding major mechanics:

- complete the final Python ↔ Phaser parity pass
- run additional full-match and edge-case testing
- remove temporary model/debug logging
- polish game presentation and UI
- finalize how the ONNX artifact is packaged for production
- deploy the frontend and backend

## Why TactIQ?

TactIQ started as a browser soccer game and grew into an end-to-end
reinforcement-learning deployment project. It covers the full path from
designing game mechanics and a backend, to creating a custom RL
environment, training and evaluating a multi-agent-style policy,
exporting the trained network, validating the export, and running that
policy inside a real browser game.
