export type SeverityLevel = "Low" | "Moderate" | "Urgent" | "Critical";

export type EmergencyType = {
  id: string;
  label: string;
  hint: string;
  baseSeverity: SeverityLevel;
  keywords: string[];
  steps: { title: string; detail: string }[];
  precautions: string[];
  avoid: string[];
};

export const EMERGENCY_TYPES: EmergencyType[] = [
  {
    id: "cardiac",
    label: "Chest pain / Heart attack",
    hint: "Chest pressure, breathlessness, collapse",
    baseSeverity: "Critical",
    keywords: ["chest", "heart", "pressure", "breath", "sweating", "collapse", "cpr"],
    steps: [
      { title: "Call emergency services now", detail: "Dial your local emergency number before starting any first aid. Keep the line open." },
      { title: "Sit the person down", detail: "Half-sitting position, knees bent, back supported. Loosen tight clothing." },
      { title: "Aspirin if available and not allergic", detail: "One adult aspirin (300 mg) chewed slowly, only if the person is conscious and has no known allergy." },
      { title: "Monitor breathing", detail: "If they stop breathing normally, begin chest compressions at 100–120 per minute, 5–6 cm deep." },
    ],
    precautions: ["Do not let them walk or drive themselves", "Stay with them until help arrives"],
    avoid: ["Do not give food or water", "Do not delay the emergency call to try remedies"],
  },
  {
    id: "burn",
    label: "Burn or scald",
    hint: "Heat, steam, chemical or electrical burns",
    baseSeverity: "Moderate",
    keywords: ["burn", "scald", "hot", "fire", "steam", "blister", "boiling"],
    steps: [
      { title: "Stop the burning", detail: "Move away from the heat source. Remove clothing or jewellery near the burn unless stuck to skin." },
      { title: "Cool with running water", detail: "Cool the burn under cool (not ice cold) running water for 20 minutes." },
      { title: "Cover loosely", detail: "Use cling film lengthwise or a clean non-fluffy cloth. Do not wrap tightly." },
      { title: "Keep the person warm", detail: "Cooling a large burn can cause hypothermia. Cover the rest of the body." },
    ],
    precautions: ["Seek care for burns larger than the person's palm, or on face, hands, joints or genitals"],
    avoid: ["No ice, butter, toothpaste or ointments", "Do not burst blisters"],
  },
  {
    id: "choking",
    label: "Choking",
    hint: "Cannot speak, cough or breathe",
    baseSeverity: "Critical",
    keywords: ["choke", "choking", "airway", "swallow", "stuck", "cough", "blue lips"],
    steps: [
      { title: "Encourage coughing", detail: "If they can cough or speak, let them keep coughing. Do not intervene physically." },
      { title: "Five back blows", detail: "Lean them forward, strike firmly between the shoulder blades with the heel of your hand." },
      { title: "Five abdominal thrusts", detail: "Stand behind, fist above the navel, pull sharply inwards and upwards. Alternate with back blows." },
      { title: "If they collapse", detail: "Call emergency services and begin CPR immediately." },
    ],
    precautions: ["Use chest thrusts instead of abdominal thrusts for infants and pregnant people"],
    avoid: ["Do not blindly sweep the mouth with fingers"],
  },
  {
    id: "fracture",
    label: "Fracture or fall injury",
    hint: "Deformity, swelling, cannot bear weight",
    baseSeverity: "Urgent",
    keywords: ["fracture", "break", "bone", "fall", "swelling", "deform", "sprain"],
    steps: [
      { title: "Keep the limb still", detail: "Support the injured area in the position found. Do not attempt to realign the bone." },
      { title: "Immobilise", detail: "Pad around the injury with soft material and use a sling or splint for support." },
      { title: "Apply a cold pack", detail: "Wrapped ice or cold pack for 15 minutes to reduce swelling. Never directly on skin." },
      { title: "Watch for shock", detail: "Pale, clammy skin or rapid breathing means shock — keep them warm and call for help." },
    ],
    precautions: ["Suspected spine or neck injury: do not move the person at all"],
    avoid: ["No food or drink in case surgery is needed"],
  },
  {
    id: "snakebite",
    label: "Snake bite",
    hint: "Puncture marks, swelling, spreading pain",
    baseSeverity: "Critical",
    keywords: ["snake", "bite", "venom", "fang", "swelling", "numb"],
    steps: [
      { title: "Move away and stay calm", detail: "Get out of the snake's range. Keep the person still — movement spreads venom faster." },
      { title: "Immobilise the limb", detail: "Keep the bitten limb below heart level and splint it lightly." },
      { title: "Remove constrictions", detail: "Take off rings, watches and tight clothing before swelling begins." },
      { title: "Transport to hospital", detail: "Antivenom is the only definitive treatment. Note the time of the bite." },
    ],
    precautions: ["Photograph the snake only if it is safe from a distance"],
    avoid: ["No tourniquets, cutting, suction or ice", "Do not attempt to catch the snake"],
  },
  {
    id: "shock-electric",
    label: "Electric shock",
    hint: "Contact with live current, burns at entry points",
    baseSeverity: "Urgent",
    keywords: ["electric", "shock", "current", "wire", "socket", "electrocution"],
    steps: [
      { title: "Cut the power first", detail: "Switch off at the mains. Never touch the person while they are in contact with the current." },
      { title: "Check responsiveness and breathing", detail: "Call emergency services. Start CPR if they are not breathing normally." },
      { title: "Treat burns", detail: "Cool entry and exit burn wounds with running water and cover loosely." },
      { title: "Keep them monitored", detail: "Electric shock can cause delayed heart rhythm problems — hospital assessment is required." },
    ],
    precautions: ["High-voltage incidents: stay at least 18 metres away and wait for professionals"],
    avoid: ["Do not use metal objects to move wires"],
  },
  {
    id: "bleeding",
    label: "Severe bleeding",
    hint: "Deep cut, heavy or spurting blood loss",
    baseSeverity: "Urgent",
    keywords: ["bleed", "blood", "cut", "wound", "gash", "laceration"],
    steps: [
      { title: "Apply direct pressure", detail: "Press firmly on the wound with a clean pad or cloth. Keep pressing continuously." },
      { title: "Raise the injured part", detail: "Where possible, elevate above heart level while maintaining pressure." },
      { title: "Add layers, do not remove", detail: "If blood soaks through, add another pad on top rather than lifting the first." },
      { title: "Treat for shock", detail: "Lay them down, keep them warm and call emergency services." },
    ],
    precautions: ["Use gloves or a barrier if available"],
    avoid: ["Do not remove an embedded object — pad around it instead"],
  },
  {
    id: "unconscious",
    label: "Unconscious / not responding",
    hint: "No response to voice or touch",
    baseSeverity: "Critical",
    keywords: ["unconscious", "faint", "collapse", "not breathing", "unresponsive", "seizure"],
    steps: [
      { title: "Check response and airway", detail: "Shout and gently shake the shoulders. Tilt the head back and lift the chin." },
      { title: "Check breathing for 10 seconds", detail: "Look, listen and feel. Gasping is not normal breathing." },
      { title: "Not breathing: start CPR", detail: "30 chest compressions, then 2 rescue breaths. Repeat until help arrives." },
      { title: "Breathing: recovery position", detail: "Roll onto their side, head tilted back, and monitor continuously." },
    ],
    precautions: ["Send someone for an AED if one is nearby"],
    avoid: ["Do not leave the person alone", "Do not give anything by mouth"],
  },
];

