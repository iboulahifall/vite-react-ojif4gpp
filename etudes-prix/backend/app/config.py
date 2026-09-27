"""Configuration par variables d'environnement (valeurs par défaut adaptées à un poste unique)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Settings:
    # SQLite pour la V1 ; PostgreSQL : postgresql+psycopg://user:mdp@hote/base
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'data' / 'etudes-prix.db'}"))
    # Contenu des fichiers importés (DCE, devis) : sur disque, hors de la base.
    files_dir: Path = field(default_factory=lambda: Path(os.getenv("FILES_DIR", str(BACKEND_DIR / "data" / "files"))))
    # Application web compilée (npm run build), servie par le même serveur si présente.
    frontend_dist: Path = field(default_factory=lambda: Path(os.getenv("FRONTEND_DIST", str(BACKEND_DIR.parent / "dist"))))
    max_upload_bytes: int = field(default_factory=lambda: int(os.getenv("MAX_UPLOAD_MB", "50")) * 1024 * 1024)
    cors_origins: list[str] = field(default_factory=lambda: [o for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o])
