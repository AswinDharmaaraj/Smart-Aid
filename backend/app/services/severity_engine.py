"""
SmartAid AI — Severity Engine (XGBoost Pipeline + Safety Net)

Architecture:
  1. Load trained scikit-learn XGBoost pipeline (preprocessor + XGBClassifier)
     and label_encoder from backend/app/ml_models/.
  2. On each predict_severity() call:
       a. Check CRITICAL_OVERRIDE_SIGNALS rule-based safety net FIRST.
       b. Convert UI category using CATEGORY_MAPPING table to model's 11 categories + 'Unknown'.
       c. Combine UI rapid checks (conscious, breathing, bleeding) with regex/keyword
          symptom extraction to produce ONE unified set of 15 binary symptom flags.
       d. Handle vitals: default heart_rate_bpm=80.0, temperature_c=37.0, spo2_percent=97.0
          and set vitals_estimated=True if any vital was defaulted.
       e. Map sex: Male -> Male, Female -> Female, Other / Prefer not to say -> Unknown.
       f. Run the ML pipeline -> predicted class + predict_proba() -> decode with label_encoder.
       g. Extract top contributing features for explainability.
       h. Return severity_level, confidence_score, emergency_type, reasoning, vitals_estimated.
"""

from __future__ import annotations

import re
import logging
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ── Model artifact paths ───────────────────────────────────────────────────────
_BASE_DIR      = Path(__file__).resolve().parent.parent       # app/
_MODEL_PATH    = _BASE_DIR / "ml_models" / "severity_model_pipeline.joblib"
_ENCODER_PATH  = _BASE_DIR / "ml_models" / "label_encoder.joblib"
_ENCODER_ALT   = _BASE_DIR / "ml_models" / "label_encoder .joblib"

# ── Lazy-loaded pipeline and label encoder ─────────────────────────────────────
_PIPELINE = None
_LABEL_ENCODER = None

def _load_artifacts():
    global _PIPELINE, _LABEL_ENCODER
    if _PIPELINE is None:
        if not _MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Model pipeline artifact not found at {_MODEL_PATH}."
            )
        _PIPELINE = joblib.load(_MODEL_PATH)
        logger.info("SmartAid XGBoost pipeline loaded from %s", _MODEL_PATH)

    if _LABEL_ENCODER is None:
        encoder_path = _ENCODER_PATH if _ENCODER_PATH.exists() else _ENCODER_ALT
        if not encoder_path.exists():
            raise FileNotFoundError(
                f"Label encoder artifact not found at {_ENCODER_PATH}."
            )
        _LABEL_ENCODER = joblib.load(encoder_path)
        logger.info("SmartAid LabelEncoder loaded from %s", encoder_path)

    return _PIPELINE, _LABEL_ENCODER


def check_model_readiness() -> tuple[bool, str]:
    """Verify that the XGBoost pipeline and label encoder artifacts are loaded or loadable."""
    global _PIPELINE, _LABEL_ENCODER
    try:
        _load_artifacts()
        if _PIPELINE is not None and _LABEL_ENCODER is not None:
            return True, "ready"
        return False, "artifacts_missing"
    except Exception as exc:
        logger.warning("Severity model readiness check failed: %s", exc)
        return False, "unavailable"


# ── Feature definitions (20 features — must match training pipeline exactly) ────
# Vitals (heart_rate_bpm, temperature_c, spo2_percent) are excluded (Variant B).
# The app never collects them, so they caused systematic under-triage bias.
ALL_FEATURES = [
    "symptom_text",
    "age", "symptom_duration_min",
    "sex", "emergency_category",
    "chest_pain", "difficulty_breathing", "sweating", "nausea",
    "dizziness", "unconsciousness", "bleeding", "burn", "fever",
    "cough", "seizure", "abdominal_pain", "headache", "weakness", "injury",
]

BINARY_SYMPTOM_FEATURES = [
    "chest_pain", "difficulty_breathing", "sweating", "nausea",
    "dizziness", "unconsciousness", "bleeding", "burn", "fever",
    "cough", "seizure", "abdominal_pain", "headache", "weakness", "injury",
]

