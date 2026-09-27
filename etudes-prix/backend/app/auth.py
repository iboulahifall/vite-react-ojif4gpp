"""Comptes, mots de passe et sessions.

- Mots de passe : PBKDF2-SHA256 (bibliothèque standard), sel aléatoire par compte.
- Session : jeton aléatoire dans un cookie HttpOnly ; seule son empreinte SHA-256 est en base.
- Rôles : chiffreur (études de prix), direction (valide les études), admin (tout + comptes).
"""

import base64
import hashlib
import hmac
import secrets
import time
from datetime import datetime, timedelta, timezone

ROLES = ("chiffreur", "direction", "admin")
ROLE_LABELS = {"chiffreur": "Chiffreur", "direction": "Direction", "admin": "Administrateur"}
# Rôles autorisés à valider / déverrouiller une étude.
VALIDATOR_ROLES = ("direction", "admin")

PBKDF2_ITERATIONS = 390_000
SESSION_COOKIE = "ep_session"
SESSION_IDLE = timedelta(hours=12)
MIN_PASSWORD = 8


def hash_password(password: str, iterations: int = PBKDF2_ITERATIONS) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt, digest = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        test = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt), int(iterations))
        return hmac.compare_digest(test, base64.b64decode(digest))
    except (ValueError, TypeError):
        return False


def password_problem(password: str) -> str | None:
    if len(password) < MIN_PASSWORD:
        return f"Le mot de passe doit contenir au moins {MIN_PASSWORD} caractères."
    if password.isdigit() or password.isalpha():
        return "Le mot de passe doit mélanger lettres et chiffres (ou symboles)."
    return None


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(d: datetime) -> datetime:
    # SQLite restitue des dates sans fuseau.
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


class LoginThrottle:
    """Limite les essais de mot de passe : 5 échecs en 15 min bloquent l'identifiant 5 min."""

    def __init__(self, max_failures: int = 5, window: float = 900, lockout: float = 300) -> None:
        self.max_failures, self.window, self.lockout = max_failures, window, lockout
        self.failures: dict[str, list[float]] = {}
        self.locked_until: dict[str, float] = {}

    def locked(self, key: str) -> float:
        """Secondes de blocage restantes (0 si libre)."""
        return max(0.0, self.locked_until.get(key, 0) - time.monotonic())

    def failed(self, key: str) -> None:
        now = time.monotonic()
        recent = [t for t in self.failures.get(key, []) if now - t < self.window] + [now]
        self.failures[key] = recent
        if len(recent) >= self.max_failures:
            self.locked_until[key] = now + self.lockout
            self.failures[key] = []

    def succeeded(self, key: str) -> None:
        self.failures.pop(key, None)
        self.locked_until.pop(key, None)
