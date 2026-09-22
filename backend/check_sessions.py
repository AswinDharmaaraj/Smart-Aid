"""
Quick diagnostic script for SmartAid AI.
Shows every session ever created, joined with any symptom data submitted
for it, plus a summary count at the end.

Run from the backend/ folder with venv active:
    python check_sessions.py
"""

from app.db.session import SessionLocal
from app.models.session import Session
from app.models.symptom_input import SymptomInput

db = SessionLocal()

sessions = db.query(Session).order_by(Session.session_id).all()
symptom_count = 0
no_symptom_count = 0

print("=" * 90)
print(f"{'Session':<10}{'QR Code':<10}{'User':<8}{'Category':<28}{'Symptom Text'}")
print("=" * 90)

for s in sessions:
    symptoms = (
        db.query(SymptomInput)
        .filter(SymptomInput.session_id == s.session_id)
        .order_by(SymptomInput.input_id)
        .all()
    )
    user_display = str(s.user_id) if s.user_id else "-"

    if symptoms:
        for sym in symptoms:
            symptom_count += 1
            category = sym.category or "(none)"
            text_preview = sym.raw_text[:45].replace("\n", " ")
            print(f"{s.session_id:<10}{s.qr_code_id:<10}{user_display:<8}{category:<28}{text_preview}")
    else:
        no_symptom_count += 1
        print(f"{s.session_id:<10}{s.qr_code_id:<10}{user_display:<8}{'(no symptom submitted)':<28}")

print("=" * 90)
print(f"Total sessions:              {len(sessions)}")
print(f"Sessions WITH symptom data:  {symptom_count}")
print(f"Sessions with NO submission: {no_symptom_count}")
print(f"Sessions linked to a user:   {sum(1 for s in sessions if s.user_id)}")
print("=" * 90)