# ── Default Vitals ─────────────────────────────────────────────────────────────
DEFAULT_HEART_RATE_BPM = 80.0
DEFAULT_TEMPERATURE_C  = 37.0
DEFAULT_SPO2_PERCENT   = 97.0
DEFAULT_DURATION_MIN   = 15.0
DEFAULT_AGE            = 35.0

# ── Category Mapping Table ─────────────────────────────────────────────────────
# Maps UI emergency selections to the model's expected 11 categories + 'Unknown'
CATEGORY_MAPPING: dict[str, str] = {
    "heart attack": "Cardiac",
    "chest pain / heart attack": "Cardiac",
    "cardiac": "Cardiac",
    "choking": "Respiratory",
    "respiratory": "Respiratory",
    "fracture or fall injury": "Injury",
    "fracture": "Injury",
    "injury": "Injury",
    "burn or scald": "Burn",
    "burn": "Burn",
    "snake bite": "Snake bite",
    "electric shock": "Electric shock",
    "severe bleeding": "Injury",
    "unconscious / not responding": "Neurological",
    "neurological": "Neurological",
    "none of these options match": "General",
    "general": "General",
    "gastrointestinal": "Gastrointestinal",
    "fever/infection": "Fever/Infection",
    "fever / infection": "Fever/Infection",
    "poisoning": "Poisoning",
}

def map_category(category: Optional[str]) -> str:
    """Map any UI category string to the model's category set, defaulting to 'Unknown'."""
    if not category or not category.strip():
        return "Unknown"
    cleaned = category.strip().lower()
    return CATEGORY_MAPPING.get(cleaned, "Unknown")


# ── Sex Mapping ────────────────────────────────────────────────────────────────
# Male -> Male, Female -> Female, Other / Prefer not to say -> Unknown
def map_sex(sex: Optional[str]) -> str:
    if not sex:
        return "Unknown"
    cleaned = sex.strip().lower()
    if cleaned == "male":
        return "Male"
    if cleaned == "female":
        return "Female"
    return "Unknown"


# ── Critical safety override signals (preserved rule-based safety net) ────────
CRITICAL_OVERRIDE_SIGNALS = [
    "unresponsive",
    "unconscious",
    "not breathing",
    "can't breathe",
    "no pulse",
    "heart stopped",
    "seizure",
    "collapsed",
    "responsive: no",
    "responsive: false",
    "breathing: none",
    "no breathing",
    "bleeding: severe",
    "severe bleeding",
    "cardiac arrest",
    "heart attack",
]

def _check_critical_override(text: str) -> bool:
    """Return True if any life-threatening override signal is present in text."""
    text_lower = text.lower()
    return any(signal in text_lower for signal in CRITICAL_OVERRIDE_SIGNALS)


# ── Keyword -> binary feature mapping for symptom text extraction ─────────────
TEXT_FEATURE_MAP: dict[str, list[str]] = {
    "chest_pain":           ["chest pain", "chest tight", "chest pressure", "crushing", "heart attack"],
    "difficulty_breathing": ["can't breathe", "difficulty breathing", "shortness of breath", "breathless", "choking", "chok", "breathing: difficult", "breathing: none"],
    "sweating":             ["sweating", "sweaty", "diaphoresis"],
    "nausea":               ["nausea", "nauseous", "vomiting", "sick to stomach"],
    "dizziness":            ["dizzy", "dizziness", "lightheaded", "vertigo"],
    "unconsciousness":      ["unconscious", "unresponsive", "passed out", "fainted", "responsive: no", "not responsive"],
    "bleeding":             ["bleed", "bleeding", "hemorrhage", "blood", "bleeding: severe"],
    "burn":                 ["burn", "burned", "scald", "hot oil"],
    "fever":                ["fever", "high temperature", "febrile"],
    "cough":                ["cough", "coughing"],
    "seizure":              ["seizure", "convulsion", "fitting"],
    "abdominal_pain":       ["abdominal pain", "stomach pain", "belly pain"],
    "headache":             ["headache", "head pain"],
    "weakness":             ["weakness", "weak", "fatigue", "can't move"],
    "injury":               ["injury", "injured", "fracture", "broken", "fall", "trauma"],
}

