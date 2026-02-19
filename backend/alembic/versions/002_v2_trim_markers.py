"""
Alembic migration — v2 schema additions.

Adds:
  - videos.codec (VARCHAR 32)
  - videos.trim_start (FLOAT)
  - videos.trim_end (FLOAT)
  - scene_markers table
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = "002_v2_trim_markers"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Add v2 columns to videos ──────────────────────────────────────────
    op.add_column("videos", sa.Column("codec", sa.String(32), nullable=True))
    op.add_column("videos", sa.Column("trim_start", sa.Float(), nullable=True))
    op.add_column("videos", sa.Column("trim_end", sa.Float(), nullable=True))

    # ── Create scene_markers table ────────────────────────────────────────
    op.create_table(
        "scene_markers",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column(
            "video_id",
            UUID(as_uuid=True),
            sa.ForeignKey("videos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("timestamp", sa.Float(), nullable=False),
        sa.Column("label", sa.String(128), nullable=False),
        sa.Column("source", sa.String(32), server_default="focus_switch"),
        sa.Column("order", sa.Integer(), server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_scene_markers_video_id", "scene_markers", ["video_id"])


def downgrade() -> None:
    op.drop_index("ix_scene_markers_video_id", table_name="scene_markers")
    op.drop_table("scene_markers")
    op.drop_column("videos", "trim_end")
    op.drop_column("videos", "trim_start")
    op.drop_column("videos", "codec")
