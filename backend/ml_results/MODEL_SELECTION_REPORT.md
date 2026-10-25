# SmartAid AI — Severity Model Selection & Optimization Report

## Executive Summary
An empirical, head-to-head evaluation was conducted to select the most accurate, safe, and efficient machine learning model for emergency severity triage in SmartAid AI. The active **XGBoost Classifier** pipeline was evaluated against the legacy **Random Forest Classifier** using:
- The exact same 10,000-sample dataset (`backend/data/smartaid_ai_test_dataset1.csv`)
- Identical 4 target severity classes (`Critical`, `Urgent`, `Moderate`, `Low`)
- Identical 20-feature input schema (TF-IDF on `symptom_text`, numerical features, categorical features, and 15 unified binary symptoms)
- Identical stratified 80/20 train/test split (`random_state=42`)
- 5-Fold Stratified Cross-Validation on the training set
- A held-out 2,000-sample test set (never seen during training or tuning)
- Real-time single-sample inference latency benchmarking (50 trials)

**Selected Model: XGBoost Pipeline (`severity_model_pipeline.joblib`)**

---

## Head-to-Head Comparison Results

| Evaluation Metric | XGBoost Pipeline (Selected) | Random Forest (Legacy) | Advantage / Rationale |
| :--- | :--- | :--- | :--- |
| **Cross-Validation Macro F1 (5-fold)** | 0.8574 ± 0.0072 | 0.8585 ± 0.0056 | Comparable (within 0.001) |
| **Held-Out Test Accuracy** | **86.35%** (1,727 / 2,000) | 86.15% (1,723 / 2,000) | +0.20% XGBoost |
| **Test Macro F1-Score** | **0.8556** | 0.8489 | +0.0067 XGBoost |
| **Test Weighted F1-Score** | **0.8652** | 0.8634 | +0.0018 XGBoost |
| **Critical Class Recall** | **92.51%** (667 / 721) | 92.51% (667 / 721) | Parity on test set |
| **Critical Class Precision** | 93.03% (667 / 717) | **93.16%** (667 / 716) | Parity (differs by 1 sample) |
| **Critical Class F1-Score** | 0.9277 | 0.9283 | Parity |
| **Catastrophic Critical Under-Triage**<br>*(True Critical predicted as Low/Moderate)* | **10 cases** (1.39%) | **17 cases** (2.36%) | **41% reduction in catastrophic under-triage with XGBoost** |
| **Total Under-Triage**<br>*(True Critical/Urgent predicted as Low/Moderate)* | **55 / 1190** (4.62%) | **57 / 1190** (4.79%) | Lower with XGBoost |
| **Low Class F1-Score** | **0.8571** | 0.8286 | +0.0285 XGBoost |
| **Moderate Class F1-Score** | **0.8629** | 0.8576 | +0.0053 XGBoost |
| **Urgent Class F1-Score** | 0.7747 | **0.7812** | Comparable |
| **Inference Latency (Median p50)** | **53.27 ms** | 343.93 ms | **~6.5x faster** |
| **Inference Latency (95th %ile p95)** | **82.58 ms** | 1543.56 ms | **~18.7x faster** (RF suffers latency spikes) |
| **Inference Latency (Mean)** | **56.82 ms** | 626.48 ms | **~11x faster** |
| **Model Artifact Size** | **2.03 MB** | 22.44 MB (legacy RF: 29.8 MB) | **~11x to 14.6x smaller disk/memory footprint** |

---

## Detailed Confusion Matrices (Held-Out Test Set, n=2,000)

Class order: `0: Low`, `1: Moderate`, `2: Urgent`, `3: Critical`

### XGBoost
```
            Pred Low  Pred Mod  Pred Urg  Pred Crit
True Low         114         1         7          0
True Mod          16       554       100         18
True Urg           8        37       392         32
True Crit          6         4        44        667
```

### Random Forest
```
            Pred Low  Pred Mod  Pred Urg  Pred Crit
True Low         116         0         6          0
True Mod          19       542       109         18
True Urg          11        29       398         31
True Crit         12         5        37        667
```

---

## Key Clinical Safety Findings

1. **Under-Triage Risk Reduction:**
   In an emergency first-aid triage application, false negatives on Critical cases (classifying a dying or acute patient as Low or Moderate) can lead to life-threatening delays in hospital dispatch or resuscitation.
   - Random Forest downgraded **17** true Critical patients to Low or Moderate (12 to Low, 5 to Moderate).
   - XGBoost downgraded only **10** true Critical patients (6 to Low, 4 to Moderate).
   - XGBoost provides a **41% reduction** in dangerous under-triage of acute Critical patients.

2. **Deterministic Safety Net:**
   In addition to the ML pipeline, the application enforces deterministic safety overrides in `backend/app/services/severity_engine.py`:
   - `conscious == "no"` -> forced **Critical**
   - `breathing == "none"` -> forced **Critical**
   - `bleeding == "severe"` -> forced **Critical**
   This ensures that physical life threats are escalated regardless of statistical model uncertainty.

3. **Inference Latency:**
   In emergency QR-code scanning contexts, mobile users may have high network latency or limited cellular connectivity. An inference engine taking >1.5 seconds (Random Forest p95: 1,543 ms) degrades user responsiveness during crises. XGBoost operates with a consistent median latency of 53 ms and p95 of 82 ms.

4. **Resource Footprint:**
   At 2.03 MB, the XGBoost model pipeline loads instantaneously during FastAPI server startup, minimizing memory consumption in constrained deployment environments.

---

## Maintenance & Artifact Summary
- **Retained & Active Model Artifact:** `backend/app/ml_models/severity_model_pipeline.joblib`
- **Retained & Active Label Encoder:** `backend/app/ml_models/label_encoder.joblib`
- **Retained Active Training Script:** `backend/scripts/train_xgboost_severity_model.py`
- **Safely Removed Legacy Artifact:** `backend/app/ml_models/severity_random_forest.joblib` (31.25 MB)
- **Safely Removed Stray Artifact:** `backend/app/ml_models/label_encoder .joblib` (510 B)
- **Safely Removed Legacy Script:** `backend/scripts/train_severity_model.py` (legacy script with obsolete vitals)
- **Safely Removed Stale Copy:** `backend/scripts/label_encoder.joblib` (510 B)
