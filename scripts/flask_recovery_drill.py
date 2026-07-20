#!/usr/bin/env python3
"""Destructive, isolated proof of Flask command-center recovery."""

from __future__ import annotations

import base64
import hashlib
import os
import sqlite3
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from flask_recovery import FlaskRecoveryConfig, create_backup_set, restore_backup_set  # noqa: E402


def _key() -> str:
    return base64.urlsafe_b64encode(os.urandom(32)).decode("ascii")


def _seed(config: FlaskRecoveryConfig) -> None:
    config.ledger_database.parent.mkdir(parents=True, exist_ok=True)
    config.upload_root.mkdir(parents=True, exist_ok=True)
    config.token_root.mkdir(parents=True, exist_ok=True)
    evidence = config.upload_root / "case_41" / "notice.txt"
    evidence.parent.mkdir(parents=True, exist_ok=True)
    evidence.write_bytes(b"Recovery drill legal evidence")
    evidence_hash = hashlib.sha256(evidence.read_bytes()).hexdigest()

    ledger = sqlite3.connect(config.ledger_database)
    try:
        ledger.executescript(
            """
            CREATE TABLE ledger_users (id INTEGER PRIMARY KEY, external_user_id TEXT);
            CREATE TABLE legal_cases (id INTEGER PRIMARY KEY, user_id INTEGER, title TEXT);
            CREATE TABLE case_documents (
              id INTEGER PRIMARY KEY, case_id INTEGER, local_path TEXT, content_hash TEXT
            );
            CREATE TABLE document_inbox_items (
              id INTEGER PRIMARY KEY, user_id INTEGER, local_path TEXT, content_hash TEXT
            );
            INSERT INTO ledger_users VALUES (7, 'recovery@example.test');
            INSERT INTO legal_cases VALUES (41, 7, 'Verified recovery case');
            """
        )
        ledger.execute(
            "INSERT INTO case_documents VALUES (51, 41, ?, ?)",
            (str(evidence.resolve()), evidence_hash),
        )
        ledger.commit()
    finally:
        ledger.close()

    auth = sqlite3.connect(config.auth_database)
    try:
        auth.executescript(
            """
            CREATE TABLE auth_users (email TEXT PRIMARY KEY, password_hash TEXT);
            CREATE TABLE auth_sessions (token_hash TEXT PRIMARY KEY, email TEXT);
            CREATE TABLE auth_reset_tokens (token_hash TEXT PRIMARY KEY, email TEXT);
            INSERT INTO auth_users VALUES ('recovery@example.test', 'password-hash');
            INSERT INTO auth_sessions VALUES ('bearer-session-hash', 'recovery@example.test');
            """
        )
        auth.commit()
    finally:
        auth.close()

    (config.token_root / ".laro-oauth-vault.key").write_text(_key(), encoding="ascii")
    (config.token_root / "google-recovery.vault").write_bytes(b"encrypted-oauth-record")


def _config(root: Path) -> FlaskRecoveryConfig:
    return FlaskRecoveryConfig(
        root=root,
        ledger_database=root / "instance" / "ledger.sqlite3",
        auth_database=root / "instance" / "auth.sqlite3",
        upload_root=root / "instance" / "uploads",
        token_root=root / "tokens",
        session_secret="isolated-flask-recovery-drill-secret-2026-strong",
    )


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="laro-flask-recovery-") as temporary:
        root = Path(temporary)
        config = _config(root / "live")
        _seed(config)
        recovery_set = root / "recovery-set"
        create_backup_set(recovery_set, config)

        config.ledger_database.write_bytes(b"mutated-ledger")
        config.auth_database.write_bytes(b"mutated-auth")
        for path in config.upload_root.rglob("*"):
            if path.is_file():
                path.unlink()
        (config.upload_root / "mutated.txt").write_bytes(b"mutated-upload")
        for path in config.token_root.rglob("*"):
            if path.is_file():
                path.unlink()
        (config.token_root / "mutated.vault").write_bytes(b"mutated-token")

        restored = restore_backup_set(recovery_set, config, confirm_stopped=True)
        ledger = sqlite3.connect(config.ledger_database)
        try:
            case = ledger.execute("SELECT title FROM legal_cases WHERE id = 41").fetchone()
            local_path = ledger.execute("SELECT local_path FROM case_documents WHERE id = 51").fetchone()[0]
        finally:
            ledger.close()
        auth = sqlite3.connect(config.auth_database)
        try:
            user = auth.execute("SELECT email FROM auth_users").fetchone()
            session = auth.execute("SELECT token_hash FROM auth_sessions").fetchone()
        finally:
            auth.close()

        assert case == ("Verified recovery case",)
        assert user == ("recovery@example.test",)
        assert session == ("bearer-session-hash",)
        assert Path(local_path).resolve() == (config.upload_root / "case_41" / "notice.txt").resolve()
        assert Path(local_path).read_bytes() == b"Recovery drill legal evidence"
        assert (config.token_root / "google-recovery.vault").read_bytes() == b"encrypted-oauth-record"
        assert restored.previous_ledger.read_bytes() == b"mutated-ledger"
        assert restored.previous_auth.read_bytes() == b"mutated-auth"
        assert (restored.previous_uploads / "mutated.txt").read_bytes() == b"mutated-upload"
        assert (restored.previous_tokens / "mutated.vault").read_bytes() == b"mutated-token"

    print(
        "[Flask recovery drill] Ledger, auth sessions, OAuth vault, and uploaded evidence restored; "
        "all previous paths preserved."
    )


if __name__ == "__main__":
    main()
