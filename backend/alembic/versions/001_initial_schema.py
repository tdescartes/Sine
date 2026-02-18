"""initial schema

Revision ID: 001
Revises: 
Create Date: 2026-02-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "videos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("s3_key", sa.String(512), unique=True, nullable=True),
        sa.Column("status", sa.String(32), server_default="recording"),
        sa.Column("duration", sa.Float(), nullable=True),
        sa.Column("upload_id", sa.String(512), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()")),
    )

    op.create_table(
        "annotations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("video_id", UUID(as_uuid=True), sa.ForeignKey("videos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("timestamp", sa.Float(), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("type", sa.String(32), server_default="comment"),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()")),
    )

    op.create_index("ix_annotations_video_id", "annotations", ["video_id"])


def downgrade() -> None:
    op.drop_index("ix_annotations_video_id", "annotations")
    op.drop_table("annotations")
    op.drop_table("videos")
