"""seed_direct_start_qr_code

Revision ID: c4e8a1f02d73
Revises: f2a03214cdc2
Create Date: 2026-09-23 21:17:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4e8a1f02d73'
down_revision: Union[str, Sequence[str], None] = 'f2a03214cdc2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Well-known QR code ID used by the frontend "Start assessment" and
# "Continue without scanning" buttons so that direct-start sessions
# are registered in the DB exactly like QR-scanned sessions.
DIRECT_START_QR_ID = 1


def upgrade() -> None:
    """Seed a permanent 'Direct Start (Walk-in)' QR code row."""
    # Use raw SQL with ON CONFLICT so the migration is idempotent —
    # safe to re-run if a row with this ID already exists.
    op.execute(
        sa.text(
            """
            INSERT INTO qr_codes (qr_code_id, location_name, install_site, status)
            VALUES (:id, :loc, :site, 'active')
            ON CONFLICT (qr_code_id) DO NOTHING
            """
        ).bindparams(
            id=DIRECT_START_QR_ID,
            loc="Direct Start (Walk-in)",
            site="Homepage / Scan page — no physical QR code",
        )
    )


def downgrade() -> None:
    """Remove the seeded walk-in QR code (only if no sessions reference it)."""
    op.execute(
        sa.text(
            "DELETE FROM qr_codes WHERE qr_code_id = :id"
        ).bindparams(id=DIRECT_START_QR_ID)
    )