export const SEVERITY_ORDER: SeverityLevel[] = ["Low", "Moderate", "Urgent", "Critical"];

export const SEVERITY_META: Record<
  SeverityLevel,
  { token: "low" | "moderate" | "urgent" | "critical"; headline: string; action: string }
> = {
  Low: { token: "low", headline: "Low severity", action: "Self-care first aid is appropriate. Monitor for changes." },
  Moderate: { token: "moderate", headline: "Moderate severity", action: "Apply first aid and arrange a medical review today." },
  Urgent: { token: "urgent", headline: "Urgent", action: "Begin first aid and reach a hospital as soon as possible." },
  Critical: { token: "critical", headline: "Critical", action: "Call emergency services immediately and start first aid now." },
};

export type AssessmentInput = {
  emergencyId: string | null;
  symptoms: string;
  age: string;
  sex: "Male" | "Female" | "Other" | "Prefer not to say" | "";
  conscious: "yes" | "no" | "unsure";
  breathing: "normal" | "difficult" | "none";
  bleeding: "none" | "minor" | "severe";
  duration: "just-now" | "under-30" | "over-30";
  conditions: string[];
};

export type AssessmentResult = {
  severity: SeverityLevel;
  confidence: number;
  emergency: EmergencyType;
  extractedSymptoms: string[];
  factors: { label: string; weight: number; note: string }[];
  /** True when the backend used estimated (not measured) vital signs. */
  vitalsEstimated?: boolean;
};

export const DEFAULT_INPUT: AssessmentInput = {
  emergencyId: null,
  symptoms: "",
  age: "",
  sex: "",
  conscious: "yes",
  breathing: "normal",
  bleeding: "none",
  duration: "just-now",
  conditions: [],
};

const STOP = new Set(["the", "and", "with", "have", "has", "a", "an", "is", "of", "in", "on", "to", "very", "he", "she", "they"]);

/** Lightweight stand-in for the spaCy NLP step in the backend pipeline. */
export function extractSymptoms(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
  const vocabulary = new Set(EMERGENCY_TYPES.flatMap((e) => e.keywords));
  const extra = ["pain", "dizzy", "vomit", "fever", "numb", "swelling", "burning", "bleeding", "breathless", "weak"];
  extra.forEach((e) => vocabulary.add(e));
  const found = tokens.filter((t) => [...vocabulary].some((v) => t.startsWith(v.slice(0, 4))));
  return [...new Set(found)].slice(0, 8);
}

