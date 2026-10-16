import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from dotenv import load_dotenv
from pymongo import AsyncMongoClient
from beanie import init_beanie, Document
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

class Player(Document):
    source_id: int | None = None
    name: str
    pace: int
    shot: int
    
    
    class Settings:
        name = "players"
        # This declares which collection Player belongs to in MongoDB

class FormationSlot(BaseModel):
    x : float
    y : float

class Formation(Document):
    name: str
    slots: list[FormationSlot]
    
    class Settings:
        name = "formations"


@asynccontextmanager
async def lifespan(app: FastAPI):

    # Client is the connection between our application and the MongoDB cluster,
    # which we identify using the MONGODB_URI environment variable.
    # AsyncMongoClient lets us interact with MongoDB asynchronously.
    client = AsyncMongoClient(os.getenv("MONGODB_URI"))

    # Beanie is what translates between our Python models and MongoDB documents.
    # client.tactiq specifies which database we're using, while document_models
    # tells Beanie which Python classes correspond to collections in that database.
    await init_beanie(
        database=client.tactiq,
        document_models=[Player, Formation]
    )

    # yield pauses the lifespan function while FastAPI handles requests.
    # The MongoDB client stays available throughout the application's lifetime.
    # @asynccontextmanager allows FastAPI to use this function to manage startup
    # and shutdown.
    yield

    # Once FastAPI shuts down, execution resumes after yield.
    # We close the MongoDB client to release its connections and resources.
    await client.close()
    

# Dictates the app's lifecycle
app = FastAPI(lifespan=lifespan)

frontend_origins = os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:5173,http://localhost:4173"
).split(",")

print("ALLOWED FRONTEND ORIGINS:", frontend_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message" : "backend is running"}

@app.get("/players")
async def get_all_players():
    players = await Player.find_all().to_list()
    return players
    
@app.get("/players/{player_id}")
async def get_player(player_id : str):
    specific_player = await Player.get(player_id)
    if specific_player is None:
        raise HTTPException(status_code=404, detail=f"No player found with id {player_id}")
    
    return specific_player

# So basically frontend sends over json data and then because Player
# is a Pydantic model, FastAPI is able to clean the data
# and then create an actual Player object out of it called player
# If the json data isn't the correct format then it is rejected    
""" @app.post("/players")
async def create_player(player : Player):
    await player.insert()
    
    return player """

""" @app.put("/players/{player_id}")
async def update_player(player_id : str, player: Player):
    specific_player = await Player.get(player_id)
    if specific_player is None:
        raise HTTPException(status_code=404, detail=f"No player found with id {player_id}")
    
    # Updates specific_player's attributes to player, don't want to update ID which comes as none
    # in the JSON request
    await specific_player.set(player.model_dump(exclude={"id"})) 
    
    return specific_player """

""" @app.delete("/players/{player_id}")
async def delete_player(player_id : str):
    specific_player = await Player.get(player_id)
    if specific_player is None:
        raise HTTPException(status_code=404, detail=f"No player found with id {player_id}")
    await specific_player.delete()
    return {"message": f"Deleted player {player_id}"} """



### Formations Class

@app.get("/formations")
async def get_all_formations():
    formations = await Formation.find_all().to_list()
    return formations

@app.get("/formations/{formation_id}")
async def get_formation(formation_id : str):
    specific_formation = await Formation.get(formation_id)
    
    if specific_formation is None:
        raise HTTPException(status_code=404, detail=f"No formation found with id {formation_id}")
    
    return specific_formation

""" @app.post("/formations")
async def create_formation(formation : Formation):
    await formation.insert()
    
    return formation

@app.put("/formations/{formation_id}")
async def update_formation(formation_id : str, formation : Formation):
    specific_formation = await Formation.get(formation_id)
    
    if specific_formation is None:
        raise HTTPException(status_code=404, detail=f"No formation found with id {formation_id}") 
    
    await specific_formation.set(formation.model_dump(exclude={"id"}))
    
    return specific_formation
    
    
@app.delete("/formations/{formation_id}")
async def delete_formation(formation_id : str):
    specific_formation = await Formation.get(formation_id)
    if specific_formation is None:
        raise HTTPException(status_code=404, detail=f"No formation found with id {formation_id}") 
    
    await specific_formation.delete()
    return {"message" : f"Delete formation {formation_id}"}
    
 """
  
@app.get("/draft/players")
async def get_draft_players():
    players = await Player.aggregate([
        {"$sample": {"size": 10}},
        {"$project": {
            "_id": 0,
            "name": 1,
            "pace": 1,
            "shot": 1
        }}
    ]).to_list()

    return players