"""Coordinated backup and restore for the Flask command-center runtime."""

from __future__ import annotations

import base64
import datetime as dt
import hashlib
import hmac
import json
import os
import re
import shutil
import sqlite3
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


FORMAT = "laro-flask-recovery-set"
VERSION = 1
MANIFEST_NAME = "manifest.json"
LEDGER_NAME = "ledger.sqlite3"
AUTH_NAME = "auth.sqlite3"
UPLOADS_NAME = "uploads"
TOKENS_NAME = "tokens"


class RecoveryError(RuntimeError):
    """Raised when a recovery set cannot be created, validated, or restored."""


@dataclass(frozen=True)
class FlaskRecoveryConfig:
    root: Path
    ledger_database: Path
    auth_database: Path
    upload_root: Path
    token_root: Path
    session_secret: Optional[str] = None
    token_encryption_key: Optional[str] = None


@dataclass(frozen=True)
class RestoreResult:
    previous_ledger: Optional[Path]
    previous_auth: Optional[Path]
    previous_uploads: Optional[Path]
    previous_tokens: Optional[Path]


def _resolved(path: Path) -> Path:
    return path.expanduser().resolve()


def _sqlite_path(value: str, root: Path) -> Path:
    raw = str(value or "").strip()
    if not raw:
        raise RecoveryError("SQLite database path is required")
    if raw.startswith("sqlite:///"):
        raw = raw[len("sqlite:///") :]
    elif "://" in raw:
        raise RecoveryError("Flask recovery currently supports SQLite databases only")
    if raw in {":memory:", "/:memory:"}:
        raise RecoveryError("An in-memory database cannot be recovered")
    raw = raw.split("?", 1)[0]
    candidate = Path(raw).expanduser()
    if not candidate.is_absolute():
        candidate = root / candidate
    return candidate.resolve()


def config_from_environment(
    *,
    root: Optional[Path] = None,
    ledger_database: Optional[str] = None,
    auth_database: Optional[str] = None,
    upload_root: Optional[str] = None,
    token_root: Optional[str] = None,
) -> FlaskRecoveryConfig:
    base = _resolved(root or Path.cwd())
    ledger = ledger_database or os.environ.get("LARO_LEDGER_DATABASE_URL") or "sqlite:///instance/laro_ledger.sqlite3"
    auth = auth_database or os.environ.get("LARO_AUTH_DATABASE_PATH") or "instance/laro_auth.sqlite3"
    uploads = upload_root or os.environ.get("LARO_UPLOAD_ROOT")
    tokens = token_root or os.environ.get("LARO_TOKEN_STORE_DIR") or "tokens"
    return FlaskRecoveryConfig(
        root=base,
        ledger_database=_sqlite_path(ledger, base),
        auth_database=_sqlite_path(auth, base),
        upload_root=_resolve_data_path(uploads, base) if uploads else _default_upload_root(base),
        token_root=_resolve_data_path(tokens, base),
        session_secret=os.environ.get("SECRET_KEY") or None,
        token_encryption_key=os.environ.get("LARO_TOKEN_ENCRYPTION_KEY") or None,
    )


def _resolve_data_path(value: str, root: Path) -> Path:
    candidate = Path(str(value)).expanduser()
    if not candidate.is_absolute():
        candidate = root / candidate
    return candidate.resolve()


def _default_upload_root(root: Path) -> Path:
    canonical = (root / "instance" / "uploads").resolve()
    legacy = (root / "instance" / "laro_uploads").resolve()
    if legacy.is_dir() and not canonical.exists():
        return legacy
    return canonical


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _member(path: Path, relative: str) -> Dict[str, Any]:
    return {"path": relative, "bytes": path.stat().st_size, "sha256": _sha256(path)}


def _safe_relative(value: str) -> Path:
    normalized = str(value or "").replace("\\", "/")
    candidate = Path(normalized)
    if not normalized or candidate.is_absolute() or ".." in candidate.parts:
        raise RecoveryError(f"Unsafe recovery-set path: {value!r}")
    return candidate


def _contains(parent: Path, child: Path) -> bool:
    try:
        child.relative_to(parent)
        return True
    except ValueError:
        return False


