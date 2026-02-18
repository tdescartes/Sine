"""SQLAlchemy ORM models — mirrors the PostgreSQL schema in SPEC.md."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    s3_key: Mapped[str | None] = mapped_column(String(512), unique=True, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="recording")
    duration: Mapped[float | None] = mapped_column(Float, nullable=True)
    upload_id: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    annotations: Mapped[list["Annotation"]] = relationship(
        back_populates="video", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Video {self.id} status={self.status}>"


class Annotation(Base):
    __tablename__ = "annotations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE")
    )
    timestamp: Mapped[float] = mapped_column(Float, nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    type: Mapped[str] = mapped_column(String(32), default="comment")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    video: Mapped["Video"] = relationship(back_populates="annotations")

    def __repr__(self) -> str:
        return f"<Annotation {self.id} @{self.timestamp}s type={self.type}>"
