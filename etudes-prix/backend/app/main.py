"""API REST de l'application Études de Prix.

- /api/studies, /api/suppliers : documents JSON versionnés. Chaque écriture indique la version
  sur laquelle elle s'appuie (`baseVersion`) ; si la base a changé entre-temps (autre poste),
  la réponse est 409 et rien n'est écrasé.
- /api/settings : paramètres de l'application (logo, entreprise : réservés aux administrateurs).
- /api/auth/* : première configuration, connexion, session, mot de passe ; /api/users : comptes (admin).
  Toutes les autres routes /api exigent une session. Les écritures exigent l'en-tête X-EP-Client
  (une page d'un autre site ne peut pas l'ajouter sans autorisation CORS).
- Seuls les rôles direction et admin peuvent valider ou déverrouiller une étude : contrôlé ici,
  en comparant la validation enregistrée et celle reçue.
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
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import __version__
from .config import Settings
from .db import Database
from .auth import (
    ROLE_LABELS, ROLES, SESSION_COOKIE, SESSION_IDLE, VALIDATOR_ROLES, LoginThrottle, as_utc, hash_password, new_token,
    password_problem, token_hash, utcnow, verify_password,
)
from .models import FileRow, SessionRow, SettingRow, StudyRow, SupplierRow, UserRow

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


class SetupIn(BaseModel):
    username: str
    displayName: str
    password: str


class LoginIn(BaseModel):
    username: str
    password: str


class PasswordIn(BaseModel):
    currentPassword: str
    newPassword: str


class UserIn(BaseModel):
    username: str
    displayName: str
    role: str
    password: str


class UserPatch(BaseModel):
    displayName: str | None = None
    role: str | None = None
    active: bool | None = None
    password: str | None = None


USERNAME_RE = re.compile(r"^[a-z0-9._-]{2,60}$")


def user_out(u: UserRow) -> dict[str, Any]:
    return {
        "id": u.id, "username": u.username, "displayName": u.display_name, "role": u.role, "roleLabel": ROLE_LABELS[u.role],
        "active": u.active, "mustChangePassword": u.must_change_password,
        "canValidate": u.role in VALIDATOR_ROLES, "isAdmin": u.role == "admin",
        "lastLoginAt": u.last_login_at.isoformat() if u.last_login_at else None,
    }


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
    app.add_middleware(CORSMiddleware, allow_origins=cfg.cors_origins, allow_methods=["*"], allow_headers=["*"], allow_credentials=True)
    throttle = LoginThrottle()
    app.state.throttle = throttle

    @app.middleware("http")
    async def require_client_header(request: Request, call_next):
        # Protection contre les requêtes forgées depuis un autre site (CSRF).
        if request.url.path.startswith("/api/") and request.method not in ("GET", "HEAD", "OPTIONS") and request.headers.get("x-ep-client") != "1":
            return JSONResponse({"detail": "En-tête X-EP-Client manquant."}, status_code=403)
        return await call_next(request)

    @app.middleware("http")
    async def mark_server(request: Request, call_next):
        # Signale à l'application web qu'elle est servie par ce serveur (pas de détection à l'aveugle).
        response = await call_next(request)
        response.set_cookie("ep_server", "1", path="/", samesite="lax")
        return response

    SessionDep = Annotated[Session, Depends(db.session)]

    def current_user(request: Request, s: SessionDep) -> UserRow:
        token = request.cookies.get(SESSION_COOKIE)
        row = s.get(SessionRow, token_hash(token)) if token else None
        if not row or as_utc(row.expires_at) < utcnow():
            raise HTTPException(401, "Session expirée : reconnectez-vous.")
        user = s.get(UserRow, row.user_id)
        if not user or not user.active:
            raise HTTPException(401, "Compte désactivé.")
        # Session glissante : prolongée à l'usage.
        if as_utc(row.expires_at) - utcnow() < SESSION_IDLE / 2:
            row.expires_at = utcnow() + SESSION_IDLE
            s.commit()
        return user

    UserDep = Annotated[UserRow, Depends(current_user)]

    def admin_user(user: UserDep) -> UserRow:
        if user.role != "admin":
            raise HTTPException(403, "Réservé aux administrateurs.")
        return user

    AdminDep = Annotated[UserRow, Depends(admin_user)]

    def open_session(s: Session, user: UserRow, response: Response) -> None:
        token = new_token()
        s.add(SessionRow(token_hash=token_hash(token), user_id=user.id, expires_at=utcnow() + SESSION_IDLE))
        user.last_login_at = utcnow()
        s.commit()
        response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax", secure=cfg.cookie_secure, path="/", max_age=int(SESSION_IDLE.total_seconds()) * 14)

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
        }

    # ---- Comptes et sessions ------------------------------------------------------------------------
    @app.get("/api/auth/status")
    def auth_status(request: Request, s: SessionDep) -> dict[str, Any]:
        setup = (s.scalar(select(func.count()).select_from(UserRow)) or 0) == 0
        try:
            me = current_user(request, s)
        except HTTPException:
            me = None
        return {"setupRequired": setup, "user": user_out(me) if me else None}

    @app.post("/api/auth/setup")
    def setup(body: SetupIn, response: Response, s: SessionDep) -> dict[str, Any]:
        if (s.scalar(select(func.count()).select_from(UserRow)) or 0) > 0:
            raise HTTPException(409, "Le premier compte existe déjà.")
        username = body.username.strip().lower()
        if not USERNAME_RE.match(username):
            raise HTTPException(422, "Identifiant : 2 à 60 caractères, lettres minuscules, chiffres, point, tiret.")
        if (problem := password_problem(body.password)):
            raise HTTPException(422, problem)
        user = UserRow(username=username, display_name=body.displayName.strip() or username, role="admin", password_hash=hash_password(body.password))
        s.add(user)
        s.flush()
        open_session(s, user, response)
        return user_out(user)

    @app.post("/api/auth/login")
    def login(body: LoginIn, request: Request, response: Response, s: SessionDep) -> dict[str, Any]:
        username = body.username.strip().lower()
        key = f"{username}|{request.client.host if request.client else ''}"
        wait = throttle.locked(key)
        if wait:
            raise HTTPException(429, f"Trop d’essais : réessayez dans {int(wait // 60) + 1} min.")
        user = s.scalar(select(UserRow).where(UserRow.username == username))
        if not user or not user.active or not verify_password(body.password, user.password_hash):
            throttle.failed(key)
            raise HTTPException(401, "Identifiant ou mot de passe incorrect.")
        throttle.succeeded(key)
        open_session(s, user, response)
        return user_out(user)

    @app.post("/api/auth/logout", status_code=204)
    def logout(request: Request, s: SessionDep) -> Response:
        token = request.cookies.get(SESSION_COOKIE)
        if token and (row := s.get(SessionRow, token_hash(token))):
            s.delete(row)
            s.commit()
        r = Response(status_code=204)
        r.delete_cookie(SESSION_COOKIE, path="/")
        return r

    @app.get("/api/auth/me")
    def me(user: UserDep) -> dict[str, Any]:
        return user_out(user)

    @app.put("/api/auth/password")
    def change_password(body: PasswordIn, s: SessionDep, user: UserDep) -> dict[str, bool]:
        if not verify_password(body.currentPassword, user.password_hash):
            raise HTTPException(422, "Mot de passe actuel incorrect.")
        if (problem := password_problem(body.newPassword)):
            raise HTTPException(422, problem)
        user.password_hash = hash_password(body.newPassword)
        user.must_change_password = False
        s.commit()
        return {"ok": True}

    @app.get("/api/users")
    def list_users(s: SessionDep, _: AdminDep) -> list[dict[str, Any]]:
        return [user_out(u) for u in s.scalars(select(UserRow).order_by(UserRow.display_name))]

    @app.post("/api/users", status_code=201)
    def create_user(body: UserIn, s: SessionDep, _: AdminDep) -> dict[str, Any]:
        username = body.username.strip().lower()
        if not USERNAME_RE.match(username):
            raise HTTPException(422, "Identifiant : 2 à 60 caractères, lettres minuscules, chiffres, point, tiret.")
        if body.role not in ROLES:
            raise HTTPException(422, "Rôle inconnu.")
        if (problem := password_problem(body.password)):
            raise HTTPException(422, problem)
        if s.scalar(select(UserRow).where(UserRow.username == username)):
            raise HTTPException(409, "Cet identifiant existe déjà.")
        user = UserRow(username=username, display_name=body.displayName.strip() or username, role=body.role,
                       password_hash=hash_password(body.password), must_change_password=True)
        s.add(user)
        s.commit()
        return user_out(user)

    @app.patch("/api/users/{user_id}")
    def update_user(user_id: int, body: UserPatch, s: SessionDep, admin: AdminDep) -> dict[str, Any]:
        user = s.get(UserRow, user_id)
        if not user:
            raise HTTPException(404, "Compte introuvable.")
        if body.role is not None and body.role not in ROLES:
            raise HTTPException(422, "Rôle inconnu.")
        losing_admin = user.role == "admin" and ((body.role is not None and body.role != "admin") or body.active is False)
        if losing_admin:
            admins = s.scalar(select(func.count()).select_from(UserRow).where(UserRow.role == "admin", UserRow.active.is_(True))) or 0
            if admins <= 1:
                raise HTTPException(422, "Il doit rester au moins un administrateur actif.")
        if body.displayName is not None:
            user.display_name = body.displayName.strip() or user.display_name
        if body.role is not None:
            user.role = body.role
        if body.active is not None:
            user.active = body.active
            if not body.active:
                for sess in s.scalars(select(SessionRow).where(SessionRow.user_id == user.id)):
                    s.delete(sess)
        if body.password is not None:
            if (problem := password_problem(body.password)):
                raise HTTPException(422, problem)
            user.password_hash = hash_password(body.password)
            user.must_change_password = user.id != admin.id
        s.commit()
        return user_out(user)

    # ---- Études -------------------------------------------------------------------------------
    @app.get("/api/studies")
    def list_studies(s: SessionDep, _: UserDep) -> ListOut:
        rows = s.scalars(select(StudyRow).order_by(StudyRow.due_date, StudyRow.id)).all()
        return ListOut(initialized=is_initialized(s), items=[VersionedOut(version=r.version, data=r.data) for r in rows])

    @app.get("/api/studies/{study_id}")
    def get_study(study_id: str, s: SessionDep, _: UserDep) -> VersionedOut:
        row = s.get(StudyRow, check_id(study_id))
        if not row:
            raise HTTPException(404, "Étude introuvable.")
        return VersionedOut(version=row.version, data=row.data)

    @app.put("/api/studies/{study_id}")
    def put_study(study_id: str, body: VersionedIn, s: SessionDep, user: UserDep) -> Saved:
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
        # Validation / déverrouillage : réservés à la direction (et aux administrateurs).
        before = (row.data or {}).get("validation") if row.data else None
        after = d.get("validation")
        if (before or None) != (after or None) and user.role not in VALIDATOR_ROLES:
            raise HTTPException(403, "La validation et le déverrouillage d’une étude sont réservés à la direction.")
        if after and not before:
            after["validatedBy"] = user.display_name
        row.reference, row.name, row.client = d["reference"], d["name"], str(d.get("client", ""))
        row.status, row.due_date, row.is_demo = d["status"], d["dueDate"], bool(d.get("isDemo"))
        row.data = d
        row.version += 1
        mark_initialized(s)
        s.commit()
        return Saved(version=row.version)

    @app.delete("/api/studies/{study_id}", status_code=204)
    def delete_study(study_id: str, s: SessionDep, _: UserDep, baseVersion: int | None = None) -> Response:
        row = s.get(StudyRow, check_id(study_id))
        if row:
            if baseVersion is not None and baseVersion != row.version:
                raise conflict("L’étude a été", row.version)
            s.delete(row)
            s.commit()
        return Response(status_code=204)

    # ---- Fournisseurs (annuaire commun) -----------------------------------------------------------
    @app.get("/api/suppliers")
    def list_suppliers(s: SessionDep, _: UserDep) -> ListOut:
        rows = s.scalars(select(SupplierRow).order_by(SupplierRow.name)).all()
        return ListOut(initialized=s.get(SettingRow, "__suppliers") is not None, items=[VersionedOut(version=r.version, data=r.data) for r in rows])

    @app.put("/api/suppliers/{supplier_id}")
    def put_supplier(supplier_id: str, body: VersionedIn, s: SessionDep, _: UserDep) -> Saved:
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
    def delete_supplier(supplier_id: str, s: SessionDep, _: UserDep) -> Response:
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
    def get_settings(s: SessionDep, _: UserDep) -> dict[str, Any]:
        row = s.get(SettingRow, APP_SETTINGS)
        return {"data": row.data if row else None}

    @app.put("/api/settings")
    def put_settings(body: SettingsIn, s: SessionDep, _: AdminDep) -> dict[str, bool]:
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
    async def put_file(file_id: str, request: Request, s: SessionDep, _: UserDep, x_file_name: Annotated[str | None, Header()] = None) -> dict[str, Any]:
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
    def get_file(file_id: str, s: SessionDep, _: UserDep) -> FileResponse:
        row = s.get(FileRow, check_id(file_id))
        path = file_path(file_id)
        if not row or not path.exists():
            raise HTTPException(404, "Fichier introuvable.")
        headers = {"Content-Disposition": f"inline; filename*=UTF-8''{quote(row.name or file_id)}", "Cache-Control": "private, no-cache"}
        return FileResponse(path, media_type=row.mime, headers=headers)

    @app.delete("/api/files/{file_id}", status_code=204)
    def delete_file(file_id: str, s: SessionDep, _: UserDep) -> Response:
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