def _ensure_distinct(config: FlaskRecoveryConfig) -> None:
    files = [config.ledger_database, config.auth_database]
    roots = [config.upload_root, config.token_root]
    if files[0] == files[1]:
        raise RecoveryError("Ledger and authentication databases must use different files")
    if roots[0] == roots[1] or _contains(roots[0], roots[1]) or _contains(roots[1], roots[0]):
        raise RecoveryError("Upload and token roots must not overlap")
    for database in files:
        for root in roots:
            if _contains(root, database):
                raise RecoveryError("Database files must not be inside a managed directory")


def _scan_directory(root: Path) -> Tuple[bool, List[Dict[str, Any]]]:
    if not root.exists():
        return False, []
    if root.is_symlink() or not root.is_dir():
        raise RecoveryError(f"Managed root must be a real directory: {root}")
    files: List[Dict[str, Any]] = []
    for path in sorted(root.rglob("*"), key=lambda item: item.relative_to(root).as_posix()):
        if path.is_symlink():
            raise RecoveryError(f"Symbolic links are not supported in recovery sets: {path}")
        if path.is_dir():
            continue
        if not path.is_file():
            raise RecoveryError(f"Unsupported filesystem entry in recovery source: {path}")
        relative = path.relative_to(root).as_posix()
        files.append({"path": relative, "bytes": path.stat().st_size, "sha256": _sha256(path)})
    return True, files


def _copy_directory_snapshot(source: Path, destination: Path, name: str) -> Dict[str, Any]:
    present, initial = _scan_directory(source)
    destination.mkdir(parents=True, exist_ok=False)
    for item in initial:
        relative = _safe_relative(item["path"])
        source_file = source / relative
        target_file = destination / relative
        target_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source_file, target_file)
        copied = _member(target_file, item["path"])
        if copied["bytes"] != item["bytes"] or copied["sha256"] != item["sha256"]:
            raise RecoveryError(f"{name} changed while it was copied: {item['path']}")
    _, copied_files = _scan_directory(destination)
    if copied_files != initial:
        raise RecoveryError(f"Copied {name} inventory does not match its source")
    return {
        "path": destination.name,
        "source_present": present,
        "file_count": len(initial),
        "total_bytes": sum(int(item["bytes"]) for item in initial),
        "files": initial,
    }


def _open_source_database(path: Path) -> sqlite3.Connection:
    if not path.is_file() or path.is_symlink():
        raise RecoveryError(f"SQLite source does not exist as a regular file: {path}")
    connection = sqlite3.connect(str(path), timeout=10)
    connection.execute("PRAGMA query_only = ON")
    connection.execute("PRAGMA busy_timeout = 5000")
    return connection


def _database_tables(connection: sqlite3.Connection) -> List[str]:
    rows = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).fetchall()
    return [str(row[0]) for row in rows]


def _validate_database(path: Path, required_tables: Iterable[str]) -> List[str]:
    if not path.is_file() or path.is_symlink():
        raise RecoveryError(f"Recovery database is missing: {path}")
    connection = sqlite3.connect(str(path), timeout=10)
    try:
        quick = [str(row[0]) for row in connection.execute("PRAGMA quick_check").fetchall()]
        if quick != ["ok"]:
            raise RecoveryError(f"SQLite quick_check failed for {path.name}: {quick}")
        foreign_keys = connection.execute("PRAGMA foreign_key_check").fetchall()
        if foreign_keys:
            raise RecoveryError(f"SQLite foreign-key check failed for {path.name}")
        tables = _database_tables(connection)
        missing = sorted(set(required_tables) - set(tables))
        if missing:
            raise RecoveryError(f"SQLite database {path.name} is missing tables: {', '.join(missing)}")
        return tables
    finally:
        connection.close()


def _backup_database(source: sqlite3.Connection, destination: Path, required_tables: Iterable[str]) -> Dict[str, Any]:
    target = sqlite3.connect(str(destination))
    try:
        source.backup(target)
        target.commit()
    finally:
        target.close()
    tables = _validate_database(destination, required_tables)
    result = _member(destination, destination.name)
    result["tables"] = tables
    return result