def _extract_binary_symptoms_from_text(text: str) -> dict[str, float]:
    """Extract binary symptom flags (0/1) from free-form symptom text."""
    text_lower = text.lower()
    flags: dict[str, float] = {}
    for feature, keywords in TEXT_FEATURE_MAP.items():
        flags[feature] = 1.0 if any(kw in text_lower for kw in keywords) else 0.0
    return flags


def _extract_structured_metadata_from_text(text: str) -> dict[str, float | str | None]:
    """Parse age, duration, sex, and rapid checks from composed text if present."""
    text_lower = text.lower()
    res: dict[str, float | str | None] = {
        "age": None,
        "symptom_duration_min": None,
        "sex": None,
        "conscious": None,
        "breathing": None,
        "bleeding": None,
    }

    age_match = re.search(r"age:\s*(\d+)", text_lower)
    if age_match:
        res["age"] = float(age_match.group(1))

    if "duration: under-30" in text_lower or "duration: just-now" in text_lower:
        res["symptom_duration_min"] = 15.0
    elif "duration: over-30" in text_lower:
        res["symptom_duration_min"] = 60.0

    sex_match = re.search(r"sex:\s*([a-zA-Z\s]+)", text_lower)
    if sex_match:
        res["sex"] = sex_match.group(1).strip()

    if "responsive: no" in text_lower:
        res["conscious"] = "no"
    elif "responsive: yes" in text_lower:
        res["conscious"] = "yes"
    elif "responsive: unsure" in text_lower:
        res["conscious"] = "unsure"

    if "breathing: difficult" in text_lower:
        res["breathing"] = "difficult"
    elif "breathing: none" in text_lower:
        res["breathing"] = "none"
    elif "breathing: normal" in text_lower:
        res["breathing"] = "normal"

    if "bleeding: severe" in text_lower:
        res["bleeding"] = "severe"
    elif "bleeding: minor" in text_lower:
        res["bleeding"] = "minor"
    elif "bleeding: none" in text_lower:
        res["bleeding"] = "none"

    return res


# ── Friendly feature names for explainability ─────────────────────────────────
FEATURE_LABELS: dict[str, str] = {
    "chest_pain":           "Chest pain",
    "difficulty_breathing": "Difficulty breathing",
    "sweating":             "Excessive sweating",
    "nausea":               "Nausea",
    "dizziness":            "Dizziness",
    "unconsciousness":      "Loss of consciousness",
    "bleeding":             "Bleeding",
    "burn":                 "Burn injury",
    "fever":                "Fever",
    "cough":                "Cough",
    "seizure":              "Seizure",
    "abdominal_pain":       "Abdominal pain",
    "headache":             "Headache",
    "weakness":             "Weakness / fatigue",
    "injury":               "Physical injury",
    "heart_rate_bpm":       "Heart rate",
    "spo2_percent":         "Blood oxygen (SpO2)",
    "temperature_c":        "Body temperature",
    "age":                  "Patient age",
    "symptom_duration_min": "Symptom duration",
    "sex":                  "Sex",
    "emergency_category":   "Emergency category",
}


def _get_top_features(pipeline, n_top: int = 5) -> list[str]:
    """Return top most influential features from XGBoost model."""
    try:
        model = pipeline.named_steps["model"]
        preprocessor = pipeline.named_steps["preprocess"]
        feature_names = preprocessor.get_feature_names_out()
        importances = model.feature_importances_

        top_indices = np.argsort(importances)[::-1][:n_top]
        clean_names = []
        for i in top_indices:
            raw_name = feature_names[i]
            # Strip transformer prefixes like 'text__', 'num__', 'cat__'
            name = re.sub(r"^(text|num|cat)__", "", raw_name)
            name = re.sub(r"^emergency_category_", "", name)
            clean_names.append(name)
        return clean_names
    except Exception as exc:
        logger.warning("Could not extract feature importances: %s", exc)
        return []


