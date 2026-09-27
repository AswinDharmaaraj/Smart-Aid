"""
SmartAid AI — Synthetic Clinical Dataset Generator (Sprint 3)
Generates 10,000 realistic clinical triage records with accurate severity labels
and realistic missing values to test preprocessing and RandomForest classification.
"""

import random
import numpy as np
import pandas as pd
from pathlib import Path

# Set random seeds for reproducibility
np.random.seed(42)
random.seed(42)

NUM_ROWS = 10000

CATEGORIES = [
    "Cardiac",
    "Respiratory",
    "Burn",
    "Injury",
    "Snake bite",
    "Electric shock",
    "Poisoning",
    "Fever/Infection",
    "General",
    "Gastrointestinal",
    "Neurological",
]

SEXES = ["Male", "Female", "Other"]

BINARY_SYMPTOMS = [
    "chest_pain",
    "difficulty_breathing",
    "sweating",
    "nausea",
    "dizziness",
    "unconsciousness",
    "bleeding",
    "burn",
    "fever",
    "cough",
    "seizure",
    "abdominal_pain",
    "headache",
    "weakness",
    "injury",
]


def generate_record(idx: int) -> dict:
    patient_id = f"SA{100000 + idx}"
    category = random.choice(CATEGORIES)
    sex = random.choice(SEXES)
    age = round(float(np.random.gamma(shape=5.0, scale=8.0)), 1)
    age = float(np.clip(age, 1.0, 95.0))

    # Initialize all binary symptoms to 0
    symptoms = {s: 0.0 for s in BINARY_SYMPTOMS}

    # Default baseline vitals
    hr = float(np.random.normal(78, 12))
    temp = float(np.random.normal(36.8, 0.5))
    spo2 = float(np.random.normal(97.5, 1.8))
    duration = float(np.random.exponential(35)) + 5

    # Category specific profile generation
    if category == "Cardiac":
        if random.random() < 0.7:
            symptoms["chest_pain"] = 1.0
        if random.random() < 0.5:
            symptoms["sweating"] = 1.0
        if random.random() < 0.4:
            symptoms["difficulty_breathing"] = 1.0
        if random.random() < 0.3:
            symptoms["dizziness"] = 1.0
        if random.random() < 0.15:
            symptoms["unconsciousness"] = 1.0
        hr += random.choice([-25, 35, 45, 10])
        spo2 -= random.choice([0, 2, 5, 8, 12])

    elif category == "Respiratory":
        symptoms["difficulty_breathing"] = 1.0
        if random.random() < 0.6:
            symptoms["cough"] = 1.0
        if random.random() < 0.3:
            symptoms["chest_pain"] = 1.0
        if random.random() < 0.2:
            symptoms["unconsciousness"] = 1.0
        spo2 -= random.choice([3, 6, 10, 15, 20])
        hr += random.choice([15, 25, 35])

    elif category == "Burn":
        symptoms["burn"] = 1.0
        if random.random() < 0.3:
            symptoms["weakness"] = 1.0
        if random.random() < 0.2:
            symptoms["sweating"] = 1.0

    elif category == "Injury":
        symptoms["injury"] = 1.0
        if random.random() < 0.5:
            symptoms["bleeding"] = 1.0
        if random.random() < 0.25:
            symptoms["weakness"] = 1.0

    elif category == "Snake bite":
        symptoms["injury"] = 1.0
        if random.random() < 0.6:
            symptoms["bleeding"] = 1.0
        if random.random() < 0.5:
            symptoms["dizziness"] = 1.0
        if random.random() < 0.4:
            symptoms["nausea"] = 1.0
        if random.random() < 0.3:
            symptoms["unconsciousness"] = 1.0
        hr += random.choice([20, 35, 50])

    elif category == "Electric shock":
        symptoms["burn"] = 1.0
        if random.random() < 0.4:
            symptoms["unconsciousness"] = 1.0
        if random.random() < 0.3:
            symptoms["difficulty_breathing"] = 1.0
        if random.random() < 0.3:
            symptoms["seizure"] = 1.0

    elif category == "Poisoning":
        symptoms["nausea"] = 1.0
        if random.random() < 0.6:
            symptoms["abdominal_pain"] = 1.0
        if random.random() < 0.4:
            symptoms["dizziness"] = 1.0
        if random.random() < 0.35:
            symptoms["unconsciousness"] = 1.0

    elif category == "Fever/Infection":
        symptoms["fever"] = 1.0
        temp += random.choice([1.2, 2.1, 2.8, 3.4])
        if random.random() < 0.6:
            symptoms["cough"] = 1.0
        if random.random() < 0.5:
            symptoms["headache"] = 1.0
        if random.random() < 0.4:
            symptoms["weakness"] = 1.0

    elif category == "Neurological":
        if random.random() < 0.6:
            symptoms["seizure"] = 1.0
        if random.random() < 0.5:
            symptoms["unconsciousness"] = 1.0
        if random.random() < 0.5:
            symptoms["headache"] = 1.0
        if random.random() < 0.4:
            symptoms["dizziness"] = 1.0

    elif category == "Gastrointestinal":
        symptoms["abdominal_pain"] = 1.0
        if random.random() < 0.6:
            symptoms["nausea"] = 1.0
        if random.random() < 0.3:
            symptoms["weakness"] = 1.0

    else:  # General
        active_syms = random.sample(BINARY_SYMPTOMS, k=random.randint(1, 3))
        for s in active_syms:
            symptoms[s] = 1.0

    # Clip vitals to realistic bounds
    hr = float(np.clip(hr, 35.0, 180.0))
    temp = float(np.clip(temp, 34.5, 41.5))
    spo2 = float(np.clip(spo2, 65.0, 100.0))
    duration = float(np.clip(duration, 1.0, 1440.0))

    # Construct text snippet from active symptoms
    present = [k.replace("_", " ") for k, v in symptoms.items() if v == 1.0]
    symptom_text = " and ".join(present) if present else "general malaise"

    # Clinical Triage Rule Engine for Accurate Target Label Assignment
    # 1. Critical
    if (
        symptoms["unconsciousness"] == 1.0
        or symptoms["seizure"] == 1.0
        or category in ["Snake bite", "Electric shock"] and (symptoms["unconsciousness"] == 1.0 or symptoms["difficulty_breathing"] == 1.0 or spo2 < 90)
        or spo2 < 88.0
        or hr > 145.0
        or hr < 42.0
        or (category == "Cardiac" and symptoms["chest_pain"] == 1.0 and (symptoms["sweating"] == 1.0 or symptoms["difficulty_breathing"] == 1.0 or age > 55 or spo2 < 93.0))
        or (category == "Respiratory" and symptoms["difficulty_breathing"] == 1.0 and spo2 < 91.0)
        or (symptoms["bleeding"] == 1.0 and hr > 125.0)
    ):
        severity = "Critical"

    # 2. Urgent
    elif (
        (category == "Cardiac" and symptoms["chest_pain"] == 1.0)
        or (symptoms["difficulty_breathing"] == 1.0 and spo2 <= 94.0)
        or (symptoms["bleeding"] == 1.0 and symptoms["injury"] == 1.0)
        or (symptoms["burn"] == 1.0 and (age < 12 or age > 60 or duration < 30))
        or (symptoms["fever"] == 1.0 and temp > 39.2)
        or (symptoms["abdominal_pain"] == 1.0 and hr > 105.0)
        or (symptoms["seizure"] == 1.0)
        or (symptoms["unconsciousness"] == 1.0)
        or spo2 < 92.0
        or hr > 120.0
    ):
        severity = "Urgent"

    # 3. Moderate
    elif (
        symptoms["burn"] == 1.0
        or (symptoms["fever"] == 1.0 and temp >= 38.0)
        or (symptoms["difficulty_breathing"] == 1.0)
        or (symptoms["chest_pain"] == 1.0)
        or (symptoms["dizziness"] == 1.0 and symptoms["nausea"] == 1.0)
        or (symptoms["cough"] == 1.0 and symptoms["fever"] == 1.0)
        or (symptoms["injury"] == 1.0)
        or (symptoms["abdominal_pain"] == 1.0)
        or (symptoms["headache"] == 1.0 and symptoms["weakness"] == 1.0)
        or hr > 100.0
        or temp > 37.8
    ):
        severity = "Moderate"

    # 4. Low
    else:
        severity = "Low"

    # Introduce realistic missing values (NaN) for preprocessing testing
    # 5-8% random missing rate in vitals / demographics / optional columns
    record = {
        "patient_id": patient_id,
        "age": age if random.random() > 0.05 else np.nan,
        "sex": sex if random.random() > 0.04 else np.nan,
        "emergency_category": category if random.random() > 0.03 else np.nan,
        "symptom_text": symptom_text,
        **{col: (val if random.random() > 0.02 else np.nan) for col, val in symptoms.items()},
        "symptom_duration_min": duration if random.random() > 0.06 else np.nan,
        "heart_rate_bpm": round(hr, 1) if random.random() > 0.07 else np.nan,
        "temperature_c": round(temp, 1) if random.random() > 0.07 else np.nan,
        "spo2_percent": round(spo2, 1) if random.random() > 0.06 else np.nan,
        "severity": severity,
    }

    return record


def main():
    print(f"Generating {NUM_ROWS:,} realistic clinical triage dataset records...")
    records = [generate_record(i) for i in range(NUM_ROWS)]
    df = pd.DataFrame(records)

    target_path = Path(__file__).resolve().parent.parent / "data" / "smartaid_ai_test_dataset1.csv"
    target_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(target_path, index=False)

    print(f"Dataset successfully saved to: {target_path}")
    print(f"Rows: {len(df):,} | Columns: {len(df.columns)}")
    print("\nSeverity Class Distribution:")
    print(df["severity"].value_counts())
    print("\nMissing Values Count per Column:")
    print(df.isnull().sum()[df.isnull().sum() > 0])


if __name__ == "__main__":
    main()