def _secret_descriptor(secret: str, purpose: str) -> Dict[str, str]:
    salt = os.urandom(16)
    tag = hmac.new(secret.encode("utf-8"), purpose.encode("utf-8") + b"\0" + salt, hashlib.sha256).digest()
    return {
        "salt": base64.urlsafe_b64encode(salt).decode("ascii"),
        "tag": base64.urlsafe_b64encode(tag).decode("ascii"),
    }


def _secret_matches(secret: str, descriptor: Dict[str, Any], purpose: str) -> bool:
    try:
        salt = base64.urlsafe_b64decode(str(descriptor["salt"]).encode("ascii"))
        expected = base64.urlsafe_b64decode(str(descriptor["tag"]).encode("ascii"))
    except (KeyError, ValueError, TypeError) as exc:
        raise RecoveryError("Recovery manifest contains an invalid secret compatibility descriptor") from exc
    actual = hmac.new(secret.encode("utf-8"), purpose.encode("utf-8") + b"\0" + salt, hashlib.sha256).digest()
    return hmac.compare_digest(actual, expected)


def _strong_session_secret(secret: Optional[str]) -> bool:
    value = str(secret or "")
    return len(value) >= 32 and value.lower() not in {
        "change-me",
        "changeme",
        "secret",
        "development",
        "insecure",
    }


def _valid_fernet_key(value: bytes) -> bool:
    try:
        return len(base64.urlsafe_b64decode(value.strip())) == 32
    except (ValueError, TypeError):
        return False


def _token_secret_manifest(config: FlaskRecoveryConfig, token_inventory: Dict[str, Any]) -> Dict[str, Any]:
    external = config.token_encryption_key
    key_file = config.token_root / ".laro-oauth-vault.key"
    vault_files = [item for item in token_inventory["files"] if str(item["path"]).endswith(".vault")]
    if external:
        if not _valid_fernet_key(external.encode("utf-8")):
            raise RecoveryError("LARO_TOKEN_ENCRYPTION_KEY is not a valid Fernet key")
        return {"mode": "external", **_secret_descriptor(external, "flask-token-vault-v1")}
    if key_file.is_file():
        if not _valid_fernet_key(key_file.read_bytes()):
            raise RecoveryError("The bundled OAuth vault key is not a valid Fernet key")
        return {"mode": "bundled-vault-key"}
    if vault_files:
        raise RecoveryError("OAuth vault files exist, but no matching encryption key is available")
    return {"mode": "not-yet-created"}


def _session_secret_manifest(secret: Optional[str], allow_session_reset: bool) -> Dict[str, Any]:
    if _strong_session_secret(secret):
        return {"mode": "external", **_secret_descriptor(str(secret), "flask-session-v1")}
    if not allow_session_reset:
        raise RecoveryError(
            "SECRET_KEY must be a strong persistent value before a complete Flask backup can be created; "
            "use --allow-session-reset only when invalidating browser sessions is acceptable"
        )
    return {"mode": "session-reset-required"}


