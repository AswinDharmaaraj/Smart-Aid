"""
SmartAid AI — Severity Engine Tests (XGBoost Pipeline + Safety Net)

Tests cover:
  1. Category mapping table for all 8 UI categories + fallback + unknown.
  2. Vitals defaulting and vitals_estimated flag behavior.
  3. Rapid-check-to-binary-flag conversion and conflict resolution.
  4. Sex mapping (Male, Female, Other, Prefer not to say -> Unknown).
  5. Critical safety override precedence over ML prediction.
  6. End-to-end predict_severity() output schema and sanity.
"""

import pytest
from app.services.severity_engine import (
    map_category,
    map_sex,
    predict_severity,
    _build_feature_row,
    _check_critical_override,
    DEFAULT_HEART_RATE_BPM,
    DEFAULT_TEMPERATURE_C,
    DEFAULT_SPO2_PERCENT,
)

VALID_SEVERITIES = {"low", "moderate", "urgent", "critical"}


# ==============================================================================
# 1. CATEGORY MAPPING TABLE TESTS (All 8 UI Categories + Fallbacks)
# ==============================================================================
@pytest.mark.parametrize(
    "ui_input,expected_model_category",
    [
        ("Chest pain / Heart attack", "Cardiac"),
        ("Heart attack", "Cardiac"),
        ("Cardiac", "Cardiac"),
        ("Burn or scald", "Burn"),
        ("Burn", "Burn"),
        ("Choking", "Respiratory"),
        ("Respiratory", "Respiratory"),
        ("Fracture or fall injury", "Injury"),
        ("Fracture", "Injury"),
        ("Injury", "Injury"),
        ("Snake bite", "Snake bite"),
        ("Electric shock", "Electric shock"),
        ("Severe bleeding", "Injury"),
        ("Unconscious / not responding", "Neurological"),
        ("Neurological", "Neurological"),
        ("None of these options match", "General"),
        ("General", "General"),
        ("", "Unknown"),
        (None, "Unknown"),
        ("Some random nonexistent category", "Unknown"),
    ],
)
def test_category_mapping(ui_input, expected_model_category):
    """Every UI category option must cleanly map to one of the model's categories."""
    assert map_category(ui_input) == expected_model_category


# ==============================================================================
# 2. VITALS DEFAULTING + vitals_estimated FLAG TESTS
# ==============================================================================
def test_vitals_defaulting_when_omitted():
    """When vitals are omitted, vitals_estimated is True."""
    _, _, vitals_estimated = _build_feature_row(
        raw_text="minor headache",
        heart_rate_bpm=None,
        temperature_c=None,
        spo2_percent=None,
    )
    assert vitals_estimated is True


def test_vitals_estimated_false_when_all_vitals_provided():
    """When all three clinical vitals are provided, vitals_estimated is False."""
    _, _, vitals_estimated = _build_feature_row(
        raw_text="sprained ankle",
        heart_rate_bpm=72.0,
        temperature_c=36.6,
        spo2_percent=99.0,
    )
    assert vitals_estimated is False


def test_vitals_estimated_true_when_partial_vitals_provided():
    """If even one vital is missing, vitals_estimated must be True."""
    _, _, vitals_estimated = _build_feature_row(
        raw_text="sprained ankle",
        heart_rate_bpm=75.0,
        temperature_c=37.0,
        spo2_percent=None,  # SpO2 is missing
    )
    assert vitals_estimated is True


def test_predict_severity_returns_vitals_estimated():
    """predict_severity() response must include vitals_estimated boolean."""
    res_default = predict_severity("mild rash on arm")
    assert "vitals_estimated" in res_default
    assert res_default["vitals_estimated"] is True

    res_real = predict_severity(
        "mild rash on arm",
        heart_rate_bpm=76.0,
        temperature_c=36.9,
        spo2_percent=98.0,
    )
    assert res_real["vitals_estimated"] is False


# ==============================================================================
# 3. RAPID CHECKS TO BINARY FLAGS & UNIFICATION TESTS
# ==============================================================================
def test_rapid_check_conscious_to_unconsciousness_flag():
    """conscious='no' sets unconsciousness=1.0; 'yes' sets 0.0."""
    _, flags_no, _ = _build_feature_row(raw_text="fell down", conscious="no")
    assert flags_no["unconsciousness"] == 1.0

    _, flags_yes, _ = _build_feature_row(raw_text="fell down", conscious="yes")
    assert flags_yes["unconsciousness"] == 0.0


