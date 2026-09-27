"""Commandes d'administration du serveur (à lancer sur la machine du serveur).

  python -m app.cli users                         liste des comptes
  python -m app.cli reset-password <identifiant>  nouveau mot de passe provisoire (à changer à la connexion)
"""

import secrets
import sys

from sqlalchemy import select

from .auth import ROLE_LABELS, hash_password
from .config import Settings
from .db import Database
from .models import SessionRow, UserRow


def main(argv: list[str]) -> int:
    db = Database(Settings().database_url)
    db.create_all()
    with db.sessions() as s:
        if argv[:1] == ["users"]:
            for u in s.scalars(select(UserRow).order_by(UserRow.username)):
                print(f"{u.username:20} {u.display_name:30} {ROLE_LABELS[u.role]:15} {'actif' if u.active else 'désactivé'}")
            return 0
        if len(argv) == 2 and argv[0] == "reset-password":
            user = s.scalar(select(UserRow).where(UserRow.username == argv[1].lower()))
            if not user:
                print(f"Compte « {argv[1]} » introuvable.", file=sys.stderr)
                return 1
            password = f"provisoire-{secrets.randbelow(10**6):06d}"
            user.password_hash, user.must_change_password, user.active = hash_password(password), True, True
            for sess in s.scalars(select(SessionRow).where(SessionRow.user_id == user.id)):
                s.delete(sess)
            s.commit()
            print(f"Mot de passe provisoire de {user.username} : {password}")
            return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