def _build_reasoning(
    top_features: list[str],
    active_binary_flags: dict[str, float],
    severity: str,
    category: Optional[str],
    safety_override: bool,
    vitals_estimated: bool,
    unsure_conscious: bool = False,
) -> str:
    """Generate a plain-language explanation of the severity decision."""
    parts: list[str] = []

    if safety_override:
        parts.append("Life-threatening emergency signals detected — immediate action required.")

    if unsure_conscious:
        parts.append("Responsiveness was reported as unclear — triage floor set to at least moderate as a precaution.")

    # Identified binary symptoms
    active_symptoms = [
        FEATURE_LABELS.get(f, f)
        for f in BINARY_SYMPTOM_FEATURES
        if active_binary_flags.get(f, 0.0) == 1.0
    ]
    if active_symptoms:
        parts.append(f"Reported symptoms: {', '.join(active_symptoms[:5])}.")

    # Top influential features
    top_labels = [FEATURE_LABELS.get(f, f) for f in top_features[:3] if f not in ("Unknown", "General")]
    if top_labels:
        parts.append(f"Key triage factors: {', '.join(top_labels)}.")

    if vitals_estimated:
        parts.append("Clinical vitals were estimated based on typical baseline ranges.")

    if not parts:
        parts.append("AI triage assessment based on reported symptoms and patient profile.")

    return " ".join(parts)


def _build_feature_row(
    raw_text: str,
    selected_category: Optional[str] = None,
    age: Optional[float] = None,
    sex: Optional[str] = None,
    symptom_duration_min: Optional[float | str] = None,
    conscious: Optional[str] = None,
    breathing: Optional[str] = None,
    bleeding: Optional[str] = None,
    heart_rate_bpm: Optional[float] = None,
    temperature_c: Optional[float] = None,
    spo2_percent: Optional[float] = None,
) -> tuple[pd.DataFrame, dict[str, float], bool]:
    """
    Construct a single-row DataFrame matching the 23 exact input columns expected
    by the XGBoost pipeline, unifying structured UI inputs and regex extractions.
    """
    # 1. Metadata extracted from text
    text_meta = _extract_structured_metadata_from_text(raw_text)

    # 2. Extract binary symptom flags from text
    binary_flags = _extract_binary_symptoms_from_text(raw_text)

    # 3. Unify structured rapid checks with binary symptom flags
    eff_conscious = conscious if conscious is not None else text_meta["conscious"]
    eff_breathing = breathing if breathing is not None else text_meta["breathing"]
    eff_bleeding  = bleeding if bleeding is not None else text_meta["bleeding"]

    if eff_conscious == "no":
        binary_flags["unconsciousness"] = 1.0
    if eff_breathing in ("difficult", "none"):
        binary_flags["difficulty_breathing"] = 1.0
    if eff_bleeding in ("minor", "severe"):
        binary_flags["bleeding"] = 1.0

    # 4. Emergency category mapping
    mapped_category = map_category(selected_category)

    # 5. Sex mapping
    eff_sex = sex if sex is not None else text_meta["sex"]
    mapped_sex = map_sex(eff_sex)

    # 6. Age
    eff_age = age if age is not None else text_meta["age"]
    if eff_age is None:
        eff_age = DEFAULT_AGE
    else:
        try:
            eff_age = float(eff_age)
        except (ValueError, TypeError):
            eff_age = DEFAULT_AGE

    # 7. Duration
    eff_duration = symptom_duration_min if symptom_duration_min is not None else text_meta["symptom_duration_min"]
    if isinstance(eff_duration, str):
        if "just-now" in eff_duration:
            eff_duration = 10.0
        elif "under-30" in eff_duration:
            eff_duration = 15.0
        elif "over-30" in eff_duration:
            eff_duration = 60.0
        else:
            try:
                eff_duration = float(eff_duration)
            except ValueError:
                eff_duration = DEFAULT_DURATION_MIN
    elif eff_duration is None:
        eff_duration = DEFAULT_DURATION_MIN
    else:
        eff_duration = float(eff_duration)

    # 8. vitals_estimated — always True in app (vitals never collected, Variant B)
    vitals_estimated = (
        heart_rate_bpm is None or temperature_c is None or spo2_percent is None
    )

    # 9. Assemble feature dictionary (20 features — no vitals)
    row = {
        "symptom_text":         raw_text or "",
        "age":                  eff_age,
        "symptom_duration_min": eff_duration,
        "sex":                  mapped_sex,
        "emergency_category":   mapped_category,
        **binary_flags,
    }

    df = pd.DataFrame([row], columns=ALL_FEATURES)
    return df, binary_flags, vitals_estimated


