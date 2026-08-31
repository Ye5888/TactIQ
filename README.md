# TactIQ

A browser-based 5-a-side futsal game, styled after Dream League Soccer: pick a formation, draft a squad into it, and play a full match against a computer opponent. Built as a learning project to go deep on a full stack — game physics, a real backend/database, and (in progress) a reinforcement-learning opponent — end to end.

## Status

The game itself is fully playable, backed by a real API and database. A reinforcement-learning opponent is the current focus, not yet built.

- ✅ Formation select → squad draft → full 5v5 match with scoring, a timer, and win/loss
- ✅ FastAPI + MongoDB backend with full CRUD for players and formations
- ✅ Frontend fetches live data from the backend instead of hardcoded arrays
- 🚧 A dribbling/possession mechanic (ball follows the controlling player instead of just bouncing off contact)
- ⬜ RL-trained opponent (PyTorch + Stable-Baselines3 → ONNX → TensorFlow.js), replacing the current scripted AI

See [`docs/DESIGN.md`](docs/DESIGN.md) for the full architecture and design rationale, and [`docs/DEBUGGING_LOG.md`](docs/DEBUGGING_LOG.md) for a running log of real bugs hit and how they were diagnosed.

## Tech stack

- **Frontend**: TypeScript, Phaser 3 (game/physics), React + Vite (shell)
- **Backend**: FastAPI, MongoDB Atlas, Beanie (Pydantic-based ODM)
- **Planned**: Gymnasium, Stable-Baselines3 (PPO), ONNX, TensorFlow.js

## Running it locally

**Backend**
```
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```
Create a `backend/.env` file with a MongoDB Atlas connection string:
```
MONGODB_URI=your-connection-string-here
```
Then start the server:
```
python -m uvicorn main:app --reload
```
API docs available at `http://127.0.0.1:8000/docs`.

**Frontend**
```
cd frontend
npm install
npm run dev
```
Opens at `http://localhost:5173`.

## Project structure

```
TactIQ/
├── frontend/
│   ├── src/scenes/       # Phaser scenes: FormationSelect, Draft, Main
│   ├── src/entities/     # Player entity
│   └── src/data/         # Shared types (formations, roster)
├── backend/
│   └── main.py           # FastAPI app: Player/Formation models + CRUD
└── docs/
    ├── DESIGN.md
    └── DEBUGGING_LOG.md
```
