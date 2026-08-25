import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie, Document

load_dotenv()

class Player(Document):
    name: str
    pace: int
    shot: int
    
    
    class Settings:
        name = "players"
        # This declares which collection Player belongs to in MongoDB
        


@asynccontextmanager
async def lifespan(app: FastAPI):
    
    # Client is the line between the cluster (reference by MONGODB_URI) and our code
    client = AsyncIOMotorClient(os.getenv("MONGODB_URI"))
    
    # Beanie is what translates between our code and the database - knows which is our
    # through client.tactiq, and document_models provides the models for documents
    await init_beanie(database=client.tactiq, document_models=[Player])
    yield
    
    # yield pauses the function, leaving client alive and open for as long
    # as nothing runs past that point. @asynccontextmanager converts that
    # yield-based function into the proper shape FastAPI needs, so it can
    # actually be plugged in via lifespan=lifespan
    

# Dictates the app's lifecycle
app = FastAPI(lifespan=lifespan)


@app.get("/")
def read_root():
    return {"message" : "backend is running"}

@app.get("/players")
async def get_players():
    players = await Player.find_all().to_list()
    return players
    
# So basically frontend sends over json data and then because Player
# is a Pydantic model, FastAPI is able to clean the data
# and then create an actual Player object out of it called player
# If the json data isn't the correct format then it is rejected    
@app.post("/players")
async def create_player(player : Player):
    await player.insert()
    
    return player

@app.put("/players/{player_id}")
async def update_player(player_id : str, player: Player):
    specific_player = await Player.get(player_id)
    
    # Updates specific_player's attributes to player, don't want to update ID which comes as none
    # in the JSON request
    await specific_player.set(player.model_dump(exclude={"id"})) 
    
    return specific_player

@app.delete("/players/{player_id}")
async def delete_player(player_id : str):
    specific_player = await Player.get(player_id)
    await specific_player.delete()
    return {"message": f"Deleted player {player_id}"}