"""
SmartAid AI — Sprint 3: Random Forest Severity Model Training Script

This script:
  1. Loads backend/data/smartaid_ai_test_dataset1.csv
  2. Validates columns and target classes
  3. Builds a scikit-learn Pipeline (preprocessing + RandomForestClassifier)
  4. Trains on 80% of the data (stratified split)
  5. Evaluates on the held-out 20% test set
  6. Saves the full pipeline to backend/app/ml_models/severity_random_forest.joblib
  7. Saves evaluation metrics to backend/ml_results/severity_model_metrics.json

Usage:
    cd backend
    python scripts/train_severity_model.py
"""

import sys
import os
import json
from pathlib import Path

# ── Allow importing from project root ─────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
sys.path.insert(0, str(BASE_DIR))

import pandas as pd
import numpy as np
import joblib

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix,
)

# ── Paths ──────────────────────────────────────────────────────────────────────
DATASET_PATH  = BASE_DIR / "data" / "smartaid_ai_test_dataset1.csv"
MODEL_DIR     = BASE_DIR / "app" / "ml_models"
METRICS_DIR   = BASE_DIR / "ml_results"
MODEL_PATH    = MODEL_DIR / "severity_random_forest.joblib"
METRICS_PATH  = METRICS_DIR / "severity_model_metrics.json"

MODEL_DIR.mkdir(parents=True, exist_ok=True)
METRICS_DIR.mkdir(parents=True, exist_ok=True)

# ── Feature definitions ────────────────────────────────────────────────────────
NUMERICAL_FEATURES = [
    "age",
    "symptom_duration_min",
    "heart_rate_bpm",
    "temperature_c",
    "spo2_percent",
]

CATEGORICAL_FEATURES = [
    "sex",
    "emergency_category",
]

BINARY_SYMPTOM_FEATURES = [
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

ALL_FEATURES = NUMERICAL_FEATURES + CATEGORICAL_FEATURES + BINARY_SYMPTOM_FEATURES
TARGET       = "severity"

# Ordered severity classes (same as SeverityEnum in the app)
SEVERITY_CLASSES = ["Low", "Moderate", "Urgent", "Critical"]


def load_and_validate_dataset(path: Path) -> pd.DataFrame:
    print(f"\n[1/6] Loading dataset from: {path}")
    df = pd.read_csv(path)

    print(f"      Rows: {len(df):,}  |  Columns: {len(df.columns)}")

    required_cols = set(ALL_FEATURES + [TARGET])
    missing_cols  = required_cols - set(df.columns)
    if missing_cols:
        raise ValueError(f"Dataset is missing required columns: {missing_cols}")

    # Drop patient_id and symptom_text (must not be used as features)
    df = df.drop(columns=["patient_id", "symptom_text"], errors="ignore")

    # Drop rows where the target label is missing (cannot train without a label)
    before = len(df)
    df = df.dropna(subset=[TARGET])
    after  = len(df)
    if before != after:
        print(f"      Dropped {before - after} rows with missing '{TARGET}' label.")

    # Validate target classes
    unique_classes = set(df[TARGET].unique())
    unexpected     = unique_classes - set(SEVERITY_CLASSES)
    if unexpected:
        print(f"  [WARNING] Unexpected target classes found: {unexpected}  — they will be ignored by the model.")

    print(f"      Target class distribution:\n{df[TARGET].value_counts().to_string()}")
    print(f"      Missing value summary (selected columns):")
    missing_summary = df[ALL_FEATURES].isnull().sum()
    print(missing_summary[missing_summary > 0].to_string())

    return df


def build_pipeline() -> Pipeline:
    """Construct a scikit-learn Pipeline combining preprocessing + RandomForest."""

    # Numerical: median imputation (robust to outliers and missing)
    numerical_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
    ])

    # Categorical: most-frequent imputation + one-hot encoding
    categorical_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])

    # Binary symptoms: constant 0 imputation (absence of flag = symptom not present)
    binary_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="constant", fill_value=0)),
    ])

    preprocessor = ColumnTransformer(transformers=[
        ("numerical",   numerical_transformer,   NUMERICAL_FEATURES),
        ("categorical", categorical_transformer, CATEGORICAL_FEATURES),
        ("binary",      binary_transformer,       BINARY_SYMPTOM_FEATURES),
    ])

    model = RandomForestClassifier(
        n_estimators=200,
        random_state=42,
        class_weight="balanced",
        n_jobs=-1,
    )

    pipeline = Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("classifier",   model),
    ])

    return pipeline


