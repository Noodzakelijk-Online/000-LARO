"""Persistent authentication for the local Flask case workspace."""

from __future__ import annotations

import datetime as dt
import hashlib
import logging
import os
import secrets
import smtplib
import sqlite3
from contextlib import contextmanager
from email.message import EmailMessage
from functools import wraps
from typing import Callable, Iterator, Optional
from urllib.parse import quote

from flask import jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash


logger = logging.getLogger(__name__)


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _iso(value: dt.datetime) -> str:
    return value.astimezone(dt.timezone.utc).isoformat()


def _parse_time(value: str) -> dt.datetime:
    parsed = dt.datetime.fromisoformat(value)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)


def _token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class EmailAuthenticationSystem:
    """Durable bearer-session authentication with owner-aware route guards."""

    SESSION_TTL = dt.timedelta(days=1)
    RESET_TTL = dt.timedelta(minutes=15)

    def __init__(self, app):
        self.app = app
        configured_path = app.config.get("LARO_AUTH_DATABASE_PATH") or os.environ.get("LARO_AUTH_DATABASE_PATH")
        self.database_path = os.path.abspath(configured_path or os.path.join(app.instance_path, "laro_auth.sqlite3"))
        os.makedirs(os.path.dirname(self.database_path), exist_ok=True)
        self._initialize_database()
        self._register_routes()

    @contextmanager
    def _connection(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.database_path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 5000")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def _initialize_database(self) -> None:
        with self._connection() as connection:
            connection.executescript(
                """
                PRAGMA journal_mode = WAL;
                CREATE TABLE IF NOT EXISTS auth_users (
                    email TEXT PRIMARY KEY,
                    password_hash TEXT NOT NULL,
                    first_name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    user_type TEXT NOT NULL DEFAULT 'user',
                    access_level INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    last_login TEXT
                );
                CREATE TABLE IF NOT EXISTS auth_sessions (
                    token_hash TEXT PRIMARY KEY,
                    email TEXT NOT NULL,
                    user_type TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS auth_sessions_email_idx ON auth_sessions(email);
                CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);
                CREATE TABLE IF NOT EXISTS auth_reset_tokens (
                    token_hash TEXT PRIMARY KEY,
                    email TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS auth_reset_email_idx ON auth_reset_tokens(email);
                """
            )

    @staticmethod
    def _normalize_email(value: object) -> str:
        return str(value or "").strip().lower()

    def _get_user(self, email: str) -> Optional[sqlite3.Row]:
        with self._connection() as connection:
            return connection.execute("SELECT * FROM auth_users WHERE email = ?", (email,)).fetchone()

    def _register_routes(self) -> None:
        @self.app.route("/api/auth/register", methods=["POST"])
        def register():
            data = request.get_json(silent=True) or {}
            email = self._normalize_email(data.get("email"))
            password = str(data.get("password") or "")
            first_name = str(data.get("first_name") or "").strip()
            last_name = str(data.get("last_name") or "").strip()
            if not email or "@" not in email:
                return jsonify({"error": "A valid email is required"}), 400
            if len(password) < 8:
                return jsonify({"error": "Password must contain at least 8 characters"}), 400
            if not first_name or not last_name:
                return jsonify({"error": "First name and last name are required"}), 400

            try:
                with self._connection() as connection:
                    connection.execute(
                        """INSERT INTO auth_users
                           (email, password_hash, first_name, last_name, user_type, access_level, created_at)
                           VALUES (?, ?, ?, ?, 'user', 0, ?)""",
                        (email, generate_password_hash(password), first_name, last_name, _iso(_utcnow())),
                    )
            except sqlite3.IntegrityError:
                return jsonify({"error": "Email already registered"}), 409

            token = self._create_session(email, "user")
            return jsonify({
                "message": "Registration successful",
                "user": {"email": email, "first_name": first_name, "last_name": last_name},
                "token": token,
            }), 201

        @self.app.route("/api/auth/login", methods=["POST"])
        def login():
            data = request.get_json(silent=True) or {}
            email = self._normalize_email(data.get("email"))
            password = str(data.get("password") or "")
            user = self._get_user(email)
            if not user or not check_password_hash(user["password_hash"], password):
                return jsonify({"error": "Invalid email or password"}), 401

            now = _utcnow()
            with self._connection() as connection:
                connection.execute("UPDATE auth_users SET last_login = ? WHERE email = ?", (_iso(now), email))
            token = self._create_session(email, user["user_type"])
            return jsonify({
                "message": "Login successful",
                "user": {
                    "email": email,
                    "first_name": user["first_name"],
                    "last_name": user["last_name"],
                    "type": user["user_type"],
                },
                "token": token,
            }), 200

        @self.app.route("/api/auth/logout", methods=["POST"])
        @self._require_auth
        def logout():
            token = self._bearer_token()
            if token:
                with self._connection() as connection:
                    connection.execute("DELETE FROM auth_sessions WHERE token_hash = ?", (_token_digest(token),))
            session.clear()
            return jsonify({"message": "Logout successful"}), 200

        @self.app.route("/api/auth/reset-password", methods=["POST"])
        def request_reset():
            data = request.get_json(silent=True) or {}
            email = self._normalize_email(data.get("email"))
            generic = {"message": "If the account exists, password reset instructions will be sent"}
            user = self._get_user(email) if email else None
            if not user:
                return jsonify(generic), 200

            raw_token = secrets.token_urlsafe(32)
            token_hash = _token_digest(raw_token)
            now = _utcnow()
            with self._connection() as connection:
                connection.execute("DELETE FROM auth_reset_tokens WHERE email = ?", (email,))
                connection.execute(
                    "INSERT INTO auth_reset_tokens (token_hash, email, expires_at, created_at) VALUES (?, ?, ?, ?)",
                    (token_hash, email, _iso(now + self.RESET_TTL), _iso(now)),
                )

            try:
                delivered = self._deliver_password_reset(email, raw_token)
            except Exception:
                delivered = False
                logger.exception("Password reset delivery failed")
            if not delivered:
                logger.warning("Password reset requested, but no working reset delivery is configured")
                with self._connection() as connection:
                    connection.execute("DELETE FROM auth_reset_tokens WHERE token_hash = ?", (token_hash,))
            return jsonify(generic), 200

        @self.app.route("/api/auth/reset-password/<token>", methods=["POST"])
        def reset_password(token):
            data = request.get_json(silent=True) or {}
            password = str(data.get("password") or "")
            if len(password) < 8:
                return jsonify({"error": "Password must contain at least 8 characters"}), 400

            token_hash = _token_digest(token)
            with self._connection() as connection:
                reset = connection.execute(
                    "SELECT email, expires_at FROM auth_reset_tokens WHERE token_hash = ?", (token_hash,)
                ).fetchone()
                if not reset or _utcnow() > _parse_time(reset["expires_at"]):
                    if reset:
                        connection.execute("DELETE FROM auth_reset_tokens WHERE token_hash = ?", (token_hash,))
                    return jsonify({"error": "Invalid or expired token"}), 400
                connection.execute(
                    "UPDATE auth_users SET password_hash = ? WHERE email = ?",
                    (generate_password_hash(password), reset["email"]),
                )
                connection.execute("DELETE FROM auth_reset_tokens WHERE token_hash = ?", (token_hash,))
                connection.execute("DELETE FROM auth_sessions WHERE email = ?", (reset["email"],))
            return jsonify({"message": "Password has been reset successfully"}), 200

        @self.app.route("/api/investor/auth", methods=["POST"])
        def investor_auth():
            data = request.get_json(silent=True) or {}
            email = self._normalize_email(data.get("email"))
            password = str(data.get("password") or "")
            user = self._get_user(email)
            if not user or user["user_type"] != "investor" or not check_password_hash(user["password_hash"], password):
                return jsonify({"error": "Invalid investor credentials"}), 401
            token = self._create_session(email, "investor")
            return jsonify({
                "message": "Investor authentication successful",
                "access_level": user["access_level"],
                "token": token,
            }), 200

        @self.app.route("/api/user/profile", methods=["GET"])
        @self._require_auth
        def get_profile():
            user = self._get_user(session.get("user_email", ""))
            if not user:
                return jsonify({"error": "User not found"}), 404
            return jsonify({
                "email": user["email"],
                "first_name": user["first_name"],
                "last_name": user["last_name"],
                "created_at": user["created_at"],
                "last_login": user["last_login"],
            }), 200

        @self.app.route("/api/investor/dashboard", methods=["GET"])
        @self._require_investor_auth
        def get_investor_dashboard():
            user = self._get_user(session.get("user_email", ""))
            if not user:
                return jsonify({"error": "Investor not found"}), 404
            return jsonify({
                "investor": {
                    "email": user["email"],
                    "access_level": user["access_level"],
                    "last_login": user["last_login"],
                },
                "metrics": None,
                "message": "No verified investor metrics source is configured.",
            }), 200

    def provision_investor(self, email: str, password: str, access_level: int = 1) -> None:
        """Provision or rotate an investor account through an operator-controlled path."""
        normalized = self._normalize_email(email)
        if not normalized or "@" not in normalized or len(password) < 8:
            raise ValueError("A valid email and password of at least 8 characters are required")
        now = _iso(_utcnow())
        with self._connection() as connection:
            connection.execute(
                """INSERT INTO auth_users
                   (email, password_hash, first_name, last_name, user_type, access_level, created_at)
                   VALUES (?, ?, 'Investor', 'Account', 'investor', ?, ?)
                   ON CONFLICT(email) DO UPDATE SET
                     password_hash = excluded.password_hash,
                     user_type = 'investor',
                     access_level = excluded.access_level""",
                (normalized, generate_password_hash(password), max(1, int(access_level)), now),
            )

    def _deliver_password_reset(self, email: str, token: str) -> bool:
        delivery: Optional[Callable[[str, str], None]] = self.app.config.get("LARO_PASSWORD_RESET_DELIVERY")
        if callable(delivery):
            delivery(email, token)
            return True

        value = lambda key, default="": str(self.app.config.get(key) or os.environ.get(key) or default).strip()
        host = value("SMTP_HOST")
        sender = value("SMTP_FROM")
        template = value("LARO_PASSWORD_RESET_URL_TEMPLATE")
        if not host or not sender or "{token}" not in template:
            return False

        reset_url = template.replace("{token}", quote(token, safe=""))
        message = EmailMessage()
        message["From"] = sender
        message["To"] = email
        message["Subject"] = "Reset your LARO password"
        message.set_content(
            "A password reset was requested for your LARO account. "
            f"Open this link within {int(self.RESET_TTL.total_seconds() // 60)} minutes:\n\n{reset_url}\n\n"
            "If you did not request this, ignore this message."
        )

        port = int(value("SMTP_PORT", "587"))
        username = value("SMTP_USER")
        password = value("SMTP_PASS")
        starttls = value("SMTP_STARTTLS", "true").lower() not in {"0", "false", "no"}
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            if starttls:
                smtp.starttls()
            if username:
                smtp.login(username, password)
            smtp.send_message(message)
        return True

    def _create_session(self, email: str, user_type: str) -> str:
        token = secrets.token_urlsafe(32)
        now = _utcnow()
        with self._connection() as connection:
            connection.execute("DELETE FROM auth_sessions WHERE expires_at <= ?", (_iso(now),))
            connection.execute(
                "INSERT INTO auth_sessions (token_hash, email, user_type, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
                (_token_digest(token), self._normalize_email(email), user_type, _iso(now + self.SESSION_TTL), _iso(now)),
            )
        return token

    @staticmethod
    def _bearer_token() -> Optional[str]:
        header = request.headers.get("Authorization", "")
        scheme, separator, token = header.partition(" ")
        if separator and scheme.lower() == "bearer" and token.strip():
            return token.strip()
        return None

    def _authenticate_request(self, required_type: Optional[str] = None):
        token = self._bearer_token()
        if not token:
            return None, (jsonify({"error": "Authentication required"}), 401)
        digest = _token_digest(token)
        with self._connection() as connection:
            record = connection.execute(
                "SELECT email, user_type, expires_at FROM auth_sessions WHERE token_hash = ?", (digest,)
            ).fetchone()
            if not record:
                return None, (jsonify({"error": "Invalid or expired token"}), 401)
            if _utcnow() > _parse_time(record["expires_at"]):
                connection.execute("DELETE FROM auth_sessions WHERE token_hash = ?", (digest,))
                return None, (jsonify({"error": "Session has expired"}), 401)

        if required_type and record["user_type"] != required_type:
            return None, (jsonify({"error": f"{required_type.title()} access required"}), 403)
        session["user_email"] = record["email"]
        session["user_type"] = record["user_type"]
        return record, None

    def _require_auth(self, function):
        @wraps(function)
        def decorated(*args, **kwargs):
            record, error = self._authenticate_request()
            if error:
                return error
            case_id = kwargs.get("case_id") or (request.view_args or {}).get("case_id")
            case_access_check = self.app.config.get("LARO_CASE_ACCESS_CHECK")
            if case_id is not None and callable(case_access_check):
                if not case_access_check(case_id, record["email"]):
                    return jsonify({"error": "Case not found"}), 404
            return function(*args, **kwargs)
        return decorated

    def _require_investor_auth(self, function):
        @wraps(function)
        def decorated(*args, **kwargs):
            _, error = self._authenticate_request("investor")
            if error:
                return error
            return function(*args, **kwargs)
        return decorated


if __name__ == "__main__":
    from flask import Flask

    standalone_app = Flask(__name__)
    standalone_app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", secrets.token_hex(32))
    EmailAuthenticationSystem(standalone_app)
    standalone_app.run(host="127.0.0.1", port=5000, debug=False)
