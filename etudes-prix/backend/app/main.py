"""API REST de l'application Études de Prix.

- /api/studies, /api/suppliers : documents JSON versionnés. Chaque écriture indique la version
  sur laquelle elle s'appuie (`baseVersion`) ; si la base a changé entre-temps (autre poste),
  la réponse est 409 et rien n'est écrasé.
- /api/settings : paramètres de l'application.
- /api/files/{id} : contenu des fichiers importés (DCE, devis), stocké sur disque.
- Si l'application web est compilée (dist/), elle est servie à la racine par le même serveur.

Lancement : uvicorn app.main:create_app --factory
"""


import hashlib
import re
from pathlib import Path
from typing import Annotated, Any
from urllib.parse import quote, unquote

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import __version__
from .config import Settings
from .db import Database
from .models import FileRow, SettingRow, StudyRow, SupplierRow

ID_RE = re.compile(r"^[A-Za-z0-9_.-]{1,100}$")
INITIALIZED = "__initialized"
APP_SETTINGS = "app"


class VersionedIn(BaseModel):
    data: dict[str, Any]
    # Version lue par le client ; None = création (l'élément ne doit pas exister).
    baseVersion: int | None = None


class VersionedOut(BaseModel):
    version: int
    data: dict[str, Any]


class ListOut(BaseModel):
    initialized: bool
    items: list[VersionedOut]


class SettingsIn(BaseModel):
    data: dict[str, Any]


class Saved(BaseModel):
    version: int


def check_id(value: str) -> str:
    if not ID_RE.match(value):
        raise HTTPException(422, "Identifiant invalide.")
    return value


def conflict(kind: str, current: int | None) -> HTTPException:
    return HTTPException(409, {"message": f"{kind} modifié(e) sur un autre poste depuis votre dernière lecture.", "currentVersion": current})