def train(df: pd.DataFrame):
    X = df[ALL_FEATURES]
    y = df[TARGET]

    print(f"\n[2/6] Splitting data: 80% train / 20% test (stratified, random_state=42)")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.20,
        random_state=42,
        stratify=y,
    )
    print(f"      Train samples: {len(X_train):,}  |  Test samples: {len(X_test):,}")

    print("\n[3/6] Building preprocessing + RandomForest pipeline …")
    pipeline = build_pipeline()

    print("\n[4/6] Training RandomForestClassifier (n_estimators=200, class_weight='balanced') …")
    pipeline.fit(X_train, y_train)
    print("      Training complete.")

    print("\n[5/6] Evaluating on held-out test set …")
    y_pred = pipeline.predict(X_test)

    acc    = accuracy_score(y_test, y_pred)
    prec   = precision_score(y_test, y_pred, average="weighted", zero_division=0)
    rec    = recall_score(y_test, y_pred, average="weighted", zero_division=0)
    f1     = f1_score(y_test, y_pred, average="weighted", zero_division=0)
    report = classification_report(y_test, y_pred, zero_division=0, output_dict=True)
    cm     = confusion_matrix(y_test, y_pred, labels=SEVERITY_CLASSES).tolist()

    print(f"\n{'='*60}")
    print(f"  Accuracy  : {acc:.4f}  ({acc*100:.2f}%)")
    print(f"  Precision : {prec:.4f} (weighted)")
    print(f"  Recall    : {rec:.4f}  (weighted)")
    print(f"  F1-Score  : {f1:.4f}  (weighted)")
    print(f"{'='*60}")
    print(f"\n  Classification Report:\n")
    print(classification_report(y_test, y_pred, zero_division=0))
    print(f"  Confusion Matrix (rows=Actual, cols=Predicted):")
    print(f"  Labels: {SEVERITY_CLASSES}")
    for row_label, row in zip(SEVERITY_CLASSES, cm):
        print(f"    {row_label:12}: {row}")

    metrics = {
        "model": "RandomForestClassifier",
        "n_estimators": 200,
        "class_weight": "balanced",
        "random_state": 42,
        "train_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "features": ALL_FEATURES,
        "target": TARGET,
        "severity_classes": SEVERITY_CLASSES,
        "accuracy": round(acc, 6),
        "precision_weighted": round(prec, 6),
        "recall_weighted": round(rec, 6),
        "f1_weighted": round(f1, 6),
        "classification_report": report,
        "confusion_matrix": {
            "labels": SEVERITY_CLASSES,
            "matrix": cm,
        },
    }

    return pipeline, metrics


def save_artifacts(pipeline, metrics: dict):
    print("\n[6/6] Saving artifacts ...")

    joblib.dump(pipeline, MODEL_PATH)
    print(f"      Model saved -> {MODEL_PATH}")

    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2, default=str)
    print(f"      Metrics saved -> {METRICS_PATH}")


def main():
    print("=" * 60)
    print("  SmartAid AI — Sprint 3 Model Training")
    print("=" * 60)

    df       = load_and_validate_dataset(DATASET_PATH)
    pipeline, metrics = train(df)
    save_artifacts(pipeline, metrics)

    print(f"\n{'='*60}")
    print(f"  Sprint 3 training complete.")
    print(f"  Model artifact: {MODEL_PATH}")
    print(f"  Metrics file  : {METRICS_PATH}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
