"""Tables. Les études et fournisseurs sont stockés en documents JSON (le modèle métier vit dans
l'application web) avec quelques colonnes indexées pour la recherche, et un numéro de version
pour détecter les modifications concurrentes entre postes."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def now() -> datetime:
    return datetime.now(timezone.utc)


class StudyRow(Base):
    __tablename__ = "studies"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    reference: Mapped[str] = mapped_column(String(100), index=True, default="")
    name: Mapped[str] = mapped_column(String(300), default="")
    client: Mapped[str] = mapped_column(String(300), default="")
    status: Mapped[str] = mapped_column(String(30), index=True, default="")
    due_date: Mapped[str] = mapped_column(String(10), index=True, default="")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    data: Mapped[dict] = mapped_column(JSON)


class SupplierRow(Base):
    __tablename__ = "suppliers"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(300), index=True, default="")
    version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    data: Mapped[dict] = mapped_column(JSON)


class SettingRow(Base):
    """Paramètres de l'application et marqueurs internes (clé → valeur JSON)."""

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    data: Mapped[dict] = mapped_column(JSON)


class FileRow(Base):
    """Métadonnées d'un fichier ; le contenu est sur disque (FILES_DIR)."""

    __tablename__ = "files"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(300), default="")
    mime: Mapped[str] = mapped_column(String(200), default="application/octet-stream")
    size: Mapped[int] = mapped_column(Integer, default=0)
    sha256: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class UserRow(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(20), default="chiffreur")
    password_hash: Mapped[str] = mapped_column(String(200))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Le mot de passe a été fixé par un administrateur : à changer à la première connexion.
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SessionRow(Base):
    __tablename__ = "sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