def test_rapid_check_breathing_to_difficulty_breathing_flag():
    """breathing='difficult' or 'none' sets difficulty_breathing=1.0."""
    _, flags_diff, _ = _build_feature_row(raw_text="mild cough", breathing="difficult")
    assert flags_diff["difficulty_breathing"] == 1.0

    _, flags_none, _ = _build_feature_row(raw_text="mild cough", breathing="none")
    assert flags_none["difficulty_breathing"] == 1.0

    _, flags_norm, _ = _build_feature_row(raw_text="mild cough", breathing="normal")
    assert flags_norm["difficulty_breathing"] == 0.0


def test_rapid_check_bleeding_flag():
    """bleeding='minor' or 'severe' sets bleeding=1.0; 'none' sets 0.0."""
    _, flags_minor, _ = _build_feature_row(raw_text="small cut", bleeding="minor")
    assert flags_minor["bleeding"] == 1.0

    _, flags_sev, _ = _build_feature_row(raw_text="deep laceration", bleeding="severe")
    assert flags_sev["bleeding"] == 1.0

    _, flags_none, _ = _build_feature_row(raw_text="bruise", bleeding="none")
    assert flags_none["bleeding"] == 0.0


def test_conflict_resolution_text_and_rapid_checks():
    """
    If text mentions bleeding ('bleeding from arm') but rapid check is 'none',
    unification via logical OR (max) preserves the active symptom.
    """
    df, flags, _ = _build_feature_row(
        raw_text="patient fell and is bleeding heavily from arm",
        bleeding="none",
    )
    assert flags["bleeding"] == 1.0
    assert df["bleeding"].iloc[0] == 1.0


# ==============================================================================
# 4. SEX MAPPING TESTS
# ==============================================================================
@pytest.mark.parametrize(
    "raw_sex,expected_mapped",
    [
        ("Male", "Male"),
        ("male", "Male"),
        ("Female", "Female"),
        ("female", "Female"),
        ("Other", "Unknown"),
        ("Prefer not to say", "Unknown"),
        ("", "Unknown"),
        (None, "Unknown"),
    ],
)
def test_sex_mapping(raw_sex, expected_mapped):
    """Sex values must be mapped to Male, Female, or Unknown for model compatibility."""
    assert map_sex(raw_sex) == expected_mapped


# ==============================================================================
# 5. CRITICAL OVERRIDE PRECEDENCE
# ==============================================================================
def test_critical_override_runs_first():
    """Any life-threatening signal immediately escalates severity to Critical."""
    res1 = predict_severity("victim collapsed and has no pulse")
    assert res1["severity_level"] == "critical"

    res2 = predict_severity("person has cut on arm", breathing="none")
    assert res2["severity_level"] == "critical"

    res3 = predict_severity("minor finger cut", bleeding="severe")
    assert res3["severity_level"] == "critical"


# ==============================================================================
# 6. END-TO-END PREDICTION SANITY
# ==============================================================================
def test_end_to_end_prediction():
    """Calling predict_severity with common emergencies produces valid output."""
    res = predict_severity(
        raw_text="crushing chest pain radiating to jaw with breathlessness",
        selected_category="Chest pain / Heart attack",
        age=58,
        sex="Male",
        symptom_duration_min=20,
        conscious="yes",
        breathing="difficult",
        bleeding="none",
    )
    assert res["severity_level"] in VALID_SEVERITIES
    assert 0.0 <= res["confidence_score"] <= 1.0
    assert res["emergency_type"] == "Cardiac"
    assert "reasoning" in res and len(res["reasoning"]) > 0
    assert res["vitals_estimated"] is True


# ==============================================================================
# 7. CONSCIOUS="UNSURE" CAUTIOUS ESCALATION TESTS
# ==============================================================================
def test_unsure_consciousness_floors_low_to_moderate():
    """An input that would otherwise be 'low' is floored to 'moderate' when conscious='unsure'."""
    # Confirm without conscious="unsure" it evaluates to low
    base = predict_severity("mild headache", conscious="yes")
    assert base["severity_level"] == "low"

    # With conscious="unsure", it must be floored to moderate with reasoning note
    unsure = predict_severity("mild headache", conscious="unsure")
    assert unsure["severity_level"] == "moderate"
    expected_note = "Responsiveness was reported as unclear — triage floor set to at least moderate as a precaution."
    assert expected_note in unsure["reasoning"]


def test_unsure_consciousness_does_not_downgrade_higher_severity():
    """Higher severities (urgent/critical) are left intact and never downgraded by the floor."""
    res_high = predict_severity(
        "crushing chest pain radiating to left arm with sweating",
        selected_category="Chest pain / Heart attack",
        conscious="unsure",
    )
    assert res_high["severity_level"] in ("urgent", "critical")