function matchEmergency(input: AssessmentInput): EmergencyType {
  if (input.emergencyId) {
    const found = EMERGENCY_TYPES.find((e) => e.id === input.emergencyId);
    if (found) return found;
  }
  const text = input.symptoms.toLowerCase();
  let best: EmergencyType = EMERGENCY_TYPES[0]!;
  let bestScore = -1;
  for (const e of EMERGENCY_TYPES) {
    const score = e.keywords.reduce((acc, k) => acc + (text.includes(k) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

/** Deterministic stand-in for the Random Forest severity classifier. */
export function assess(input: AssessmentInput): AssessmentResult {
  const emergency = matchEmergency(input);
  const factors: { label: string; weight: number; note: string }[] = [];

  let score = SEVERITY_ORDER.indexOf(emergency.baseSeverity) * 22 + 12;
  factors.push({
    label: `Emergency type: ${emergency.label}`,
    weight: SEVERITY_ORDER.indexOf(emergency.baseSeverity) * 22 + 12,
    note: `Baseline risk for this category is ${emergency.baseSeverity.toLowerCase()}.`,
  });

  if (input.breathing === "none") {
    score += 40;
    factors.push({ label: "No normal breathing", weight: 40, note: "Absent breathing is the strongest single predictor of critical outcome." });
  } else if (input.breathing === "difficult") {
    score += 18;
    factors.push({ label: "Breathing difficulty", weight: 18, note: "Respiratory distress raises the predicted severity band." });
  }

  if (input.conscious === "no") {
    score += 30;
    factors.push({ label: "Unresponsive", weight: 30, note: "Loss of consciousness indicates the airway may be at risk." });
  } else if (input.conscious === "unsure") {
    score += 12;
    factors.push({ label: "Responsiveness unclear", weight: 12, note: "Uncertain responsiveness is treated conservatively upward." });
  }

  if (input.bleeding === "severe") {
    score += 24;
    factors.push({ label: "Severe bleeding", weight: 24, note: "Heavy blood loss risks shock within minutes." });
  } else if (input.bleeding === "minor") {
    score += 6;
    factors.push({ label: "Minor bleeding", weight: 6, note: "Controlled bleeding adds only slight risk." });
  }

  const age = Number(input.age);
  if (!Number.isNaN(age) && input.age !== "") {
    if (age < 12 || age > 65) {
      score += 10;
      factors.push({ label: `Age ${age}`, weight: 10, note: "Children and older adults deteriorate faster in emergencies." });
    } else {
      factors.push({ label: `Age ${age}`, weight: 0, note: "Age is in the lower-risk band for this emergency." });
    }
  }

  if (input.conditions.length) {
    const w = Math.min(16, input.conditions.length * 8);
    score += w;
    factors.push({ label: `Existing conditions: ${input.conditions.join(", ")}`, weight: w, note: "Comorbidities increase the chance of complications." });
  }

  if (input.duration === "over-30") {
    score += 10;
    factors.push({ label: "Ongoing over 30 minutes", weight: 10, note: "Prolonged symptoms without improvement escalate urgency." });
  }

  const severity: SeverityLevel = score >= 90 ? "Critical" : score >= 62 ? "Urgent" : score >= 36 ? "Moderate" : "Low";
  const confidence = Math.min(97, 68 + Math.round(Math.abs(score - 60) / 3) + factors.length);

  return {
    severity,
    confidence,
    emergency,
    extractedSymptoms: extractSymptoms(input.symptoms),
    factors: factors.sort((a, b) => b.weight - a.weight),
  };
}

export type HospitalRec = {
  name: string;
  type: string;
  distanceKm: number;
  etaMin: number;
  capability: string[];
  open24: boolean;
  phone: string;
};

export const HOSPITALS: HospitalRec[] = [
  { name: "City General Hospital", type: "Multi-speciality · Level 1 trauma", distanceKm: 2.1, etaMin: 7, capability: ["Emergency", "Cardiac ICU", "Burns unit"], open24: true, phone: "+91 484 220 1100" },
  { name: "Riverside Emergency Care", type: "Emergency centre", distanceKm: 3.4, etaMin: 11, capability: ["Emergency", "Trauma", "Radiology"], open24: true, phone: "+91 484 220 4477" },
  { name: "St. Anne's Community Clinic", type: "Primary care clinic", distanceKm: 1.2, etaMin: 5, capability: ["Minor injuries", "Dressing", "Observation"], open24: false, phone: "+91 484 220 8890" },
  { name: "Northgate Poison & Toxicology Centre", type: "Speciality centre", distanceKm: 6.8, etaMin: 18, capability: ["Antivenom", "Poison control", "ICU"], open24: true, phone: "+91 484 220 9012" },
];

const KEY = "smartaid.session.v1";

export type Session = { input: AssessmentInput; result: AssessmentResult | null; startedAt: string };

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable */
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
}

export function reportId(startedAt: string) {
  const d = new Date(startedAt);
  return `SA-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
}
