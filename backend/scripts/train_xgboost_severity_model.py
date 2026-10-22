"""
SmartAid AI — XGBoost Severity Prediction Pipeline Training Script

Reproduces the Colab XGBoost recipe with all preprocessing contained within
the Pipeline so no leakage occurs from test samples into transformers.

Variant B (current, adopted): 20 features — vitals removed.
  App never supplies heart_rate_bpm / temperature_c / spo2_percent;
  keeping them caused 146/721 true-Critical under-triage due to skew.
  Dropping them reduces Critical under-triage to 57/721.

Features consumed (20):
  - text: symptom_text (TfidfVectorizer, max_features=300, stop_words='english')
  - numerical (2): age, symptom_duration_min
  - binary (15): chest_pain, difficulty_breathing, sweating, nausea, dizziness,
                 unconsciousness, bleeding, burn, fever, cough, seizure,
                 abdominal_pain, headache, weakness, injury
  - categorical (2): sex, emergency_category (OneHotEncoder)

Variant C (report-only, not adopted):
  B + rule "predict Critical if P(Critical) >= t". Threshold t=0.30 selected
  from OOF probabilities (train split only) as highest t with OOF Critical
  recall >= 0.95 (achieved 0.9501). Test Critical recall: 0.9431, but
  73 non-Critical test rows escalated — over-alert tradeoff rejected.

Artifacts saved:
  - backend/app/ml_models/severity_model_pipeline.joblib
  - backend/app/ml_models/label_encoder.joblib
  - backend/app/ml_models/severity_model_metrics.json
"""

import sys
import os
import json
import hashlib
import platform
from pathlib import Path
from datetime import datetime, timezone

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
sys.path.insert(0, str(BASE_DIR))

import numpy as np
import pandas as pd
import joblib

from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder
from xgboost import XGBClassifier

# ── Paths ───────────────────────────────────────────────────────────────────────
DATASET_PATH  = BASE_DIR / "data" / "smartaid_ai_test_dataset1.csv"
MODEL_DIR     = BASE_DIR / "app" / "ml_models"
METRICS_DIR   = BASE_DIR / "ml_results"
MODEL_PATH    = MODEL_DIR / "severity_model_pipeline.joblib"
ENCODER_PATH  = MODEL_DIR / "label_encoder.joblib"
METRICS_PATH  = METRICS_DIR / "severity_model_metrics.json"
METRICS_COPY  = BASE_DIR / "app" / "ml_models" / "severity_model_metrics.json"

MODEL_DIR.mkdir(parents=True, exist_ok=True)
METRICS_DIR.mkdir(parents=True, exist_ok=True)

# ── Feature definitions (20 features — vitals excluded) ─────────────────────────
NUMERICAL_FEATURES = [
    "age",
    "symptom_duration_min",
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

TEXT_FEATURE     = "symptom_text"
ALL_FEATURES     = [TEXT_FEATURE] + NUMERICAL_FEATURES + CATEGORICAL_FEATURES + BINARY_SYMPTOM_FEATURES
TARGET           = "severity"
SEVERITY_CLASSES = ["Low", "Moderate", "Urgent", "Critical"]


def sha256_of_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def load_and_prepare_dataset(path: Path):
    print(f"\n[1/6] Loading and preparing dataset...")
    df = pd.read_csv(path)

    # Drop columns not used as features
    df = df.drop(columns=["patient_id"], errors="ignore")

    # Fill missing symptom_text with empty string
    df[TEXT_FEATURE] = df[TEXT_FEATURE].fillna("").astype(str)

    # Drop rows where target is missing
    df = df.dropna(subset=[TARGET])

    # Encode target to integer labels
    le = LabelEncoder()
    le.fit(SEVERITY_CLASSES)
    df["_label"] = le.transform(df[TARGET])

    print(f"      Rows: {len(df):,} | Features: {len(ALL_FEATURES)}")
    print(f"      LabelEncoder classes: {[str(c) for c in le.classes_]}")
    return df, le


def build_pipeline() -> Pipeline:
    """Construct the full sklearn Pipeline: preprocessor + XGBClassifier."""

    text_transformer = Pipeline(steps=[
        ("tfidf", TfidfVectorizer(max_features=300, stop_words="english")),
    ])

    num_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
    ])

    cat_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="constant", fill_value="Unknown")),
        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])

    bin_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="constant", fill_value=0)),
    ])

    preprocessor = ColumnTransformer(transformers=[
        ("text", text_transformer, TEXT_FEATURE),
        ("num",  num_transformer,  NUMERICAL_FEATURES),
        ("cat",  cat_transformer,  CATEGORICAL_FEATURES),
        ("bin",  bin_transformer,  BINARY_SYMPTOM_FEATURES),
    ])

    xgb = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.1,
        min_child_weight=4,
        objective="multi:softmax",
        eval_metric="mlogloss",
        use_label_encoder=False,
        random_state=42,
        n_jobs=-1,
    )

    pipeline = Pipeline(steps=[
        ("preprocess", preprocessor),
        ("model",      xgb),
    ])

    return pipeline


