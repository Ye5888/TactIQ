import os
import csv
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")

uri = os.getenv("MONGODB_URI")

if not uri:
    raise RuntimeError("MONGODB_URI is missing")

client = MongoClient(uri)

try:
    # Connect to the same database used by FastAPI
    db = client["tactiq"]
    collection = db["players"]

    # Prevent duplicate source IDs
    collection.create_index(
        "source_id",
        unique=True,
        sparse=True
    )

    operations = []
    total = 0

    with open(BASE_DIR / "players_cleaned.csv", encoding="utf-8") as file:
        reader = csv.DictReader(file)

        for row in reader:
            player = {
                "source_id": int(row["source_id"]),
                "name": row["name"],
                "pace": int(row["pace"]),
                "shot": int(row["shot"])
            }

            operations.append(
                UpdateOne(
                    {"source_id": player["source_id"]},
                    {"$set": player},
                    upsert=True
                )
            )

            # Write 1,000 players at a time
            if len(operations) == 1000:
                collection.bulk_write(operations)
                total += len(operations)
                operations = []

        # Write any remaining players
        if operations:
            collection.bulk_write(operations)
            total += len(operations)

    print(f"Processed {total} players successfully!")
    print(f"Total documents in collection: {collection.count_documents({})}")

finally:
    client.close()