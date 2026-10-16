import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

df = pd.read_csv(
    BASE_DIR / "FC26_20250921.csv",
    usecols=["player_id", "short_name", "pace", "shooting"]
)

df = df[["player_id", "short_name", "pace", "shooting"]]

df = df.dropna()

df = df.rename(columns={
    "player_id": "source_id",
    "short_name": "name",
    "shooting": "shot"
})

df["source_id"] = df["source_id"].astype(int)
df["pace"] = df["pace"].astype(int)
df["shot"] = df["shot"].astype(int)

df.to_csv(BASE_DIR / "players_cleaned.csv", index=False)

print(f"Cleaned {len(df)} players")