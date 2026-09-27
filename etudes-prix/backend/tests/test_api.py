"""Tests de l'API : persistance, versions (conflits entre postes), fichiers, validation."""


def study(id="s1", **over):
    d = {"id": id, "reference": "AO-1", "name": "Étude test", "client": "Client", "status": "chiffrage", "dueDate": "2026-10-02", "isDemo": False, "metre": []}
    d.update(over)
    return d


def test_health(client):
    r = client.get("/api/health").json()
    assert r["status"] == "ok" and r["app"] == "etudes-prix" and r["database"] == "sqlite" and r["studies"] == 0


def test_base_vide_puis_creation_et_relecture(client):
    assert client.get("/api/studies").json() == {"initialized": False, "items": []}
    r = client.put("/api/studies/s1", json={"data": study(), "baseVersion": None})
    assert r.status_code == 200 and r.json() == {"version": 1}
    lst = client.get("/api/studies").json()
    assert lst["initialized"] is True
    assert lst["items"] == [{"version": 1, "data": study()}]
    # Accents et structures imbriquées conservés
    assert client.get("/api/studies/s1").json()["data"]["name"] == "Étude test"


def test_versions_detectent_les_modifications_concurrentes(client):
    client.put("/api/studies/s1", json={"data": study(), "baseVersion": None})
    # Poste A enregistre sur la version 1 → version 2
    assert client.put("/api/studies/s1", json={"data": study(name="A"), "baseVersion": 1}).json() == {"version": 2}
    # Poste B, resté sur la version 1, est refusé : rien n'est écrasé
    r = client.put("/api/studies/s1", json={"data": study(name="B"), "baseVersion": 1})
    assert r.status_code == 409 and r.json()["detail"]["currentVersion"] == 2
    assert client.get("/api/studies/s1").json()["data"]["name"] == "A"
    # Création d'un élément qui existe déjà : conflit aussi
    assert client.put("/api/studies/s1", json={"data": study(), "baseVersion": None}).status_code == 409


def test_suppression_et_base_initialisee(client):
    client.put("/api/studies/s1", json={"data": study(), "baseVersion": None})
    assert client.delete("/api/studies/s1?baseVersion=5").status_code == 409
    assert client.delete("/api/studies/s1?baseVersion=1").status_code == 204
    # La base reste « initialisée » : l'application ne recrée pas la démonstration
    assert client.get("/api/studies").json() == {"initialized": True, "items": []}
    assert client.get("/api/studies/s1").status_code == 404


def test_validation_des_donnees(client):
    assert client.put("/api/studies/s1", json={"data": study(id="autre")}).status_code == 422
    assert client.put("/api/studies/s1", json={"data": {"id": "s1"}}).status_code == 422
    assert client.put("/api/studies/..%2Fetc", json={"data": study()}).status_code in (404, 422)
    assert client.get("/api/studies/a b").status_code == 422


def test_fournisseurs_et_parametres(client):
    assert client.get("/api/suppliers").json() == {"initialized": False, "items": []}
    assert client.put("/api/suppliers/f1", json={"data": {"id": "f1", "name": "Élec Démo"}}).json() == {"version": 1}
    assert client.get("/api/suppliers").json()["items"][0]["data"]["name"] == "Élec Démo"
    assert client.delete("/api/suppliers/f1").status_code == 204
    assert client.get("/api/suppliers").json() == {"initialized": True, "items": []}
    assert client.get("/api/settings").json() == {"data": None}
    client.put("/api/settings", json={"data": {"userName": "Ibrahima", "guidedMode": True}})
    assert client.get("/api/settings").json()["data"]["userName"] == "Ibrahima"


def test_fichiers(client):
    pdf = b"%PDF-1.4 contenu de test"
    r = client.put("/api/files/doc-1", content=pdf, headers={"Content-Type": "application/pdf", "X-File-Name": "CCTP%20lot%2013%20%C3%A9lec.pdf"})
    assert r.status_code == 200 and r.json()["size"] == len(pdf)
    g = client.get("/api/files/doc-1")
    assert g.status_code == 200 and g.content == pdf and g.headers["content-type"] == "application/pdf"
    assert "CCTP%20lot%2013%20%C3%A9lec.pdf" in g.headers["content-disposition"]
    # Remplacement du contenu
    client.put("/api/files/doc-1", content=b"v2", headers={"Content-Type": "text/plain"})
    assert client.get("/api/files/doc-1").content == b"v2"
    assert client.delete("/api/files/doc-1").status_code == 204
    assert client.get("/api/files/doc-1").status_code == 404


def test_fichier_trop_volumineux(client):
    r = client.put("/api/files/gros", content=b"x" * (1024 * 1024 + 1), headers={"Content-Type": "application/octet-stream"})
    assert r.status_code == 413
    assert client.get("/api/files/gros").status_code == 404


def test_cookie_serveur(client):
    assert "ep_server=1" in client.get("/api/health").headers.get("set-cookie", "")