def _database_references(ledger: Path, upload_root: Path, root: Path, upload_files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    inventory = {str(item["path"]): item for item in upload_files}
    references: List[Dict[str, Any]] = []
    connection = sqlite3.connect(str(ledger))
    try:
        tables = set(_database_tables(connection))
        for table in ("case_documents", "document_inbox_items"):
            if table not in tables:
                continue
            columns = {str(row[1]) for row in connection.execute(f"PRAGMA table_info({table})").fetchall()}
            if not {"id", "local_path"}.issubset(columns):
                continue
            hash_column = "content_hash" if "content_hash" in columns else "''"
            rows = connection.execute(
                f"SELECT id, local_path, {hash_column} FROM {table} "
                "WHERE local_path IS NOT NULL AND trim(local_path) <> '' ORDER BY id"
            ).fetchall()
            for row_id, raw_path, expected_hash in rows:
                candidate = Path(str(raw_path)).expanduser()
                if not candidate.is_absolute():
                    candidate = root / candidate
                candidate = candidate.resolve()
                if not _contains(upload_root, candidate):
                    raise RecoveryError(f"{table} row {row_id} references a file outside LARO_UPLOAD_ROOT")
                relative = candidate.relative_to(upload_root).as_posix()
                member = inventory.get(relative)
                if member is None:
                    raise RecoveryError(f"{table} row {row_id} references missing upload {relative}")
                if expected_hash and str(expected_hash).lower() != str(member["sha256"]).lower():
                    raise RecoveryError(f"{table} row {row_id} content hash does not match {relative}")
                references.append({"table": table, "id": int(row_id), "relative_path": relative})
    finally:
        connection.close()
    return references


def _assert_source_stable(root: Path, expected: List[Dict[str, Any]], name: str) -> None:
    _, current = _scan_directory(root)
    if current != expected:
        raise RecoveryError(f"{name} changed while the recovery set was being created")


def create_backup_set(
    destination: Path,
    config: FlaskRecoveryConfig,
    *,
    allow_session_reset: bool = False,
) -> Dict[str, Any]:
    destination = _resolved(destination)
    _ensure_distinct(config)
    if destination.exists():
        raise RecoveryError(f"Recovery-set destination already exists: {destination}")
    for managed_root in (config.upload_root, config.token_root):
        if _contains(managed_root, destination):
            raise RecoveryError("Recovery-set destination must not be inside live Flask storage")
    for database in (config.ledger_database, config.auth_database):
        if destination == database:
            raise RecoveryError("Recovery-set destination cannot replace a live database")

    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f".{destination.name}.tmp-{uuid.uuid4().hex}")
    temporary.mkdir()
    ledger_source: Optional[sqlite3.Connection] = None
    auth_source: Optional[sqlite3.Connection] = None
    try:
        ledger_source = _open_source_database(config.ledger_database)
        auth_source = _open_source_database(config.auth_database)
        ledger_version = int(ledger_source.execute("PRAGMA data_version").fetchone()[0])
        auth_version = int(auth_source.execute("PRAGMA data_version").fetchone()[0])

        ledger_member = _backup_database(
            ledger_source,
            temporary / LEDGER_NAME,
            ("ledger_users", "legal_cases", "case_documents", "document_inbox_items"),
        )
        auth_member = _backup_database(
            auth_source,
            temporary / AUTH_NAME,
            ("auth_users", "auth_sessions", "auth_reset_tokens"),
        )
        uploads = _copy_directory_snapshot(config.upload_root, temporary / UPLOADS_NAME, "upload store")
        tokens = _copy_directory_snapshot(config.token_root, temporary / TOKENS_NAME, "token vault")
        references = _database_references(
            temporary / LEDGER_NAME,
            config.upload_root,
            config.root,
            uploads["files"],
        )
        secrets_manifest = {
            "session": _session_secret_manifest(config.session_secret, allow_session_reset),
            "token_encryption": _token_secret_manifest(config, tokens),
        }

        if int(ledger_source.execute("PRAGMA data_version").fetchone()[0]) != ledger_version:
            raise RecoveryError("Ledger database changed while the recovery set was being created")
        if int(auth_source.execute("PRAGMA data_version").fetchone()[0]) != auth_version:
            raise RecoveryError("Authentication database changed while the recovery set was being created")
        _assert_source_stable(config.upload_root, uploads["files"], "Upload store")
        _assert_source_stable(config.token_root, tokens["files"], "Token vault")

        manifest = {
            "format": FORMAT,
            "version": VERSION,
            "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "requires_stopped_runtime_for_restore": True,
            "databases": {"ledger": ledger_member, "auth": auth_member},
            "storage": {"uploads": uploads, "tokens": tokens},
            "upload_references": references,
            "secrets": secrets_manifest,
        }
        manifest_path = temporary / MANIFEST_NAME
        manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        os.replace(temporary, destination)
        return manifest
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise
    finally:
        if ledger_source is not None:
            ledger_source.close()
        if auth_source is not None:
            auth_source.close()


def _load_manifest(recovery_set: Path) -> Dict[str, Any]:
    manifest_path = recovery_set / MANIFEST_NAME
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError) as exc:
        raise RecoveryError(f"Recovery manifest could not be read: {manifest_path}") from exc
    if manifest.get("format") != FORMAT or manifest.get("version") != VERSION:
        raise RecoveryError("Unsupported Flask recovery-set format or version")
    return manifest


