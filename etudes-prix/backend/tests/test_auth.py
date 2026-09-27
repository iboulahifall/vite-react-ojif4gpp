"""Comptes, connexion, rôles."""

from app.auth import hash_password, password_problem, verify_password
from tests.conftest import ADMIN


def study(**over):
    d = {"id": "s1", "reference": "AO-1", "name": "Étude", "status": "validation", "dueDate": "2026-10-02"}
    d.update(over)
    return d


def test_mots_de_passe():
    h = hash_password("motdepasse1", iterations=1000)
    assert h.startswith("pbkdf2_sha256$1000$") and "motdepasse1" not in h
    assert verify_password("motdepasse1", h) and not verify_password("autre", h) and not verify_password("x", "n'importe quoi")
    assert password_problem("court1") and password_problem("seulementdeslettres") and password_problem("12345678")
    assert password_problem("motdepasse1") is None


def test_premiere_configuration(anon):
    assert anon.get("/api/auth/status").json() == {"setupRequired": True, "user": None}
    assert anon.get("/api/studies").status_code == 401
    assert anon.post("/api/auth/setup", json={**ADMIN, "password": "court"}).status_code == 422
    r = anon.post("/api/auth/setup", json=ADMIN)
    assert r.status_code == 200 and r.json()["role"] == "admin" and r.json()["isAdmin"]
    assert "httponly" in r.headers["set-cookie"].lower()
    st = anon.get("/api/auth/status").json()
    assert st["setupRequired"] is False and st["user"]["displayName"] == "Ibrahima"
    # Impossible de recréer un premier compte
    assert anon.post("/api/auth/setup", json={**ADMIN, "username": "pirate"}).status_code == 409


def test_routes_protegees_et_entete(app, client, anon):
    from fastapi.testclient import TestClient
    assert anon.get("/api/studies").status_code == 401
    assert anon.get("/api/files/x").status_code == 401
    assert client.get("/api/studies").status_code == 200
    # Écriture sans l'en-tête applicatif (requête forgée depuis un autre site) : refusée
    with TestClient(app) as raw:
        raw.cookies = client.cookies
        assert raw.put("/api/settings", json={"data": {}}).status_code == 403


def test_connexion_deconnexion_et_limitation(client, anon):
    assert anon.post("/api/auth/login", json={"username": "admin", "password": "faux"}).status_code == 401
    ok = anon.post("/api/auth/login", json={"username": "ADMIN ", "password": ADMIN["password"]})
    assert ok.status_code == 200
    assert anon.get("/api/auth/me").json()["username"] == "admin"
    assert anon.post("/api/auth/logout").status_code == 204
    assert anon.get("/api/auth/me").status_code == 401
    for _ in range(5):
        anon.post("/api/auth/login", json={"username": "admin", "password": "faux"})
    r = anon.post("/api/auth/login", json={"username": "admin", "password": ADMIN["password"]})
    assert r.status_code == 429 and "Trop d’essais" in r.json()["detail"]


def test_gestion_des_comptes(client, login):
    r = client.post("/api/users", json={"username": "jdupont", "displayName": "J. Dupont", "role": "chiffreur", "password": "provisoire1"})
    assert r.status_code == 201 and r.json()["mustChangePassword"] is True and r.json()["canValidate"] is False
    assert client.post("/api/users", json={"username": "jdupont", "displayName": "x", "role": "chiffreur", "password": "provisoire1"}).status_code == 409
    assert client.post("/api/users", json={"username": "x", "displayName": "x", "role": "chef", "password": "provisoire1"}).status_code == 422
    c = login("jdupont", "provisoire1")
    assert c.get("/api/users").status_code == 403
    assert c.put("/api/auth/password", json={"currentPassword": "faux", "newPassword": "nouveau123"}).status_code == 422
    assert c.put("/api/auth/password", json={"currentPassword": "provisoire1", "newPassword": "nouveau123"}).status_code == 200
    assert c.get("/api/auth/me").json()["mustChangePassword"] is False
    # Désactivation : la session est coupée
    uid = r.json()["id"]
    assert client.patch(f"/api/users/{uid}", json={"active": False}).status_code == 200
    assert c.get("/api/studies").status_code == 401
    # Il doit rester un administrateur
    me = client.get("/api/auth/me").json()
    assert client.patch(f"/api/users/{me['id']}", json={"role": "chiffreur"}).status_code == 422


def test_validation_reservee_a_la_direction(client, login):
    client.post("/api/users", json={"username": "chiffreur", "displayName": "Chiffreur", "role": "chiffreur", "password": "provisoire1"})
    client.post("/api/users", json={"username": "directeur", "displayName": "M. Durand", "role": "direction", "password": "provisoire1"})
    ch, dir_ = login("chiffreur", "provisoire1"), login("directeur", "provisoire1")
    assert ch.put("/api/studies/s1", json={"data": study(), "baseVersion": None}).json() == {"version": 1}
    validation = {"version": 1, "validatedBy": "usurpé", "approver": "Direction", "withReserves": False}
    # Le chiffreur ne peut ni valider…
    r = ch.put("/api/studies/s1", json={"data": study(validation=validation), "baseVersion": 1})
    assert r.status_code == 403
    # …mais peut modifier le reste
    assert ch.put("/api/studies/s1", json={"data": study(name="Modifiée"), "baseVersion": 1}).json() == {"version": 2}
    # La direction valide ; le nom du valideur est celui du compte connecté
    assert dir_.put("/api/studies/s1", json={"data": study(name="Modifiée", validation=validation), "baseVersion": 2}).status_code == 200
    assert dir_.get("/api/studies/s1").json()["data"]["validation"]["validatedBy"] == "M. Durand"
    # Le chiffreur ne peut pas déverrouiller
    assert ch.put("/api/studies/s1", json={"data": study(name="Modifiée"), "baseVersion": 3}).status_code == 403
    # Paramètres de l'entreprise : administrateurs seulement
    assert ch.put("/api/settings", json={"data": {"companyName": "X"}}).status_code == 403


def test_commande_de_secours(tmp_path, monkeypatch, capsys):
    from app import cli
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'cli.db'}")
    from app.db import Database
    from app.models import UserRow
    db = Database(f"sqlite:///{tmp_path / 'cli.db'}")
    db.create_all()
    with db.sessions() as s:
        s.add(UserRow(username="admin", display_name="Admin", role="admin", password_hash=hash_password("ancien123")))
        s.commit()
    assert cli.main(["reset-password", "admin"]) == 0
    pwd = capsys.readouterr().out.strip().split(" : ")[-1]
    with db.sessions() as s:
        u = s.query(UserRow).one()
        assert verify_password(pwd, u.password_hash) and u.must_change_password
    assert cli.main(["reset-password", "inconnu"]) == 1
