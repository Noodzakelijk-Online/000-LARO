"""Destructive coverage for coordinated Flask recovery sets."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import flask_recovery

from flask_recovery import (
    FlaskRecoveryConfig,
    RecoveryError,
    config_from_environment,
    create_backup_set,
    restore_backup_set,
    validate_backup_set,
)
from google_token_store import LocalEncryptedTokenStore


SESSION_SECRET = "flask-recovery-session-secret-with-enough-entropy-2026"


def _fernet_key() -> str:
    return base64.urlsafe_b64encode(os.urandom(32)).decode("ascii")


def _sha(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


class FlaskRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def _config(self, name="source", *, external_token_key=None, session_secret=SESSION_SECRET):
        root = self.root / name
        return FlaskRecoveryConfig(
            root=root,
            ledger_database=root / "instance" / "ledger.sqlite3",
            auth_database=root / "instance" / "auth.sqlite3",
            upload_root=root / "instance" / "uploads",
            token_root=root / "tokens",
            session_secret=session_secret,
            token_encryption_key=external_token_key,
        )

    def _seed(self, config, *, token_key=None, referenced_file=True):
        config.ledger_database.parent.mkdir(parents=True, exist_ok=True)
        config.upload_root.mkdir(parents=True, exist_ok=True)
        config.token_root.mkdir(parents=True, exist_ok=True)
        upload = config.upload_root / "case_1" / "proof.txt"
        upload.parent.mkdir(parents=True, exist_ok=True)
        if referenced_file:
            upload.write_bytes(b"original legal evidence")
        ledger = sqlite3.connect(config.ledger_database)
        try:
            ledger.executescript(
                """
                PRAGMA foreign_keys = ON;
                CREATE TABLE ledger_users (id INTEGER PRIMARY KEY, external_user_id TEXT);
                CREATE TABLE legal_cases (id INTEGER PRIMARY KEY, user_id INTEGER);
                CREATE TABLE case_documents (
                  id INTEGER PRIMARY KEY,
                  case_id INTEGER,
                  local_path TEXT,
                  content_hash TEXT
                );
                CREATE TABLE document_inbox_items (
                  id INTEGER PRIMARY KEY,
                  user_id INTEGER,
                  local_path TEXT,
                  content_hash TEXT
                );
                INSERT INTO ledger_users VALUES (1, 'owner@example.test');
                INSERT INTO legal_cases VALUES (1, 1);
                """
            )
            ledger.execute(
                "INSERT INTO case_documents VALUES (1, 1, ?, ?)",
                (str(upload.resolve()), _sha(b"original legal evidence")),
            )
            ledger.commit()
        finally:
            ledger.close()

        config.auth_database.parent.mkdir(parents=True, exist_ok=True)
        auth = sqlite3.connect(config.auth_database)
        try:
            auth.executescript(
                """
                CREATE TABLE auth_users (email TEXT PRIMARY KEY, password_hash TEXT);
                CREATE TABLE auth_sessions (token_hash TEXT PRIMARY KEY, email TEXT);
                CREATE TABLE auth_reset_tokens (token_hash TEXT PRIMARY KEY, email TEXT);
                INSERT INTO auth_users VALUES ('owner@example.test', 'hash');
                INSERT INTO auth_sessions VALUES ('session-hash', 'owner@example.test');
                """
            )
            auth.commit()
        finally:
            auth.close()

        key = token_key or _fernet_key()
        if not config.token_encryption_key:
            (config.token_root / ".laro-oauth-vault.key").write_text(key, encoding="ascii")
        (config.token_root / "google-owner.vault").write_bytes(b"encrypted-token-record")
        return upload, key

    def test_creates_and_validates_complete_recovery_set(self):
        config = self._config()
        self._seed(config)
        recovery_set = self.root / "backup"

        manifest = create_backup_set(recovery_set, config)
        validated = validate_backup_set(recovery_set, config)

        self.assertEqual(validated["format"], "laro-flask-recovery-set")
        self.assertEqual(manifest["storage"]["uploads"]["file_count"], 1)
        self.assertEqual(manifest["storage"]["tokens"]["file_count"], 2)
        self.assertEqual(manifest["secrets"]["token_encryption"]["mode"], "bundled-vault-key")
        self.assertEqual(manifest["upload_references"][0]["relative_path"], "case_1/proof.txt")

    def test_detects_database_upload_token_and_manifest_tampering(self):
        mutations = {
            "ledger": lambda path: (path / "ledger.sqlite3").write_bytes(b"tampered"),
            "upload": lambda path: (path / "uploads" / "case_1" / "proof.txt").write_bytes(b"tampered"),
            "token": lambda path: (path / "tokens" / "google-owner.vault").write_bytes(b"tampered"),
            "manifest": lambda path: self._tamper_manifest(path),
        }
        for name, mutate in mutations.items():
            with self.subTest(name=name):
                config = self._config(name)
                self._seed(config)
                recovery_set = self.root / f"backup-{name}"
                create_backup_set(recovery_set, config)
                mutate(recovery_set)
                with self.assertRaises(RecoveryError):
                    validate_backup_set(recovery_set, config)

    def test_rejects_omitted_upload_reference_and_extra_root_member(self):
        config = self._config()
        self._seed(config)
        omitted = self.root / "omitted"
        create_backup_set(omitted, config)
        manifest_path = omitted / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["upload_references"] = []
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaisesRegex(RecoveryError, "every ledger-managed"):
            validate_backup_set(omitted, config)

        extra = self.root / "extra"
        create_backup_set(extra, config)
        (extra / "untracked.txt").write_text("not part of the set", encoding="utf-8")
        with self.assertRaisesRegex(RecoveryError, "root members"):
            validate_backup_set(extra, config)

    @staticmethod
    def _tamper_manifest(path):
        manifest_path = path / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["storage"]["uploads"]["file_count"] = 99
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    def test_binds_external_token_encryption_key(self):
        token_key = _fernet_key()
        config = self._config(external_token_key=token_key)
        self._seed(config, token_key=token_key)
        recovery_set = self.root / "external-key-backup"
        manifest = create_backup_set(recovery_set, config)
        self.assertEqual(manifest["secrets"]["token_encryption"]["mode"], "external")
        self.assertNotIn(token_key, json.dumps(manifest))

        wrong = self._config("source", external_token_key=_fernet_key())
        with self.assertRaisesRegex(RecoveryError, "does not match"):
            validate_backup_set(recovery_set, wrong)

    def test_refuses_missing_referenced_upload(self):
        config = self._config()
        self._seed(config, referenced_file=False)
        with self.assertRaisesRegex(RecoveryError, "missing upload"):
            create_backup_set(self.root / "backup", config)

    def test_requires_persistent_session_secret_by_default(self):
        config = self._config(session_secret=None)
        self._seed(config)
        recovery_set = self.root / "backup"
        with self.assertRaisesRegex(RecoveryError, "SECRET_KEY"):
            create_backup_set(recovery_set, config)

        create_backup_set(recovery_set, config, allow_session_reset=True)
        with self.assertRaisesRegex(RecoveryError, "session reset"):
            validate_backup_set(recovery_set, config)
        validate_backup_set(recovery_set, config, allow_session_reset=True)

    def test_restore_replaces_all_members_rebases_paths_and_preserves_previous_state(self):
        source = self._config("source")
        self._seed(source)
        recovery_set = self.root / "backup"
        create_backup_set(recovery_set, source)

        target = self._config("target")
        target.ledger_database.parent.mkdir(parents=True, exist_ok=True)
        target.upload_root.mkdir(parents=True, exist_ok=True)
        target.token_root.mkdir(parents=True, exist_ok=True)
        target.ledger_database.write_bytes(b"previous-ledger")
        target.auth_database.write_bytes(b"previous-auth")
        (target.upload_root / "old.txt").write_bytes(b"previous-upload")
        (target.token_root / "old.vault").write_bytes(b"previous-token")

        with self.assertRaisesRegex(RecoveryError, "confirm-stopped"):
            restore_backup_set(recovery_set, target, confirm_stopped=False)
        result = restore_backup_set(recovery_set, target, confirm_stopped=True)

        restored = sqlite3.connect(target.ledger_database)
        try:
            local_path = restored.execute("SELECT local_path FROM case_documents WHERE id = 1").fetchone()[0]
        finally:
            restored.close()
        self.assertEqual(Path(local_path), target.upload_root / "case_1" / "proof.txt")
        self.assertEqual((target.upload_root / "case_1" / "proof.txt").read_bytes(), b"original legal evidence")
        self.assertEqual((target.token_root / "google-owner.vault").read_bytes(), b"encrypted-token-record")
        self.assertEqual(result.previous_ledger.read_bytes(), b"previous-ledger")
        self.assertEqual(result.previous_auth.read_bytes(), b"previous-auth")
        self.assertEqual((result.previous_uploads / "old.txt").read_bytes(), b"previous-upload")
        self.assertEqual((result.previous_tokens / "old.vault").read_bytes(), b"previous-token")

    def test_restored_bundled_vault_key_decrypts_real_oauth_record(self):
        source = self._config("decrypt-source")
        self._seed(source)
        (source.token_root / "google-owner.vault").unlink()
        source_store = LocalEncryptedTokenStore(root=str(source.token_root))
        source_store.save(
            "owner@example.test",
            "google",
            {"access_token": "access-value", "refresh_token": "refresh-value"},
        )
        recovery_set = self.root / "decrypt-backup"
        create_backup_set(recovery_set, source)

        target = self._config("decrypt-target")
        restore_backup_set(recovery_set, target, confirm_stopped=True)
        restored_store = LocalEncryptedTokenStore(root=str(target.token_root))
        restored = restored_store.load("owner@example.test", "google")
        self.assertEqual(restored["access_token"], "access-value")
        self.assertEqual(restored["refresh_token"], "refresh-value")

    def test_restore_rolls_back_every_member_after_mid_install_failure(self):
        source = self._config("rollback-source")
        self._seed(source)
        recovery_set = self.root / "rollback-backup"
        create_backup_set(recovery_set, source)

        target = self._config("rollback-target")
        target.ledger_database.parent.mkdir(parents=True, exist_ok=True)
        target.upload_root.mkdir(parents=True, exist_ok=True)
        target.token_root.mkdir(parents=True, exist_ok=True)
        target.ledger_database.write_bytes(b"old-ledger")
        target.auth_database.write_bytes(b"old-auth")
        (target.upload_root / "old.txt").write_bytes(b"old-upload")
        (target.token_root / "old.vault").write_bytes(b"old-token")

        real_replace = os.replace
        failed = False

        def fail_upload_install(source_path, destination_path):
            nonlocal failed
            if not failed and ".restore-" in str(source_path) and Path(destination_path) == target.upload_root:
                failed = True
                raise OSError("injected upload installation failure")
            return real_replace(source_path, destination_path)

        with mock.patch("flask_recovery.os.replace", side_effect=fail_upload_install):
            with self.assertRaisesRegex(RecoveryError, "previous state was restored"):
                restore_backup_set(recovery_set, target, confirm_stopped=True)

        self.assertEqual(target.ledger_database.read_bytes(), b"old-ledger")
        self.assertEqual(target.auth_database.read_bytes(), b"old-auth")
        self.assertEqual((target.upload_root / "old.txt").read_bytes(), b"old-upload")
        self.assertEqual((target.token_root / "old.vault").read_bytes(), b"old-token")

    def test_aborts_when_database_changes_during_snapshot(self):
        config = self._config()
        self._seed(config)
        destination = self.root / "unstable"
        original = flask_recovery._copy_directory_snapshot
        mutated = False

        def copy_then_mutate(source, target, name):
            nonlocal mutated
            result = original(source, target, name)
            if not mutated:
                writer = sqlite3.connect(config.ledger_database)
                try:
                    writer.execute("UPDATE legal_cases SET user_id = 2 WHERE id = 1")
                    writer.commit()
                finally:
                    writer.close()
                mutated = True
            return result

        with mock.patch("flask_recovery._copy_directory_snapshot", side_effect=copy_then_mutate):
            with self.assertRaisesRegex(RecoveryError, "Ledger database changed"):
                create_backup_set(destination, config)
        self.assertFalse(destination.exists())

    def test_refuses_existing_destination_and_overlapping_paths(self):
        config = self._config()
        self._seed(config)
        existing = self.root / "existing"
        existing.mkdir()
        with self.assertRaisesRegex(RecoveryError, "already exists"):
            create_backup_set(existing, config)
        with self.assertRaisesRegex(RecoveryError, "inside live Flask storage"):
            create_backup_set(config.upload_root / "backup", config)

    def test_default_config_discovers_existing_legacy_upload_root(self):
        root = self.root / "legacy-layout"
        legacy = root / "instance" / "laro_uploads"
        legacy.mkdir(parents=True)
        with mock.patch.dict(os.environ, {"LARO_UPLOAD_ROOT": ""}):
            config = config_from_environment(root=root)
        self.assertEqual(config.upload_root, legacy.resolve())

        (root / "instance" / "uploads").mkdir()
        with mock.patch.dict(os.environ, {"LARO_UPLOAD_ROOT": ""}):
            config = config_from_environment(root=root)
        self.assertEqual(config.upload_root, (root / "instance" / "uploads").resolve())


if __name__ == "__main__":
    unittest.main()