def _validate_file_member(root: Path, member: Dict[str, Any]) -> Path:
    relative = _safe_relative(str(member.get("path") or ""))
    path = root / relative
    if not path.is_file() or path.is_symlink():
        raise RecoveryError(f"Recovery-set member is missing: {relative.as_posix()}")
    if path.stat().st_size != int(member.get("bytes", -1)):
        raise RecoveryError(f"Recovery-set member size mismatch: {relative.as_posix()}")
    if _sha256(path) != str(member.get("sha256") or ""):
        raise RecoveryError(f"Recovery-set member hash mismatch: {relative.as_posix()}")
    return path


def _validate_directory_member(recovery_set: Path, member: Dict[str, Any], name: str) -> Path:
    relative = _safe_relative(str(member.get("path") or ""))
    root = recovery_set / relative
    if not root.is_dir() or root.is_symlink():
        raise RecoveryError(f"Recovery-set {name} directory is missing")
    _, actual = _scan_directory(root)
    expected = member.get("files")
    if not isinstance(expected, list) or actual != expected:
        raise RecoveryError(f"Recovery-set {name} inventory mismatch")
    if len(actual) != int(member.get("file_count", -1)):
        raise RecoveryError(f"Recovery-set {name} file count mismatch")
    if sum(int(item["bytes"]) for item in actual) != int(member.get("total_bytes", -1)):
        raise RecoveryError(f"Recovery-set {name} byte count mismatch")
    return root


def _validate_upload_references(ledger: Path, uploads: Dict[str, Any], references: Any) -> None:
    if not isinstance(references, list):
        raise RecoveryError("Recovery manifest upload references are invalid")
    inventory = {str(item["path"]): item for item in uploads["files"]}
    connection = sqlite3.connect(str(ledger))
    try:
        database_keys = set()
        for table in ("case_documents", "document_inbox_items"):
            rows = connection.execute(
                f"SELECT id FROM {table} WHERE local_path IS NOT NULL AND trim(local_path) <> ''"
            ).fetchall()
            database_keys.update((table, int(row[0])) for row in rows)
        manifest_keys = set()
        for reference in references:
            table = str(reference.get("table") or "")
            if table not in {"case_documents", "document_inbox_items"}:
                raise RecoveryError("Recovery manifest references an unsupported ledger table")
            row_id = int(reference.get("id"))
            key = (table, row_id)
            if key in manifest_keys:
                raise RecoveryError(f"Recovery manifest contains duplicate {table} row {row_id}")
            manifest_keys.add(key)
            relative = _safe_relative(str(reference.get("relative_path") or "")).as_posix()
            member = inventory.get(relative)
            if member is None:
                raise RecoveryError(f"Referenced upload is absent from the recovery set: {relative}")
            row = connection.execute(
                f"SELECT local_path, content_hash FROM {table} WHERE id = ?", (row_id,)
            ).fetchone()
            if row is None:
                raise RecoveryError(f"Recovery manifest references missing {table} row {row_id}")
            normalized = str(row[0] or "").replace("\\", "/")
            if normalized != relative and not normalized.endswith("/" + relative):
                raise RecoveryError(f"Recovery manifest path does not match {table} row {row_id}")
            if row[1] and str(row[1]).lower() != str(member["sha256"]).lower():
                raise RecoveryError(f"Recovered upload hash does not match {table} row {row_id}")
        if manifest_keys != database_keys:
            raise RecoveryError("Recovery manifest does not cover every ledger-managed upload reference")
    finally:
        connection.close()


