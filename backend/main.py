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
    
