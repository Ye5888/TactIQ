import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

df = pd.read_csv(BASE_DIR / "FC26_20250921.csv")

df = df[["short_name", "pace", "shooting"]]

df = df.dropna()

df = df.rename(columns={
    "short_name": "name",
    "shooting": "shot"
})

df["pace"] = df["pace"].astype(int)
df["shot"] = df["shot"].astype(int)

df.to_csv("backend/players_cleaned.csv", index=False)