def _validate_secrets(
    manifest: Dict[str, Any],
    config: Optional[FlaskRecoveryConfig],
    token_root: Path,
    allow_session_reset: bool,
) -> None:
    secrets_manifest = manifest.get("secrets") or {}
    session = secrets_manifest.get("session") or {}
    session_mode = session.get("mode")
    if session_mode == "external":
        if config is None or not config.session_secret:
            raise RecoveryError("The matching SECRET_KEY is required to validate this recovery set")
        if not _secret_matches(config.session_secret, session, "flask-session-v1"):
            if not allow_session_reset:
                raise RecoveryError("SECRET_KEY does not match this recovery set")
    elif session_mode == "session-reset-required":
        if not allow_session_reset:
            raise RecoveryError("This recovery set requires explicit acceptance of a browser-session reset")
    else:
        raise RecoveryError("Recovery manifest contains an unsupported session-secret mode")

    token = secrets_manifest.get("token_encryption") or {}
    token_mode = token.get("mode")
    if token_mode == "external":
        if config is None or not config.token_encryption_key:
            raise RecoveryError("The matching LARO_TOKEN_ENCRYPTION_KEY is required for this recovery set")
        if not _secret_matches(config.token_encryption_key, token, "flask-token-vault-v1"):
            raise RecoveryError("LARO_TOKEN_ENCRYPTION_KEY does not match this recovery set")
    elif token_mode == "bundled-vault-key":
        key_path = token_root / ".laro-oauth-vault.key"
        if not key_path.is_file() or not _valid_fernet_key(key_path.read_bytes()):
            raise RecoveryError("Bundled OAuth vault key is missing or invalid")
        if config is not None and config.token_encryption_key:
            if not hmac.compare_digest(config.token_encryption_key.encode("utf-8"), key_path.read_bytes().strip()):
                raise RecoveryError("Active LARO_TOKEN_ENCRYPTION_KEY conflicts with the bundled vault key")
    elif token_mode == "not-yet-created":
        if any(str(item["path"]).endswith(".vault") for item in manifest["storage"]["tokens"]["files"]):
            raise RecoveryError("Token vault has encrypted records without a recoverable key")
    else:
        raise RecoveryError("Recovery manifest contains an unsupported token-encryption mode")


def validate_backup_set(
    recovery_set: Path,
    config: Optional[FlaskRecoveryConfig] = None,
    *,
    allow_session_reset: bool = False,
) -> Dict[str, Any]:
    recovery_set = _resolved(recovery_set)
    if not recovery_set.is_dir() or recovery_set.is_symlink():
        raise RecoveryError(f"Flask recovery set does not exist: {recovery_set}")
    manifest = _load_manifest(recovery_set)
    actual_root_entries = {path.name for path in recovery_set.iterdir()}
    expected_root_entries = {MANIFEST_NAME, LEDGER_NAME, AUTH_NAME, UPLOADS_NAME, TOKENS_NAME}
    if actual_root_entries != expected_root_entries:
        raise RecoveryError("Recovery-set root members do not match the versioned format")
    databases = manifest.get("databases") or {}
    storage = manifest.get("storage") or {}
    ledger_member = databases.get("ledger") or {}
    auth_member = databases.get("auth") or {}
    uploads_member = storage.get("uploads") or {}
    tokens_member = storage.get("tokens") or {}
    ledger = _validate_file_member(recovery_set, ledger_member)
    auth = _validate_file_member(recovery_set, auth_member)
    ledger_tables = _validate_database(
        ledger, ("ledger_users", "legal_cases", "case_documents", "document_inbox_items")
    )
    auth_tables = _validate_database(auth, ("auth_users", "auth_sessions", "auth_reset_tokens"))
    if ledger_tables != ledger_member.get("tables") or auth_tables != auth_member.get("tables"):
        raise RecoveryError("Recovery-set database table inventory mismatch")
    uploads = _validate_directory_member(recovery_set, uploads_member, "upload store")
    tokens = _validate_directory_member(recovery_set, tokens_member, "token vault")
    _validate_upload_references(ledger, uploads_member, manifest.get("upload_references"))
    _validate_secrets(manifest, config, tokens, allow_session_reset)
    return manifest


def _copy_stage(source: Path, target: Path) -> Path:
    stage = target.with_name(f".{target.name}.restore-{uuid.uuid4().hex}")
    if source.is_dir():
        shutil.copytree(source, stage)
    else:
        stage.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, stage)
    return stage