def train_and_evaluate():
    df, le = load_and_prepare_dataset(DATASET_PATH)

    X = df[ALL_FEATURES]
    y = df["_label"]

    print(f"\n[2/6] Splitting data: 80% train / 20% test (stratified, random_state=42)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.20,
        random_state=42,
        stratify=y,
    )

    # Balanced sample weights for training
    class_counts   = np.bincount(y_train)
    total          = len(y_train)
    weights        = {i: total / (len(class_counts) * c) for i, c in enumerate(class_counts)}
    sample_weights = np.array([weights[yi] for yi in y_train])

    print(f"\n[3/6] Running 5-fold Stratified CV on TRAIN split only...")
    pipeline = build_pipeline()
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    # sklearn >= 1.4: use params= instead of deprecated fit_params=
    cv_scores = cross_val_score(
        pipeline, X_train, y_train,
        cv=cv, scoring="f1_macro", n_jobs=-1,
        params={"model__sample_weight": sample_weights},
    )
    for i, s in enumerate(cv_scores, 1):
        print(f"      Fold {i} Macro-F1: {s:.4f}")
    print(f"      CV Macro-F1: {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")

    print(f"\n[4/6] Fitting full pipeline on training set...")
    pipeline.fit(X_train, y_train, model__sample_weight=sample_weights)
    print(f"      Training complete.")

    print(f"\n[5/6] Evaluating on held-out test set...")
    y_pred       = pipeline.predict(X_test)
    y_test_names = le.inverse_transform(y_test)
    y_pred_names = le.inverse_transform(y_pred)

    acc    = accuracy_score(y_test, y_pred)
    mac_f1 = f1_score(y_test, y_pred, average="macro",    zero_division=0)
    w_f1   = f1_score(y_test, y_pred, average="weighted", zero_division=0)
    prec   = precision_score(y_test, y_pred, average="weighted", zero_division=0)
    rec    = recall_score(y_test, y_pred, average="weighted", zero_division=0)
    report = classification_report(y_test_names, y_pred_names, zero_division=0, output_dict=True)
    cm     = confusion_matrix(y_test_names, y_pred_names, labels=SEVERITY_CLASSES).tolist()

    print(f"      Test Accuracy : {acc:.4f}")
    print(f"      Test Macro-F1 : {mac_f1:.4f}")
    print(f"      CV Macro-F1   : {cv_scores.mean():.4f}")

    # ── Deployment Condition (i): model only, no override ───────────────────────
    print(f"\n[5b/6] Evaluating Deployment Condition (i): Model only (20-feature, no override)...")
    crit_idx = list(le.classes_).index("Critical")
    urg_idx  = list(le.classes_).index("Urgent")
    low_idx  = list(le.classes_).index("Low")
    mod_idx  = list(le.classes_).index("Moderate")

    true_crit_urg = (y_test == crit_idx) | (y_test == urg_idx)
    pred_low_mod  = (y_pred == low_idx)  | (y_pred == mod_idx)
    dangerous     = true_crit_urg & pred_low_mod

    n_dangerous      = int(dangerous.sum())
    n_crit_urg_total = int(true_crit_urg.sum())
    n_test           = len(y_test)
    print(f"      Dangerous under-triage (Crit/Urg -> Low/Mod): {n_dangerous}/{n_crit_urg_total}")

    def under_triage_entry(n_dang, n_tot, n_tot_test):
        return {
            "dangerous_under_triage_count": n_dang,
            "dangerous_under_triage_denom": n_tot,
            "dangerous_under_triage_rate":  round(n_dang / n_tot, 6) if n_tot else 0,
            "total_test_cases": n_tot_test,
        }

    cond_i = {
        "description": "Model only (20 features, no override) — identical to held-out test metrics",
        **under_triage_entry(n_dangerous, n_crit_urg_total, n_test),
    }

    # ── Deployment Condition (ii): with safety override ─────────────────────────
    print(f"\n[5c/6] Evaluating Deployment Condition (ii): predict_severity() with dataset category + safety override...")
    try:
        from app.services.severity_engine import predict_severity
        sub = df.loc[y_test.index].copy()
        ii_dang, ii_tot = 0, 0
        for _, row in sub.iterrows():
            true_sev = le.classes_[row["_label"]]
            if true_sev not in ("Critical", "Urgent"):
                continue
            ii_tot += 1
            res = predict_severity(
                raw_text=str(row.get(TEXT_FEATURE, "")),
                selected_category=str(row.get("emergency_category", "")),
                age=row.get("age"),
                sex=str(row.get("sex", "")),
                symptom_duration_min=row.get("symptom_duration_min"),
            )
            if res["severity_level"] in ("low", "moderate"):
                ii_dang += 1
        cond_ii = {
            "description": "predict_severity() with dataset category, 20 features + safety override",
            **under_triage_entry(ii_dang, ii_tot, n_test),
        }
        print(f"      Dangerous under-triage: {ii_dang}/{ii_tot}")
    except Exception as e:
        print(f"      [SKIP] Could not run condition (ii): {e}")
        cond_ii = {"description": "Skipped", "error": str(e)}

    # ── Deployment Condition (iii): category=None ────────────────────────────────
    print(f"\n[5d/6] Evaluating Deployment Condition (iii): App runtime, category=None...")
    try:
        iii_dang, iii_tot = 0, 0
        for _, row in sub.iterrows():
            true_sev = le.classes_[row["_label"]]
            if true_sev not in ("Critical", "Urgent"):
                continue
            iii_tot += 1
            res = predict_severity(
                raw_text=str(row.get(TEXT_FEATURE, "")),
                selected_category=None,
                age=row.get("age"),
                sex=str(row.get("sex", "")),
                symptom_duration_min=row.get("symptom_duration_min"),
            )
            if res["severity_level"] in ("low", "moderate"):
                iii_dang += 1
        cond_iii = {
            "description": "predict_severity() with category=None (text-inference path), 20 features + safety override",
            **under_triage_entry(iii_dang, iii_tot, n_test),
        }
        print(f"      Dangerous under-triage: {iii_dang}/{iii_tot}")
    except Exception as e:
        print(f"      [SKIP] Could not run condition (iii): {e}")
        cond_iii = {"description": "Skipped", "error": str(e)}

    # ── Save artifacts ───────────────────────────────────────────────────────────
    print(f"\n[6/6] Saving model artifacts and metrics JSON...")
    joblib.dump(pipeline, MODEL_PATH)
    joblib.dump(le,       ENCODER_PATH)
    model_sha   = sha256_of_file(MODEL_PATH)
    encoder_sha = sha256_of_file(ENCODER_PATH)
    print(f"      Pipeline saved: {MODEL_PATH} (SHA-256: {model_sha[:16]}...)")
    print(f"      Encoder saved : {ENCODER_PATH}")

    import sklearn
    import xgboost

    metrics = {
        "model_type":             "XGBClassifier",
        "pipeline_class":         "sklearn.pipeline.Pipeline",
        "artifact_filename":      "severity_model_pipeline.joblib",
        "artifact_sha256":        model_sha,
        "label_encoder_filename": "label_encoder.joblib",
        "label_encoder_sha256":   encoder_sha,
        "training_script":        "backend/scripts/train_xgboost_severity_model.py",
        "trained_at":             datetime.now(timezone.utc).isoformat(),
        "python_version":         platform.python_version(),
        "dataset": {
            "filename":   "smartaid_ai_test_dataset1.csv",
            "filepath":   str(DATASET_PATH),
            "total_rows": len(df),
            "train_rows": len(X_train),
            "test_rows":  len(X_test),
        },
        "features": {
            "text":        [TEXT_FEATURE],
            "numerical":   NUMERICAL_FEATURES,
            "categorical": CATEGORICAL_FEATURES,
            "binary":      BINARY_SYMPTOM_FEATURES,
            "total_count": len(ALL_FEATURES),
        },
        "target":           TARGET,
        "severity_classes": SEVERITY_CLASSES,
        "split_parameters": {
            "test_size":    0.20,
            "random_state": 42,
            "stratified":   True,
        },
        "hyperparameters": {
            "n_estimators":       300,
            "max_depth":          6,
            "learning_rate":      0.1,
            "min_child_weight":   4,
            "objective":          "multi:softmax",
            "eval_metric":        "mlogloss",
            "balanced_sample_weights": True,
            "tfidf_max_features": 300,
            "tfidf_stop_words":   "english",
        },
        "library_versions": {
            "sklearn":  sklearn.__version__,
            "xgboost":  xgboost.__version__,
            "joblib":   joblib.__version__,
            "numpy":    np.__version__,
            "pandas":   pd.__version__,
        },
        "cross_validation_train_only": {
            "strategy": "StratifiedKFold",
            "n_splits": 5,
            "scoring":  "f1_macro",
            "cv_mean":  round(float(cv_scores.mean()), 6),
            "cv_std":   round(float(cv_scores.std()),  6),
        },
        "held_out_test_metrics": {
            "accuracy":            round(acc,    4),
            "precision_weighted":  round(prec,   4),
            "recall_weighted":     round(rec,     4),
            "f1_weighted":         round(w_f1,   4),
            "f1_macro":            round(mac_f1, 4),
            "confusion_matrix":    cm,
            "classification_report": report,
        },
        "deployment_condition": {
            "i":   cond_i,
            "ii":  cond_ii,
            "iii": cond_iii,
            "variant_b_note": (
                "23-feature model (with heart_rate_bpm, temperature_c, spo2_percent). "
                "Backed up to backend/app/ml_models/_backup_23col/"
            ),
            "variant_c_note":               "B + rule: predict Critical if P(Critical) >= t. NOT adopted.",
            "variant_c_threshold_selection": "highest t from OOF train probabilities with Critical recall >= 0.95",
            "variant_c_rejection_reason": (
                "73 non-Critical test rows escalated — over-alert tradeoff deemed "
                "unacceptable for deployment without clinician review."
            ),
        },
    }

    metrics_json = json.dumps(metrics, indent=2)
    METRICS_PATH.write_text(metrics_json, encoding="utf-8")
    METRICS_COPY.write_text(metrics_json, encoding="utf-8")
    print(f"      Metrics written to: {METRICS_PATH} and {METRICS_COPY}")
    print(f"\nTraining and evaluation pipeline finished successfully.")


if __name__ == "__main__":
    train_and_evaluate()