def predict_severity(
    raw_text: str,
    selected_category: Optional[str] = None,
    age: Optional[float | str] = None,
    sex: Optional[str] = None,
    symptom_duration_min: Optional[float | str] = None,
    conscious: Optional[str] = None,
    breathing: Optional[str] = None,
    bleeding: Optional[str] = None,
    heart_rate_bpm: Optional[float] = None,
    temperature_c: Optional[float] = None,
    spo2_percent: Optional[float] = None,
) -> dict:
    """
    Main entry point for severity prediction using the XGBoost pipeline.

    Returns a dict with:
        emergency_type   : str
        severity_level   : "low" | "moderate" | "urgent" | "critical"
        confidence_score : float (0–1)
        reasoning        : str
        vitals_estimated : bool
    """
    # ── 1. RULE-BASED CRITICAL SAFETY OVERRIDE (Runs FIRST) ───────────────────
    # If any life-threatening keyword or condition is present, trigger Critical immediately.
    is_critical_override = _check_critical_override(raw_text)
    if conscious == "no" or breathing == "none" or bleeding == "severe":
        is_critical_override = True

    # ── 2. Build feature row & check vitals estimation ────────────────────────
    df, binary_flags, vitals_estimated = _build_feature_row(
        raw_text=raw_text,
        selected_category=selected_category,
        age=age,
        sex=sex,
        symptom_duration_min=symptom_duration_min,
        conscious=conscious,
        breathing=breathing,
        bleeding=bleeding,
        heart_rate_bpm=heart_rate_bpm,
        temperature_c=temperature_c,
        spo2_percent=spo2_percent,
    )

    mapped_category = df["emergency_category"].iloc[0]

    # ── 3. ML Model Prediction ────────────────────────────────────────────────
    pipeline, label_encoder = _load_artifacts()
    raw_pred = pipeline.predict(df)[0]
    proba = pipeline.predict_proba(df)[0]
    classes = list(label_encoder.classes_)

    # Decode class index to severity string label
    predicted_severity = label_encoder.inverse_transform([raw_pred])[0]
    class_idx = raw_pred if isinstance(raw_pred, (int, np.integer)) else classes.index(predicted_severity)
    confidence_score = float(proba[class_idx])

    # ── 4. Apply safety escalation if override triggered ──────────────────────
    if is_critical_override:
        predicted_severity = "Critical"
        if "Critical" in classes:
            crit_idx = classes.index("Critical")
            confidence_score = max(confidence_score, float(proba[crit_idx]), 0.95)
        else:
            confidence_score = max(confidence_score, 0.95)

    # ── 4b. Cautious floor for unclear responsiveness (conscious == "unsure") ──
    text_meta = _extract_structured_metadata_from_text(raw_text)
    eff_conscious = conscious if conscious is not None else text_meta["conscious"]
    is_unsure_conscious = (eff_conscious == "unsure")

    if is_unsure_conscious and not is_critical_override:
        if predicted_severity.lower() == "low":
            predicted_severity = "Moderate"
            if "Moderate" in classes:
                mod_idx = classes.index("Moderate")
                confidence_score = max(confidence_score, float(proba[mod_idx]))

    # ── 5. Explainability ─────────────────────────────────────────────────────
    top_features = _get_top_features(pipeline, n_top=5)
    reasoning = _build_reasoning(
        top_features=top_features,
        active_binary_flags=binary_flags,
        severity=predicted_severity,
        category=mapped_category,
        safety_override=is_critical_override,
        vitals_estimated=vitals_estimated,
        unsure_conscious=is_unsure_conscious,
    )

    return {
        "emergency_type":   mapped_category if mapped_category != "Unknown" else (selected_category or "Unknown"),
        "severity_level":   predicted_severity.lower(),
        "confidence_score": round(confidence_score, 4),
        "reasoning":        reasoning,
        "vitals_estimated": vitals_estimated,
    }