def _rebase_upload_references(ledger: Path, upload_root: Path, references: List[Dict[str, Any]]) -> None:
    connection = sqlite3.connect(str(ledger))
    try:
        for reference in references:
            table = str(reference["table"])
            row_id = int(reference["id"])
            relative = _safe_relative(str(reference["relative_path"]))
            local_path = str((upload_root / relative).resolve())
            connection.execute(f"UPDATE {table} SET local_path = ? WHERE id = ?", (local_path, row_id))
        connection.commit()
    finally:
        connection.close()


def _backup_name(path: Path, timestamp: str) -> Path:
    candidate = path.with_name(f"{path.name}.bak-{timestamp}")
    counter = 1
    while candidate.exists():
        candidate = path.with_name(f"{path.name}.bak-{timestamp}-{counter}")
        counter += 1
    return candidate


def _remove_path(path: Path) -> None:
    if not path.exists() and not path.is_symlink():
        return
    if path.is_dir() and not path.is_symlink():
        shutil.rmtree(path)
    else:
        path.unlink()


def restore_backup_set(
    recovery_set: Path,
    config: FlaskRecoveryConfig,
    *,
    confirm_stopped: bool,
    allow_session_reset: bool = False,
) -> RestoreResult:
    if not confirm_stopped:
        raise RecoveryError("Restore requires --confirm-stopped after the Flask runtime has been stopped")
    _ensure_distinct(config)
    manifest = validate_backup_set(recovery_set, config, allow_session_reset=allow_session_reset)
    recovery_set = _resolved(recovery_set)
    targets = [config.ledger_database, config.auth_database, config.upload_root, config.token_root]
    if any(_contains(recovery_set, target) or _contains(target, recovery_set) for target in targets):
        raise RecoveryError("Recovery set and live Flask paths must not overlap")

    sources = [
        recovery_set / LEDGER_NAME,
        recovery_set / AUTH_NAME,
        recovery_set / UPLOADS_NAME,
        recovery_set / TOKENS_NAME,
    ]
    for target in targets:
        target.parent.mkdir(parents=True, exist_ok=True)
    stages: List[Path] = []
    try:
        stages = [_copy_stage(source, target) for source, target in zip(sources, targets)]
        _rebase_upload_references(stages[0], config.upload_root, manifest["upload_references"])
        _validate_database(stages[0], ("ledger_users", "legal_cases", "case_documents", "document_inbox_items"))
        _validate_database(stages[1], ("auth_users", "auth_sessions", "auth_reset_tokens"))
        _, staged_uploads = _scan_directory(stages[2])
        _, staged_tokens = _scan_directory(stages[3])
        if staged_uploads != manifest["storage"]["uploads"]["files"]:
            raise RecoveryError("Staged upload inventory changed before installation")
        if staged_tokens != manifest["storage"]["tokens"]["files"]:
            raise RecoveryError("Staged token inventory changed before installation")
    except Exception:
        for stage in stages:
            _remove_path(stage)
        raise

    timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    previous: List[Optional[Path]] = [None, None, None, None]
    installed = [False, False, False, False]
    try:
        for index, target in enumerate(targets):
            if target.exists() or target.is_symlink():
                previous[index] = _backup_name(target, timestamp)
                os.replace(target, previous[index])
            os.replace(stages[index], target)
            installed[index] = True
    except Exception as install_error:
        rollback_errors: List[Exception] = []
        for index in reversed(range(len(targets))):
            try:
                if installed[index]:
                    _remove_path(targets[index])
                if previous[index] is not None and previous[index].exists():
                    os.replace(previous[index], targets[index])
            except Exception as exc:  # pragma: no cover - platform failure aggregation
                rollback_errors.append(exc)
        for stage in stages:
            try:
                _remove_path(stage)
            except Exception:
                pass
        if rollback_errors:
            raise RecoveryError(
                f"Flask restore failed and rollback was incomplete: {install_error}; "
                + "; ".join(str(error) for error in rollback_errors)
            ) from install_error
        raise RecoveryError(f"Flask restore failed; previous state was restored: {install_error}") from install_error

    return RestoreResult(previous[0], previous[1], previous[2], previous[3])


def load_dotenv(path: Path) -> None:
    """Load the repository .env without overriding an already exported value."""
    if not path.is_file():
        return
    pattern = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name = name.strip()
        value = value.strip()
        if not pattern.match(name):
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ.setdefault(name, value)
