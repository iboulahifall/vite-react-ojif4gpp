import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture()
def client(tmp_path):
    cfg = Settings(database_url=f"sqlite:///{tmp_path / 'test.db'}", files_dir=tmp_path / "files", frontend_dist=tmp_path / "no-dist", max_upload_bytes=1024 * 1024)
    with TestClient(create_app(cfg)) as c:
        yield c
