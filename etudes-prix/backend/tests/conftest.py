import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

HEADERS = {"X-EP-Client": "1"}
ADMIN = {"username": "admin", "displayName": "Ibrahima", "password": "motdepasse1"}


@pytest.fixture()
def app(tmp_path):
    cfg = Settings(database_url=f"sqlite:///{tmp_path / 'test.db'}", files_dir=tmp_path / "files", frontend_dist=tmp_path / "no-dist", max_upload_bytes=1024 * 1024)
    return create_app(cfg)


@pytest.fixture()
def anon(app):
    """Client sans session (mais avec l'en-tête applicatif)."""
    with TestClient(app, headers=HEADERS) as c:
        yield c


@pytest.fixture()
def client(app):
    """Administrateur connecté (premier compte créé à la configuration)."""
    with TestClient(app, headers=HEADERS) as c:
        assert c.post("/api/auth/setup", json=ADMIN).status_code == 200
        yield c


@pytest.fixture()
def login(app):
    """Ouvre une session pour un autre compte : login("chiffreur1", "motdepasse1")."""
    clients = []

    def _login(username: str, password: str) -> TestClient:
        c = TestClient(app, headers=HEADERS)
        clients.append(c)
        assert c.post("/api/auth/login", json={"username": username, "password": password}).status_code == 200
        return c

    yield _login
    for c in clients:
        c.close()
