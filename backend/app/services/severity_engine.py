KEYWORD_RULES = [
    {
        "category": "Snake bite",
        "keywords": ["snake", "bite", "bitten", "venom", "fang"],
        "critical_signals": ["can't breathe", "unresponsive", "unconscious"],
        "urgent_signals": ["swelling", "spreading", "dizzy", "dizziness"],
        "base_severity": "urgent",
    },
    {
        "category": "Heart attack",
        "keywords": ["chest pain", "heart", "chest tight", "crushing"],
        "critical_signals": ["can't breathe", "unresponsive", "unconscious", "collapsed"],
        "urgent_signals": ["sweating", "left arm", "shortness of breath"],
        "base_severity": "critical",
    },
    {
        "category": "Choking",
        "keywords": ["choking", "chok", "can't breathe", "throat", "swallowed"],
        "critical_signals": ["can't speak", "blue lips", "unresponsive"],
        "urgent_signals": ["coughing", "gagging"],
        "base_severity": "critical",
    },
    {
        "category": "Burn",
        "keywords": ["burn", "burned", "scald", "hot oil", "fire"],
        "critical_signals": ["large area", "face", "airway"],
        "urgent_signals": ["blister", "blistering", "charred"],
        "base_severity": "moderate",
    },
    {
        "category": "Fracture",
        "keywords": ["fracture", "broken bone", "broke my", "bone", "wrist", "leg pain"],
        "critical_signals": ["open wound", "bone visible"],
        "urgent_signals": ["swollen", "can't move", "deformed"],
        "base_severity": "urgent",
    },
    {
        "category": "Electric shock",
        "keywords": ["electric", "shock", "wire", "electrocut"],
        "critical_signals": ["unresponsive", "not breathing", "heart stopped"],
        "urgent_signals": ["numb", "burn mark", "tingling"],
        "base_severity": "urgent",
    },
    {
        "category": "Poisoning",
        "keywords": ["poison", "swallowed", "overdose", "vomiting blood"],
        "critical_signals": ["unresponsive", "not breathing", "seizure"],
        "urgent_signals": ["vomiting", "nausea", "blurred vision"],
        "base_severity": "urgent",
    },
]

CRITICAL_OVERRIDE_SIGNALS = [
    "unresponsive", "unconscious", "not breathing", "can't breathe",
    "no pulse", "heart stopped", "seizure", "collapsed",
]


def predict_severity(raw_text: str, selected_category: str | None = None):
    text = raw_text.lower()

    matched_rule = None
    matched_keywords = []

    if selected_category:
        matched_rule = next((r for r in KEYWORD_RULES if r["category"] == selected_category), None)

    if not matched_rule:
        best_score = 0
        for rule in KEYWORD_RULES:
            hits = [kw for kw in rule["keywords"] if kw in text]
            if len(hits) > best_score:
                best_score = len(hits)
                matched_rule = rule
                matched_keywords = hits

    if not matched_rule:
        has_critical = any(sig in text for sig in CRITICAL_OVERRIDE_SIGNALS)
        return {
            "emergency_type": selected_category,
            "severity_level": "critical" if has_critical else "moderate",
            "confidence_score": 0.3 if has_critical else 0.2,
            "reasoning": (
                "No specific emergency type was recognized, but critical warning signs were detected in the description."
                if has_critical else
                "No specific emergency type was recognized from the description. Defaulting to a moderate severity as a precaution."
            ),
        }

    category = matched_rule["category"]
    severity = matched_rule["base_severity"]
    reasons = [f"Symptoms matched the pattern for {category.lower()}."]

    critical_hits = [s for s in matched_rule["critical_signals"] if s in text]
    urgent_hits = [s for s in matched_rule["urgent_signals"] if s in text]

    if critical_hits:
        severity = "critical"
        reasons.append(f"Critical warning signs detected: {', '.join(critical_hits)}.")
    elif urgent_hits:
        if severity in ("low", "moderate"):
            severity = "urgent"
        reasons.append(f"Additional concerning signs noted: {', '.join(urgent_hits)}.")

    total_signals = len(matched_keywords) + len(critical_hits) + len(urgent_hits)
    confidence = min(0.4 + total_signals * 0.15, 0.95)

    return {
        "emergency_type": category,
        "severity_level": severity,
        "confidence_score": round(confidence, 2),
        "reasoning": " ".join(reasons),
    }