def create_app(settings: Settings | None = None) -> FastAPI:
    cfg = settings or Settings()
    db = Database(cfg.database_url)
    db.create_all()
    cfg.files_dir.mkdir(parents=True, exist_ok=True)

    app = FastAPI(title="Études de Prix CFO/CFA — API", version=__version__)
    app.state.db = db
    app.add_middleware(CORSMiddleware, allow_origins=cfg.cors_origins, allow_methods=["*"], allow_headers=["*"])

    @app.middleware("http")
    async def mark_server(request: Request, call_next):
        # Signale à l'application web qu'elle est servie par ce serveur (pas de détection à l'aveugle).
        response = await call_next(request)
        response.set_cookie("ep_server", "1", path="/", samesite="lax")
        return response

    SessionDep = Annotated[Session, Depends(db.session)]

    def mark_initialized(s: Session) -> None:
        if not s.get(SettingRow, INITIALIZED):
            s.add(SettingRow(key=INITIALIZED, data={"value": True}))

    def is_initialized(s: Session) -> bool:
        return s.get(SettingRow, INITIALIZED) is not None

    @app.get("/api/health")
    def health(s: SessionDep) -> dict[str, Any]:
        return {
            "status": "ok",
            "app": "etudes-prix",
            "version": __version__,
            "database": s.get_bind().dialect.name,
            "studies": s.scalar(select(func.count()).select_from(StudyRow)) or 0,
        }

    # ---- Études -------------------------------------------------------------------------------
    @app.get("/api/studies")
    def list_studies(s: SessionDep) -> ListOut:
        rows = s.scalars(select(StudyRow).order_by(StudyRow.due_date, StudyRow.id)).all()
        return ListOut(initialized=is_initialized(s), items=[VersionedOut(version=r.version, data=r.data) for r in rows])

    @app.get("/api/studies/{study_id}")
    def get_study(study_id: str, s: SessionDep) -> VersionedOut:
        row = s.get(StudyRow, check_id(study_id))
        if not row:
            raise HTTPException(404, "Étude introuvable.")
        return VersionedOut(version=row.version, data=row.data)

    @app.put("/api/studies/{study_id}")
    def put_study(study_id: str, body: VersionedIn, s: SessionDep) -> Saved:
        check_id(study_id)
        d = body.data
        if d.get("id") != study_id:
            raise HTTPException(422, "L’identifiant de l’étude ne correspond pas à l’adresse.")
        for key in ("reference", "name", "status", "dueDate"):
            if not isinstance(d.get(key), str):
                raise HTTPException(422, f"Champ « {key} » manquant ou invalide.")
        row = s.get(StudyRow, study_id)
        if row is None:
            if body.baseVersion not in (None, 0):
                raise conflict("L’étude a été supprimée ou", None)
            row = StudyRow(id=study_id, version=0)
            s.add(row)
        elif body.baseVersion != row.version:
            raise conflict("L’étude a été", row.version)
        row.reference, row.name, row.client = d["reference"], d["name"], str(d.get("client", ""))
        row.status, row.due_date, row.is_demo = d["status"], d["dueDate"], bool(d.get("isDemo"))
        row.data = d
        row.version += 1
        mark_initialized(s)
        s.commit()
        return Saved(version=row.version)

    @app.delete("/api/studies/{study_id}", status_code=204)
    def delete_study(study_id: str, s: SessionDep, baseVersion: int | None = None) -> Response:
        row = s.get(StudyRow, check_id(study_id))
        if row:
            if baseVersion is not None and baseVersion != row.version:
                raise conflict("L’étude a été", row.version)
            s.delete(row)
            s.commit()
        return Response(status_code=204)

    # ---- Fournisseurs (annuaire commun) -----------------------------------------------------------
    @app.get("/api/suppliers")
    def list_suppliers(s: SessionDep) -> ListOut:
        rows = s.scalars(select(SupplierRow).order_by(SupplierRow.name)).all()
        return ListOut(initialized=s.get(SettingRow, "__suppliers") is not None, items=[VersionedOut(version=r.version, data=r.data) for r in rows])

    @app.put("/api/suppliers/{supplier_id}")
    def put_supplier(supplier_id: str, body: VersionedIn, s: SessionDep) -> Saved:
        check_id(supplier_id)
        if body.data.get("id") != supplier_id or not isinstance(body.data.get("name"), str):
            raise HTTPException(422, "Fournisseur invalide.")
        row = s.get(SupplierRow, supplier_id)
        if row is None:
            row = SupplierRow(id=supplier_id, version=0)
            s.add(row)
        elif body.baseVersion is not None and body.baseVersion != row.version:
            raise conflict("Le fournisseur a été", row.version)
        row.name, row.data = body.data["name"], body.data
        row.version += 1
        if not s.get(SettingRow, "__suppliers"):
            s.add(SettingRow(key="__suppliers", data={"value": True}))
        s.commit()
        return Saved(version=row.version)

    @app.delete("/api/suppliers/{supplier_id}", status_code=204)
    def delete_supplier(supplier_id: str, s: SessionDep) -> Response:
        row = s.get(SupplierRow, check_id(supplier_id))
        if row:
            s.delete(row)
            s.commit()
        if not s.get(SettingRow, "__suppliers"):
            s.add(SettingRow(key="__suppliers", data={"value": True}))
            s.commit()
        return Response(status_code=204)

    # ---- Paramètres ---------------------------------------------------------------------------------
    @app.get("/api/settings")
    def get_settings(s: SessionDep) -> dict[str, Any]:
        row = s.get(SettingRow, APP_SETTINGS)
        return {"data": row.data if row else None}

    @app.put("/api/settings")
    def put_settings(body: SettingsIn, s: SessionDep) -> dict[str, bool]:
        row = s.get(SettingRow, APP_SETTINGS)
        if row:
            row.data = body.data
        else:
            s.add(SettingRow(key=APP_SETTINGS, data=body.data))
        s.commit()
        return {"ok": True}

    # ---- Fichiers ------------------------------------------------------------------------------------
    def file_path(file_id: str) -> Path:
        return cfg.files_dir / file_id[:2] / file_id

    @app.put("/api/files/{file_id}")
    async def put_file(file_id: str, request: Request, s: SessionDep, x_file_name: Annotated[str | None, Header()] = None) -> dict[str, Any]:
        check_id(file_id)
        declared = request.headers.get("content-length")
        if declared and int(declared) > cfg.max_upload_bytes:
            raise HTTPException(413, "Fichier trop volumineux.")
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > cfg.max_upload_bytes:
                raise HTTPException(413, "Fichier trop volumineux.")
        path = file_path(file_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".part")
        tmp.write_bytes(body)
        tmp.replace(path)
        row = s.get(FileRow, file_id) or FileRow(id=file_id)
        row.name = unquote(x_file_name or "")[:300]
        row.mime = (request.headers.get("content-type") or "application/octet-stream")[:200]
        row.size = len(body)
        row.sha256 = hashlib.sha256(body).hexdigest()
        s.merge(row)
        s.commit()
        return {"id": file_id, "size": row.size, "sha256": row.sha256}

    @app.get("/api/files/{file_id}")
    def get_file(file_id: str, s: SessionDep) -> FileResponse:
        row = s.get(FileRow, check_id(file_id))
        path = file_path(file_id)
        if not row or not path.exists():
            raise HTTPException(404, "Fichier introuvable.")
        headers = {"Content-Disposition": f"inline; filename*=UTF-8''{quote(row.name or file_id)}", "Cache-Control": "private, no-cache"}
        return FileResponse(path, media_type=row.mime, headers=headers)

    @app.delete("/api/files/{file_id}", status_code=204)
    def delete_file(file_id: str, s: SessionDep) -> Response:
        row = s.get(FileRow, check_id(file_id))
        if row:
            s.delete(row)
            s.commit()
        file_path(file_id).unlink(missing_ok=True)
        return Response(status_code=204)

    # ---- Application web -------------------------------------------------------------------------------
    if (cfg.frontend_dist / "index.html").exists():
        app.mount("/", StaticFiles(directory=cfg.frontend_dist, html=True), name="web")

    return app
