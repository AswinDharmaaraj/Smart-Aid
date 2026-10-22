"""
SmartAid AI — First Aid Guidance Service

Provides structured, step-by-step first-aid instructions keyed by emergency
category and severity level.  Content is adapted from publicly available
first-aid guidelines (British Red Cross, St John Ambulance, WHO).

IMPORTANT SAFETY NOTE
---------------------
This service is a DECISION SUPPORT tool.  It does NOT constitute medical
advice or clinical diagnosis.  Critical safety warnings (e.g. "call 112")
are ALWAYS included for Urgent and Critical presentations regardless of the
ML-predicted severity, because the model's output must never suppress a
life-saving action.

No DB writes.  Pure read + compute — stateless.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

# ---------------------------------------------------------------------------
# Data model returned by this service
# ---------------------------------------------------------------------------

@dataclass
class FirstAidStep:
    title: str
    detail: str


@dataclass
class FirstAidGuide:
    emergency_category: str          # canonical category name
    severity_level: str              # low | moderate | urgent | critical
    call_emergency: bool             # True → always show "Call 112 / 999" prominently
    severity_note: str               # plain-language severity context sentence
    steps: list[FirstAidStep] = field(default_factory=list)
    precautions: list[str]   = field(default_factory=list)
    avoid: list[str]         = field(default_factory=list)
    disclaimer: str = (
        "This guidance is for decision support only and does not replace "
        "professional medical advice.  When in doubt, call emergency services."
    )


# ---------------------------------------------------------------------------
# Internal guidance library — one entry per (category, severity) pair.
# Fallback: if a (category, severity) pair is missing we serve the category's
# baseline (moderate) entry so the caller always receives actionable content.
# ---------------------------------------------------------------------------

# Sentinel for "any severity" entries used as fallback within a category.
_ANY = "__any__"

# Structure:  _LIBRARY[category][severity] = FirstAidGuide
_LIBRARY: dict[str, dict[str, FirstAidGuide]] = {}


def _reg(category: str, severity: str, guide: FirstAidGuide) -> None:
    _LIBRARY.setdefault(category, {})[severity] = guide


# ── CARDIAC ────────────────────────────────────────────────────────────────────
_reg("Cardiac", _ANY, FirstAidGuide(
    emergency_category="Cardiac",
    severity_level="urgent",
    call_emergency=True,
    severity_note=(
        "Chest pain or suspected heart attack always requires immediate "
        "emergency services — do not wait for symptoms to improve."
    ),
    steps=[
        FirstAidStep("Call emergency services immediately",
                     "Dial 112 (or your local emergency number) right now. "
                     "Keep the line open and follow the dispatcher's instructions."),
        FirstAidStep("Sit the person down and keep them still",
                     "Help them sit in a half-upright position with knees bent "
                     "and back supported.  Loosen tight clothing around the neck and chest."),
        FirstAidStep("Give aspirin if available and not contraindicated",
                     "300 mg adult aspirin chewed slowly — only if the person is "
                     "conscious, able to swallow, and has no known aspirin allergy "
                     "or bleeding disorder."),
        FirstAidStep("Monitor breathing and pulse continuously",
                     "Stay with the person.  If they become unresponsive and stop "
                     "breathing normally, begin hands-only CPR: 100–120 chest compressions "
                     "per minute, 5–6 cm deep, until help arrives."),
        FirstAidStep("Use an AED if available",
                     "Switch on the AED and follow its spoken instructions. "
                     "Continue CPR until the AED is ready to analyse the rhythm."),
    ],
    precautions=[
        "Do not leave the person alone.",
        "Do not allow them to walk or drive.",
        "If they have prescribed GTN spray or tablets, assist them in using it.",
    ],
    avoid=[
        "Do not give food or drink.",
        "Do not delay the emergency call to try home remedies.",
        "Do not assume the symptoms are indigestion without medical assessment.",
    ],
))

# ── RESPIRATORY / CHOKING ───────────────────────────────────────────────────────
_reg("Respiratory", "low", FirstAidGuide(
    emergency_category="Respiratory",
    severity_level="low",
    call_emergency=False,
    severity_note="Mild breathing difficulty — monitor closely and seek medical advice if symptoms worsen.",
    steps=[
        FirstAidStep("Keep the person calm and upright",
                     "Sit them upright, leaning slightly forward.  Anxiety worsens breathlessness."),
        FirstAidStep("Loosen tight clothing",
                     "Undo collars, ties or tight belts to allow freer chest movement."),
        FirstAidStep("Encourage slow, controlled breathing",
                     "Breathe in through the nose for 4 counts, out through pursed lips for 6 counts."),
        FirstAidStep("Assess for worsening signs",
                     "If lips or fingernails turn blue, breathing becomes very fast or laboured, "
                     "or the person cannot complete a sentence, call emergency services immediately."),
    ],
    precautions=["Monitor oxygen saturation if a pulse oximeter is available.",
                 "Do not leave if the person is anxious or deteriorating."],
    avoid=["Do not give the person food or drink during breathing difficulty.",
           "Do not ask them to lie flat."],
))

_reg("Respiratory", _ANY, FirstAidGuide(
    emergency_category="Respiratory",
    severity_level="urgent",
    call_emergency=True,
    severity_note=(
        "Severe breathing difficulty or choking is a life-threatening emergency. "
        "Call emergency services immediately."
    ),
    steps=[
        FirstAidStep("Call emergency services immediately", "Dial 112 now."),
        FirstAidStep("Encourage coughing if partially blocked",
                     "If the person can cough, speak or cry, encourage them to keep coughing forcefully. "
                     "Do not perform back blows while they can still cough."),
        FirstAidStep("Five firm back blows",
                     "Lean them forward, support the chest with one hand. "
                     "Strike firmly between the shoulder blades with the heel of your hand, five times."),
        FirstAidStep("Five abdominal thrusts (Heimlich manoeuvre)",
                     "Stand behind them, make a fist above the navel below the ribs, cover with "
                     "your other hand, and pull sharply inwards and upwards.  Alternate with back blows."),
        FirstAidStep("If they become unresponsive",
                     "Lower them carefully to the floor.  Call 112 if not already done. "
                     "Begin CPR — chest compressions may dislodge the obstruction."),
    ],
    precautions=[
        "For infants under 1 year: use 5 back blows + 5 chest thrusts only — NO abdominal thrusts.",
        "For pregnant people: use chest thrusts instead of abdominal thrusts.",
    ],
    avoid=["Do not perform a blind finger sweep of the mouth.",
           "Do not give water or food."],
))

# ── BURN ───────────────────────────────────────────────────────────────────────
_reg("Burn", "low", FirstAidGuide(
    emergency_category="Burn",
    severity_level="low",
    call_emergency=False,
    severity_note="Minor burn — home first aid is appropriate but seek medical review for burns larger than the person's palm.",
    steps=[
        FirstAidStep("Remove from heat source", "Move away from the source of heat and ensure safety."),
        FirstAidStep("Cool under running water for 20 minutes",
                     "Use cool (not ice cold) running water.  Start within 3 hours of the burn for best effect."),
        FirstAidStep("Remove clothing and jewellery near the burn",
                     "Only if not stuck to the skin.  Swelling can make rings and watches dangerous."),
        FirstAidStep("Cover loosely with cling film or a clean dressing",
                     "Apply cling film lengthwise (not circumferentially) or a non-fluffy sterile pad."),
        FirstAidStep("Take over-the-counter pain relief if needed",
                     "Paracetamol or ibuprofen as per the packet instructions, unless contraindicated."),
    ],
    precautions=["Seek urgent care for burns to the face, hands, feet, genitals, or joints.",
                 "Watch for signs of infection over the next 48 hours (increased redness, swelling, pus, fever)."],
    avoid=["No ice, butter, toothpaste, oils or household remedies.",
           "Do not burst blisters.",
           "Do not remove clothing stuck to the skin."],
))

_reg("Burn", _ANY, FirstAidGuide(
    emergency_category="Burn",
    severity_level="urgent",
    call_emergency=True,
    severity_note="Severe or large-area burn — call emergency services and begin cooling immediately.",
    steps=[
        FirstAidStep("Call emergency services immediately", "Dial 112 now."),
        FirstAidStep("Ensure safety", "If chemical burn, avoid contact. If electrical burn, do not touch until power is off."),
        FirstAidStep("Cool the burn under running water for 20 minutes",
                     "Do not delay — cooling reduces tissue damage. Keep the rest of the body warm."),
        FirstAidStep("Remove loose clothing and jewellery near the burn",
                     "Only items that are not stuck to the skin."),
        FirstAidStep("Cover the burn loosely",
                     "Cling film lengthwise or a non-fluffy sterile dressing. Do not wrap tightly."),
        FirstAidStep("Treat for shock if needed",
                     "Lay the person down, elevate the legs (unless the burn is on the legs or there is a head/spine injury). "
                     "Keep them warm with a blanket over unburned areas."),
    ],
    precautions=["Monitor breathing — airway burns can swell rapidly.",
                 "Do not remove clothing stuck to the skin.",
                 "For chemical burns, brush off dry chemical before water if safe to do so."],
    avoid=["No ice, butter, toothpaste or any topical remedies.",
           "Do not leave the person alone.",
           "Do not give food or drink in case surgery is required."],
))

# ── INJURY / FRACTURE / BLEEDING ───────────────────────────────────────────────
_reg("Injury", "low", FirstAidGuide(
    emergency_category="Injury",
    severity_level="low",
    call_emergency=False,
    severity_note="Minor injury — rest, ice, compression and elevation are usually appropriate.",
    steps=[
        FirstAidStep("Control any bleeding",
                     "Apply firm, direct pressure with a clean cloth or dressing for at least 10 minutes without lifting."),
        FirstAidStep("Apply RICE for sprains/strains",
                     "Rest the injured area.  Ice pack (wrapped — never direct) for 15–20 minutes every 2 hours. "
                     "Compression bandage if available. Elevate above heart level."),
        FirstAidStep("Seek medical advice",
                     "Attend a minor injuries unit or GP if swelling is significant or pain does not improve within 24 hours."),
    ],
    precautions=["Watch for increasing swelling, numbness, tingling or colour change — these suggest a fracture."],
    avoid=["Do not apply ice directly to skin.",
           "Do not apply a tourniquet for minor bleeding."],
))

_reg("Injury", _ANY, FirstAidGuide(
    emergency_category="Injury",
    severity_level="urgent",
    call_emergency=True,
    severity_note="Significant injury with possible fracture or severe bleeding — call emergency services.",
    steps=[
        FirstAidStep("Call emergency services if severe bleeding or suspected spine/head injury", "Dial 112."),
        FirstAidStep("Control bleeding with direct pressure",
                     "Press firmly with a clean cloth or dressing for at least 10 minutes without lifting.  "
                     "If blood soaks through, add more material on top — do not remove."),
        FirstAidStep("Immobilise suspected fractures",
                     "Support the injured limb in the position found.  Do not try to straighten it. "
                     "Use padding, a sling or improvised splint to keep it still."),
        FirstAidStep("Watch for and treat shock",
                     "Signs: pale or grey skin, rapid shallow breathing, confusion, weakness.  "
                     "Lay the person down, elevate legs if no leg or spine injury. Keep warm."),
        FirstAidStep("Do not move the person if a spine injury is suspected",
                     "Only move if there is immediate danger (e.g. fire).  Support the head and neck."),
    ],
    precautions=["Suspected pelvic or femur fracture: do not elevate the legs.",
                 "Open fracture with bone visible: cover loosely, do not push bone back."],
    avoid=["Do not remove an embedded object — pad around it.",
           "Do not give food or drink.",
           "Do not apply a tourniquet unless trained and bleeding is otherwise uncontrollable."],
))

# ── SNAKE BITE ─────────────────────────────────────────────────────────────────
_reg("Snake bite", _ANY, FirstAidGuide(
    emergency_category="Snake bite",
    severity_level="urgent",
    call_emergency=True,
    severity_note=(
        "All snake bites should be treated as a potential medical emergency. "
        "Antivenom may be required — call emergency services immediately."
    ),
    steps=[
        FirstAidStep("Call emergency services immediately", "Dial 112.  Note the time of the bite."),
        FirstAidStep("Keep the person still and calm",
                     "Physical activity accelerates venom spread through the lymphatic system. "
                     "Lie the person down if possible."),
        FirstAidStep("Immobilise the bitten limb",
                     "Keep the limb below heart level.  Immobilise with a splint or sling."),
        FirstAidStep("Remove constricting items",
                     "Remove rings, watches, and tight clothing near the bite site — swelling can be rapid."),
        FirstAidStep("Note the snake's appearance if safe",
                     "Do not attempt to catch or kill the snake.  A photograph from a safe distance "
                     "or a description helps medical staff identify the species and select antivenom."),
        FirstAidStep("Monitor for anaphylaxis",
                     "Hives, throat tightening, or collapse require immediate adrenaline (epi-pen) if available."),
    ],
    precautions=["Reassess every 5 minutes for swelling progression, limb discoloration, or altered consciousness."],
    avoid=["Do not cut the wound or attempt to suck out venom.",
           "Do not apply a tourniquet or ice.",
           "Do not give alcohol.",
           "Do not apply electric shock — no evidence of benefit, risk of harm."],
))

# ── ELECTRIC SHOCK ─────────────────────────────────────────────────────────────
_reg("Electric shock", _ANY, FirstAidGuide(
    emergency_category="Electric shock",
    severity_level="urgent",
    call_emergency=True,
    severity_note=(
        "Electrical injury requires emergency assessment even if the person appears unharmed. "
        "Internal burns and cardiac arrhythmias may not be immediately visible."
    ),
    steps=[
        FirstAidStep("Do NOT touch the person until power is off",
                     "Switch off the power at the mains or circuit breaker. "
                     "If you cannot isolate the supply, use a non-conducting object "
                     "(dry wood, plastic) to move the source away.  Never use metal."),
        FirstAidStep("Call emergency services immediately", "Dial 112 as soon as it is safe to approach."),
        FirstAidStep("Check breathing and pulse",
                     "Electric shock can cause cardiac arrest.  Begin CPR if the person is "
                     "unresponsive and not breathing normally."),
        FirstAidStep("Treat visible burns",
                     "Cool any entry/exit burn wounds with cool running water for 20 minutes.  "
                     "Cover loosely with a non-fluffy sterile dressing."),
        FirstAidStep("Lay the person down and keep them warm",
                     "Even if they seem well, they must be assessed by a doctor.  "
                     "Monitor for delayed collapse."),
    ],
    precautions=["High-voltage electricity (overhead lines, railways): stay at least 18 m away.  "
                 "Only emergency services can isolate high-voltage supply."],
    avoid=["Do not approach the person until the electrical source is confirmed off.",
           "Do not use wet materials or metal objects to separate from the source."],
))

# ── NEUROLOGICAL / UNCONSCIOUS ─────────────────────────────────────────────────
_reg("Neurological", "low", FirstAidGuide(
    emergency_category="Neurological",
    severity_level="low",
    call_emergency=False,
    severity_note="Mild neurological symptoms — monitor closely and seek medical advice promptly.",
    steps=[
        FirstAidStep("Keep the person calm and seated",
                     "Sudden movements can worsen dizziness or headache."),
        FirstAidStep("Assess for red flags",
                     "Sudden worst-ever headache, slurred speech, facial drooping, arm weakness, "
                     "vision changes, or confusion are stroke warning signs — call 112 immediately."),
        FirstAidStep("Monitor every 5 minutes",
                     "Record any changes in responsiveness, speech, or limb movement."),
    ],
    precautions=["Any loss of consciousness, even briefly, requires emergency assessment."],
    avoid=["Do not leave the person alone.",
           "Do not give medication without medical advice."],
))

_reg("Neurological", _ANY, FirstAidGuide(
    emergency_category="Neurological",
    severity_level="urgent",
    call_emergency=True,
    severity_note=(
        "Unresponsiveness or seizure is a medical emergency. "
        "Call emergency services and begin safe positioning immediately."
    ),
    steps=[
        FirstAidStep("Call emergency services immediately", "Dial 112."),
        FirstAidStep("Protect from injury during seizure",
                     "Clear the area of hard objects.  Do not restrain limbs.  "
                     "Cushion the head with something soft.  Time the seizure."),
        FirstAidStep("Recovery position after seizure ends",
                     "Once convulsions stop, turn the person onto their side (recovery position) "
                     "to keep the airway clear.  Tilt the head back slightly."),
        FirstAidStep("If unconscious but breathing",
                     "Place in the recovery position.  Monitor breathing every minute."),
        FirstAidStep("If not breathing normally",
                     "Begin CPR: 30 chest compressions (100–120 per minute, 5–6 cm deep), "
                     "then 2 rescue breaths.  Use an AED if available."),
    ],
    precautions=["A second seizure within 24 hours always requires emergency assessment.",
                 "Do not put anything in the mouth during a seizure."],
    avoid=["Do not restrain the person during a seizure.",
           "Do not give food, drink or medication while they are unconscious.",
           "Do not leave alone until fully conscious and oriented."],
))

# ── GASTROINTESTINAL ───────────────────────────────────────────────────────────
_reg("Gastrointestinal", "low", FirstAidGuide(
    emergency_category="Gastrointestinal",
    severity_level="low",
    call_emergency=False,
    severity_note="Mild gastrointestinal symptoms — keep hydrated and monitor.",
    steps=[
        FirstAidStep("Rest and hydrate",
                     "Small sips of water or oral rehydration solution.  Avoid dairy, fatty or spicy food."),
        FirstAidStep("Monitor for worsening",
                     "Seek urgent care if symptoms persist beyond 24 hours, if there is blood in "
                     "vomit or stool, or if pain is severe or constant."),
    ],
    precautions=["Children and older adults dehydrate faster — seek medical advice earlier."],
    avoid=["Do not give anti-diarrhoeal medication to children under 12 without medical advice."],
))

_reg("Gastrointestinal", _ANY, FirstAidGuide(
    emergency_category="Gastrointestinal",
    severity_level="urgent",
    call_emergency=True,
    severity_note="Severe abdominal symptoms may indicate a surgical emergency — seek immediate assessment.",
    steps=[
        FirstAidStep("Call emergency services or go to A&E immediately", "Dial 112."),
        FirstAidStep("Keep the person still and comfortable",
                     "Lying down with knees bent may ease abdominal pain."),
        FirstAidStep("Do not give food or drink",
                     "Surgery may be required — an empty stomach is essential."),
        FirstAidStep("Monitor closely",
                     "Note any vomiting, fever, rigid abdomen, or altered consciousness."),
    ],
    precautions=["Board-like rigid abdomen with fever suggests peritonitis — a surgical emergency."],
    avoid=["Do not give painkillers unless directed by a dispatcher or clinician.",
           "Do not apply heat to the abdomen."],
))

# ── FEVER / INFECTION ─────────────────────────────────────────────────────────
_reg("Fever/Infection", "low", FirstAidGuide(
    emergency_category="Fever/Infection",
    severity_level="low",
    call_emergency=False,
    severity_note="Mild fever — rest, hydration, and antipyretics are appropriate first steps.",
    steps=[
        FirstAidStep("Keep the person hydrated",
                     "Small frequent sips of water or oral rehydration solution."),
        FirstAidStep("Use antipyretics if appropriate",
                     "Paracetamol or ibuprofen as directed on the packet (not both at the same time "
                     "without medical advice).  Do not give aspirin to children under 16."),
        FirstAidStep("Rest in a comfortable environment",
                     "Room temperature clothing and bedding.  Avoid over-wrapping."),
        FirstAidStep("Monitor temperature every 2 hours",
                     "Seek medical advice if fever exceeds 39.5 °C in adults, any fever in infants under 3 months, "
                     "or if it persists beyond 3 days."),
    ],
    precautions=["Febrile convulsions in children: do not restrain.  Lay on side, call 112 if it lasts over 5 minutes."],
    avoid=["Do not use cold baths or alcohol sponging to lower temperature.",
           "Do not give aspirin to anyone under 16."],
))

_reg("Fever/Infection", _ANY, FirstAidGuide(
    emergency_category="Fever/Infection",
    severity_level="urgent",
    call_emergency=True,
    severity_note=(
        "High fever with altered consciousness, rash, stiff neck, or rapid deterioration "
        "may indicate sepsis or meningitis — call emergency services immediately."
    ),
    steps=[
        FirstAidStep("Call emergency services immediately", "Dial 112."),
        FirstAidStep("Lay the person down and keep them warm",
                     "Monitor breathing and responsiveness every minute."),
        FirstAidStep("Non-blanching rash test",
                     "Press a clear glass against a rash — if it does not fade under pressure, "
                     "this may indicate meningococcal disease.  This is a critical emergency."),
        FirstAidStep("Do not give food or drink",
                     "Hospital treatment may be required urgently."),
    ],
    precautions=["Sepsis warning signs (NEWS): confusion, fast breathing, mottled or pale skin — act immediately."],
    avoid=["Do not delay calling for help to attempt home remedies.",
           "Do not give aspirin."],
))

# ── POISONING ─────────────────────────────────────────────────────────────────
_reg("Poisoning", _ANY, FirstAidGuide(
    emergency_category="Poisoning",
    severity_level="urgent",
    call_emergency=True,
    severity_note=(
        "Suspected poisoning always requires emergency services or Poison Control. "
        "Do not induce vomiting unless specifically instructed."
    ),
    steps=[
        FirstAidStep("Call emergency services or Poison Control immediately",
                     "Dial 112.  In India: National Poison Information Centre 1800-116-117.  "
                     "Have the substance or its container ready to describe."),
        FirstAidStep("Keep the person calm and still",
                     "Do not give anything by mouth unless instructed by the dispatcher."),
        FirstAidStep("If unconscious and breathing",
                     "Recovery position — on their side, airway clear.  Monitor every minute."),
        FirstAidStep("If not breathing normally",
                     "Begin CPR.  Note: for corrosive or pesticide poisoning, use a face shield or cloth barrier "
                     "for rescue breaths if possible."),
        FirstAidStep("Preserve evidence",
                     "Keep containers, pills, or a sample of the substance for the medical team."),
    ],
    precautions=["For skin contact with chemical: rinse with large amounts of water for at least 20 minutes.",
                 "For eye contact: rinse with clean water, keeping eyelids open."],
    avoid=["Do NOT induce vomiting unless directed by Poison Control — for corrosives this causes further damage.",
           "Do not give milk or water to neutralise the substance without medical guidance.",
           "Do not leave alone."],
))

# ── GENERAL (catch-all) ────────────────────────────────────────────────────────
_reg("General", "low", FirstAidGuide(
    emergency_category="General",
    severity_level="low",
    call_emergency=False,
    severity_note="Symptoms appear mild at this time — monitor closely and seek medical advice if there is any doubt.",
    steps=[
        FirstAidStep("Keep the person calm and comfortable",
                     "Sit or lie them in a position that feels best for them."),
        FirstAidStep("Monitor symptoms every 5 minutes",
                     "Note any changes — deterioration should prompt an immediate call to emergency services."),
        FirstAidStep("Seek medical advice",
                     "Contact a GP, nurse helpline (e.g. NHS 111 in UK, 104 in India) or attend a minor injuries unit."),
    ],
    precautions=["If in doubt, call emergency services — it is always better to be cautious."],
    avoid=["Do not give medication without knowing the person's allergies and current medications."],
))

_reg("General", _ANY, FirstAidGuide(
    emergency_category="General",
    severity_level="urgent",
    call_emergency=True,
    severity_note="Severity signals are present — emergency services should be contacted.",
    steps=[
        FirstAidStep("Call emergency services immediately", "Dial 112."),
        FirstAidStep("Keep the person safe and comfortable",
                     "Sit or lay them down depending on symptoms.  Stay with them."),
        FirstAidStep("Monitor airway, breathing, circulation",
                     "If they become unresponsive and stop breathing normally, begin CPR."),
    ],
    precautions=["Follow dispatcher instructions precisely until help arrives."],
    avoid=["Do not leave the person alone.",
           "Do not give food or drink."],
))

# ── Unknown / unmapped ─────────────────────────────────────────────────────────
_reg("Unknown", _ANY, FirstAidGuide(
    emergency_category="Unknown",
    severity_level="moderate",
    call_emergency=False,
    severity_note=(
        "Emergency type could not be determined from the available information. "
        "General first-aid guidance is shown below."
    ),
    steps=[
        FirstAidStep("Ensure the scene is safe", "Do not put yourself at risk approaching the person."),
        FirstAidStep("Check responsiveness", "Tap the shoulder and call their name."),
        FirstAidStep("Call emergency services if unresponsive or breathing abnormally", "Dial 112."),
        FirstAidStep("Maintain airway, breathing, circulation",
                     "If trained, begin CPR if the person is not breathing normally."),
        FirstAidStep("Keep the person warm and still", "Reassure them until help arrives."),
    ],
    precautions=["If in any doubt about severity, call emergency services immediately."],
    avoid=["Do not move the person if a spine injury is possible."],
))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

# Severity levels that always require call_emergency = True
_ALWAYS_CALL = {"urgent", "critical"}

# Canonical category set (matches severity_engine.CATEGORY_MAPPING targets)
_KNOWN_CATEGORIES = set(_LIBRARY.keys())


def get_guidance(
    emergency_category: str,
    severity_level: str,
    age: Optional[float] = None,
    conditions: Optional[list[str]] = None,
) -> FirstAidGuide:
    """
    Return a FirstAidGuide for the given emergency category and severity.

    Safety guarantee:
        If severity_level is 'urgent' or 'critical', call_emergency is ALWAYS
        set to True regardless of the stored guide — the ML model's output must
        never suppress a life-saving call to emergency services.

    Args:
        emergency_category: Category string as returned by severity_engine
                            (e.g. "Cardiac", "Burn", "General").
        severity_level:     One of low | moderate | urgent | critical.
        age:                Patient age in years (optional, for personalisation notes).
        conditions:         List of existing conditions (optional).

    Returns:
        A FirstAidGuide dataclass (always non-None).
    """
    severity_lower = (severity_level or "moderate").lower()
    category = emergency_category or "Unknown"

    cat_guides = _LIBRARY.get(category) or _LIBRARY.get("General") or {}

    # Prefer exact severity match, then _ANY fallback, then first available
    guide = (
        cat_guides.get(severity_lower)
        or cat_guides.get(_ANY)
        or next(iter(cat_guides.values()), None)
        or _LIBRARY["Unknown"][_ANY]
    )

    # --- Safety override: urgent/critical MUST set call_emergency = True ---
    import copy
    guide = copy.deepcopy(guide)  # don't mutate the shared constant
    guide.severity_level = severity_lower
    if severity_lower in _ALWAYS_CALL:
        guide.call_emergency = True
        # Ensure "Call emergency services" is always the FIRST step
        if not any("112" in s.detail or "emergency services" in s.title.lower()
                   for s in guide.steps):
            guide.steps.insert(0, FirstAidStep(
                "Call emergency services immediately",
                "Dial 112 (or your local emergency number) now. Keep the line open.",
            ))

    # --- Paediatric note (age < 12) ---
    if age is not None and age < 12:
        guide.precautions = list(guide.precautions)  # ensure mutable copy
        guide.precautions.insert(0,
            "PAEDIATRIC PATIENT: Dosing of any medication must be weight-based. "
            "CPR compression depth for infants is 4 cm; for children 5 cm. "
            "Use two-finger technique for infants under 1 year.")

    # --- Condition-specific cautions ---
    if conditions:
        conds_lower = {c.lower() for c in conditions}
        notes: list[str] = []
        if any(k in conds_lower for k in ("diabetes", "diabetic")):
            notes.append("Diabetes: check blood glucose if meter is available. Hypoglycaemia can mimic stroke or collapse.")
        if any(k in conds_lower for k in ("heart disease", "heart failure", "cardiac")):
            notes.append("Pre-existing cardiac condition: higher risk of arrhythmia — prioritise early defibrillation if available.")
        if any(k in conds_lower for k in ("asthma",)):
            notes.append("Asthma: assist with prescribed reliever inhaler (blue) if available. Up to 10 puffs via spacer in emergency.")
        if any(k in conds_lower for k in ("blood thinner", "warfarin", "anticoagulant", "aspirin")):
            notes.append("Anticoagulant therapy: even minor bleeding may be serious. Seek medical review promptly.")
        if notes:
            guide.precautions = list(guide.precautions) + notes

    return guide
