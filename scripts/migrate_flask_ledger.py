#!/usr/bin/env python3
"""Owner-bound, one-way migration from the Flask ledger into LARO Desktop.

The source is opened read-only. A migration maps supported operational records
into the desktop schema and retains every owner-scoped source row in a redacted,
hash-addressed archive. Dry-run is the default; --apply is explicit.
"""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import json
import mimetypes
import os
import re
import shutil
import sqlite3
import sys
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Optional
from urllib.parse import unquote, urlparse


SOURCE_RUNTIME = "flask"
SOURCE_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,80}$")
IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
HASH_PATTERN = re.compile(r"^[a-fA-F0-9]{64}$")
SENSITIVE_FIELDS = {
    "accesstoken",
    "apikey",
    "authorization",
    "clientsecret",
    "cookie",
    "password",
    "passwordhash",
    "refreshtoken",
    "secret",
    "token",
}


class MigrationError(RuntimeError):
    """A migration precondition or integrity check failed."""


@dataclass(frozen=True)
class MigrationOptions:
    source_db: Path
    target_db: Path
    source_email: str
    target_email: str
    source_instance_id: str
    source_upload_root: Optional[Path] = None
    target_storage_root: Optional[Path] = None
    allow_missing_files: bool = False
    allow_identity_remap: bool = False


@dataclass(frozen=True)
class ArchivedRow:
    table: str
    source_record_id: str
    source_hash: str
    payload_hash: str
    payload: str
    redacted_fields: tuple[str, ...]
    source_case_id: Optional[int]


@dataclass(frozen=True)
class FilePlan:
    source_document_id: int
    source_path: Path
    storage_key: str
    target_path: Path
    sha256: str
    size: int


def _normalized_field(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def _is_sensitive_field(value: str) -> bool:
    normalized = _normalized_field(value)
    return normalized in SENSITIVE_FIELDS or normalized.endswith(("accesstoken", "refreshtoken", "clientsecret", "apikey"))


def _json_default(value: Any) -> Any:
    if isinstance(value, bytes):
        return {"encoding": "base64", "data": base64.b64encode(value).decode("ascii")}
    raise TypeError(f"Unsupported archive value: {type(value).__name__}")


def _canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":"), default=_json_default)


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _sha256_text(value: str) -> str:
    return _sha256_bytes(value.encode("utf-8"))


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _stable_id(prefix: str, *parts: object) -> str:
    digest = _sha256_text(":".join(str(part) for part in parts))[:32]
    return f"{prefix}_{digest}"


def _safe_identifier(value: str) -> str:
    if not IDENTIFIER_PATTERN.fullmatch(value):
        raise MigrationError(f"Unsafe SQLite identifier: {value!r}")
    return f'"{value}"'


def _row_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {key: row[key] for key in row.keys()}


def _redact(value: Any, path: str, redacted: list[str]) -> Any:
    if isinstance(value, dict):
        result: dict[str, Any] = {}
        for key, item in value.items():
            item_path = f"{path}.{key}" if path else str(key)
            if _is_sensitive_field(str(key)):
                result[str(key)] = "[REDACTED]"
                redacted.append(item_path)
            else:
                result[str(key)] = _redact(item, item_path, redacted)
        return result
    if isinstance(value, list):
        return [_redact(item, f"{path}[{index}]", redacted) for index, item in enumerate(value)]
    return value


def _redacted_row(row: dict[str, Any]) -> tuple[dict[str, Any], tuple[str, ...]]:
    redacted_fields: list[str] = []
    output: dict[str, Any] = {}
    for key, value in row.items():
        if _is_sensitive_field(key):
            output[key] = "[REDACTED]"
            redacted_fields.append(key)
            continue
        looks_like_json = isinstance(value, str) and value.lstrip().startswith(("{", "["))
        if isinstance(value, str) and (key.endswith("_json") or "metadata" in key.lower() or looks_like_json):
            try:
                parsed = json.loads(value)
            except (TypeError, ValueError):
                output[key] = value
            else:
                output[key] = _canonical_json(_redact(parsed, key, redacted_fields))
            continue
        output[key] = _redact(value, key, redacted_fields)
    return output, tuple(sorted(set(redacted_fields)))


def _connect_readonly(path: Path) -> sqlite3.Connection:
    resolved = path.expanduser().resolve(strict=True)
    connection = sqlite3.connect(f"file:{resolved.as_posix()}?mode=ro", uri=True, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only = ON")
    connection.execute("PRAGMA busy_timeout = 5000")
    return connection


def _connect_target(path: Path) -> sqlite3.Connection:
    resolved = path.expanduser().resolve(strict=True)
    connection = sqlite3.connect(resolved, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 5000")
    return connection


def _table_names(connection: sqlite3.Connection) -> list[str]:
    rows = connection.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").fetchall()
    return [str(row["name"]) for row in rows if not str(row["name"]).startswith(("sqlite_", "__"))]


def _columns(connection: sqlite3.Connection, table: str) -> list[str]:
    return [str(row["name"]) for row in connection.execute(f"PRAGMA table_info({_safe_identifier(table)})")]


def _require_tables(connection: sqlite3.Connection, names: Iterable[str], label: str) -> None:
    existing = set(_table_names(connection))
    missing = sorted(set(names) - existing)
    if missing:
        raise MigrationError(f"{label} database is missing required tables: {', '.join(missing)}")


def _one_user(connection: sqlite3.Connection, table: str, email_column: str, email: str) -> sqlite3.Row:
    rows = connection.execute(
        f"SELECT * FROM {_safe_identifier(table)} WHERE lower({_safe_identifier(email_column)}) = lower(?)",
        (email.strip(),),
    ).fetchall()
    if len(rows) != 1:
        raise MigrationError(f"Expected exactly one {table} row for {email!r}; found {len(rows)}")
    return rows[0]


def _placeholders(values: Iterable[object]) -> str:
    values = list(values)
    return ",".join("?" for _ in values)


def _owned_rows(
    source: sqlite3.Connection,
    source_user_id: int,
    case_ids: tuple[int, ...],
    document_ids: tuple[int, ...],
    outreach_ids: tuple[int, ...],
) -> tuple[list[ArchivedRow], list[str]]:
    archived: list[ArchivedRow] = []
    excluded: list[str] = []
    owned_cases = set(case_ids)
    owned_documents = set(document_ids)
    owned_outreach = set(outreach_ids)
    for table in _table_names(source):
        columns = _columns(source, table)
        sql = f"SELECT * FROM {_safe_identifier(table)}"
        has_owner_relation = (
            table == "ledger_users"
            or "user_id" in columns
            or "case_id" in columns
            or "document_id" in columns
            or "outreach_id" in columns
        )
        if not has_owner_relation:
            excluded.append(table)
            continue
        if "id" in columns:
            sql += " ORDER BY id"
        for source_row in source.execute(sql):
            original = _row_dict(source_row)
            owned = False
            if table == "ledger_users":
                owned = original.get("id") == source_user_id
            elif "user_id" in columns and original.get("user_id") is not None:
                owned = original.get("user_id") == source_user_id
            elif "case_id" in columns and original.get("case_id") in owned_cases:
                owned = True
            elif "document_id" in columns and original.get("document_id") in owned_documents:
                owned = True
            elif "outreach_id" in columns and original.get("outreach_id") in owned_outreach:
                owned = True
            if not owned:
                continue
            original_json = _canonical_json(original)
            redacted, redacted_fields = _redacted_row(original)
            payload = _canonical_json(redacted)
            source_record_id = str(original.get("id") or _sha256_text(original_json))
            source_case_id = original.get("case_id")
            archived.append(ArchivedRow(
                table=table,
                source_record_id=source_record_id,
                source_hash=_sha256_text(original_json),
                payload_hash=_sha256_text(payload),
                payload=payload,
                redacted_fields=redacted_fields,
                source_case_id=int(source_case_id) if source_case_id is not None else None,
            ))
    archived.sort(key=lambda item: (item.table, item.source_record_id))
    return archived, excluded


def _parse_datetime(value: Any, *, fallback_now: bool = True) -> Optional[int]:
    if value in (None, ""):
        return int(dt.datetime.now(dt.timezone.utc).timestamp() * 1000) if fallback_now else None
    text = str(value).strip().replace("Z", "+00:00")
    try:
        parsed = dt.datetime.fromisoformat(text)
    except ValueError:
        try:
            parsed = dt.datetime.strptime(text[:10], "%Y-%m-%d")
        except ValueError:
            return int(dt.datetime.now(dt.timezone.utc).timestamp() * 1000) if fallback_now else None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return int(parsed.timestamp() * 1000)


def _safe_filename(value: str) -> str:
    name = Path(str(value or "document").replace("\\", "/")).name
    cleaned = re.sub(r"[^A-Za-z0-9._ -]", "_", name).lstrip(".").strip()
    return cleaned[:180] or "document"


def _source_file_path(raw: str, root: Path) -> Path:
    value = str(raw or "").strip()
    if value.startswith("file:"):
        parsed = urlparse(value)
        value = unquote(parsed.path)
        if os.name == "nt" and re.match(r"^/[A-Za-z]:", value):
            value = value[1:]
    candidate = Path(value)
    if not candidate.is_absolute():
        candidate = root / candidate
    resolved_root = root.expanduser().resolve(strict=True)
    resolved = candidate.expanduser().resolve(strict=True)
    try:
        resolved.relative_to(resolved_root)
    except ValueError as error:
        raise MigrationError("A source document path escapes the configured Flask upload root") from error
    if not resolved.is_file():
        raise MigrationError("A source document path is not a regular file")
    return resolved


def _file_plans(
    documents: list[dict[str, Any]],
    source_instance_id: str,
    case_map: dict[int, str],
    options: MigrationOptions,
) -> tuple[list[FilePlan], list[dict[str, Any]]]:
    plans: list[FilePlan] = []
    issues: list[dict[str, Any]] = []
    for document in documents:
        raw_path = str(document.get("local_path") or "").strip()
        if not raw_path:
            continue
        document_id = int(document["id"])
        source_case_id = int(document["case_id"])
        if options.source_upload_root is None or options.target_storage_root is None:
            issues.append({"documentId": document_id, "reason": "storage_roots_required"})
            continue
        try:
            source_path = _source_file_path(raw_path, options.source_upload_root)
            body_hash = _sha256_file(source_path)
            expected = str(document.get("content_hash") or "").strip().lower()
            if HASH_PATTERN.fullmatch(expected) and expected != body_hash:
                raise MigrationError("The source document hash does not match its ledger provenance hash")
            filename = _safe_filename(str(document.get("original_filename") or source_path.name))
            evidence_id = _stable_id("flask_evidence", source_instance_id, document_id)
            storage_key = f"evidence/{case_map[source_case_id]}/flask-migration/{evidence_id}-{filename}"
            storage_root = options.target_storage_root.expanduser().resolve()
            target_path = (storage_root / Path(storage_key)).resolve()
            try:
                target_path.relative_to(storage_root)
            except ValueError as error:
                raise MigrationError("A generated target storage path escaped its configured root") from error
            plans.append(FilePlan(document_id, source_path, storage_key, target_path, body_hash, source_path.stat().st_size))
        except (MigrationError, FileNotFoundError, OSError) as error:
            issues.append({"documentId": document_id, "reason": str(error)})
    return plans, issues


def _select_dicts(connection: sqlite3.Connection, sql: str, params: Iterable[object] = ()) -> list[dict[str, Any]]:
    return [_row_dict(row) for row in connection.execute(sql, tuple(params)).fetchall()]


def _select_by_ids(
    connection: sqlite3.Connection,
    table: str,
    column: str,
    values: Iterable[int],
) -> list[dict[str, Any]]:
    ids = sorted(set(int(value) for value in values))
    if not ids or table not in _table_names(connection):
        return []
    rows: list[dict[str, Any]] = []
    for offset in range(0, len(ids), 500):
        chunk = ids[offset:offset + 500]
        rows.extend(_select_dicts(
            connection,
            f"SELECT * FROM {_safe_identifier(table)} WHERE {_safe_identifier(column)} "
            f"IN ({_placeholders(chunk)}) ORDER BY id",
            chunk,
        ))
    rows.sort(key=lambda item: int(item.get("id") or 0))
    return rows


def build_plan(options: MigrationOptions) -> dict[str, Any]:
    if not SOURCE_ID_PATTERN.fullmatch(options.source_instance_id):
        raise MigrationError("source_instance_id must use 1-80 letters, numbers, dots, underscores, or hyphens")
    if options.source_email.strip().lower() != options.target_email.strip().lower() and not options.allow_identity_remap:
        raise MigrationError(
            "Source and target owner emails differ; pass --allow-identity-remap only after reviewing that ownership mapping"
        )
    if options.source_db.expanduser().resolve() == options.target_db.expanduser().resolve():
        raise MigrationError("Source and target databases must be different files")

    with closing(_connect_readonly(options.source_db)) as source, closing(_connect_target(options.target_db)) as target:
        _require_tables(source, ["ledger_users", "legal_cases", "case_documents"], "Flask source")
        _require_tables(
            target,
            ["users", "cases", "evidence", "timeline", "deadlines", "legal_inferences",
             "suspicious_patterns", "expected_documents", "audit_logs", "legacy_import_runs",
             "legacy_import_records"],
            "Desktop target",
        )
        source_user = _one_user(source, "ledger_users", "email", options.source_email)
        target_user = _one_user(target, "users", "email", options.target_email)
        source_user_id = int(source_user["id"])
        target_user_id = str(target_user["id"])

        cases = _select_dicts(source, "SELECT * FROM legal_cases WHERE user_id = ? ORDER BY id", [source_user_id])
        case_ids = tuple(int(item["id"]) for item in cases)
        case_map = {
            source_id: _stable_id("flask_case", options.source_instance_id, source_id)
            for source_id in case_ids
        }
        documents = _select_by_ids(source, "case_documents", "case_id", case_ids)
        document_ids = tuple(int(item["id"]) for item in documents)
        outreach_rows = _select_by_ids(source, "lawyer_outreach", "case_id", case_ids)
        outreach_ids = tuple(int(item["id"]) for item in outreach_rows)
        archive, excluded = _owned_rows(source, source_user_id, case_ids, document_ids, outreach_ids)
        run_id = _stable_id("flask_import", options.source_instance_id, target_user_id)
        file_plans, file_issues = _file_plans(documents, options.source_instance_id, case_map, options)
        snapshot_material = {
            "rows": [(item.table, item.source_record_id, item.source_hash) for item in archive],
            "files": [(item.source_document_id, item.sha256, item.size) for item in file_plans],
            "unavailableFileDocumentIds": sorted(int(item["documentId"]) for item in file_issues),
        }
        snapshot_hash = _sha256_text(_canonical_json(snapshot_material))

        return {
            "runId": run_id,
            "sourceRuntime": SOURCE_RUNTIME,
            "sourceInstanceId": options.source_instance_id,
            "sourceUserId": str(source_user["external_user_id"]),
            "sourceUserEmail": str(source_user["email"] or ""),
            "targetUserId": target_user_id,
            "targetUserEmail": str(target_user["email"] or ""),
            "sourceSnapshotHash": snapshot_hash,
            "records": archive,
            "excludedTables": excluded,
            "cases": cases,
            "caseMap": case_map,
            "documents": documents,
            "filePlans": file_plans,
            "fileIssues": file_issues,
        }


def _case_status(value: Any) -> str:
    status = str(value or "").strip().lower()
    if status in {"closed", "archived"}:
        return "Closed"
    if status in {"pending", "new", "intake"}:
        return "Intake"
    if status == "outreach":
        return "Outreach"
    if status == "matched":
        return "Matched"
    return "Matching"


def _urgency(value: Any) -> str:
    priority = str(value or "").strip().lower()
    if priority in {"critical", "urgent", "high"}:
        return "High"
    if priority == "low":
        return "Low"
    return "Medium"


def _verify_insert_owner(target: sqlite3.Connection, table: str, record_id: str, user_id: str) -> None:
    row = target.execute(
        f"SELECT userId FROM {_safe_identifier(table)} WHERE id = ?",
        (record_id,),
    ).fetchone()
    if not row or str(row["userId"]) != user_id:
        raise MigrationError(f"Deterministic {table} id collides with data owned by another account")


def _copy_files(plans: list[FilePlan]) -> tuple[list[Path], int]:
    created: list[Path] = []
    copied = 0
    for plan in plans:
        plan.target_path.parent.mkdir(parents=True, exist_ok=True)
        if plan.target_path.exists():
            if not plan.target_path.is_file() or _sha256_file(plan.target_path) != plan.sha256:
                raise MigrationError("A target evidence path exists with different bytes")
            continue
        temporary = plan.target_path.with_name(f".{plan.target_path.name}.migrating")
        if temporary.exists():
            raise MigrationError("A stale migration temporary file blocks evidence import")
        shutil.copyfile(plan.source_path, temporary)
        if _sha256_file(temporary) != plan.sha256:
            temporary.unlink(missing_ok=True)
            raise MigrationError("Copied evidence failed its SHA-256 verification")
        os.replace(temporary, plan.target_path)
        created.append(plan.target_path)
        copied += 1
    return created, copied


def _backup_target(target: sqlite3.Connection, target_path: Path, run_id: str) -> Path:
    timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup_path = target_path.with_name(f"{target_path.stem}.pre-{run_id[:20]}-{timestamp}{target_path.suffix}")
    with closing(sqlite3.connect(backup_path)) as backup:
        target.backup(backup)
    with closing(sqlite3.connect(f"file:{backup_path.resolve().as_posix()}?mode=ro", uri=True)) as check:
        result = check.execute("PRAGMA integrity_check").fetchone()
        if not result or result[0] != "ok":
            backup_path.unlink(missing_ok=True)
            raise MigrationError("The automatic pre-migration database backup failed integrity validation")
    return backup_path


def apply_migration(options: MigrationOptions) -> dict[str, Any]:
    plan = build_plan(options)
    if plan["fileIssues"] and not options.allow_missing_files:
        raise MigrationError(
            f"{len(plan['fileIssues'])} source document file(s) cannot be migrated; "
            "fix the storage roots/files or pass --allow-missing-files explicitly"
        )

    target_path = options.target_db.expanduser().resolve(strict=True)
    created_files: list[Path] = []
    with closing(_connect_readonly(options.source_db)) as source, closing(_connect_target(target_path)) as target:
        existing = target.execute(
            "SELECT sourceSnapshotHash FROM legacy_import_runs WHERE id = ? AND userId = ?",
            (plan["runId"], plan["targetUserId"]),
        ).fetchone()
        if existing:
            if str(existing["sourceSnapshotHash"]) != plan["sourceSnapshotHash"]:
                raise MigrationError(
                    "The Flask source changed after this source_instance_id was imported; "
                    "stop Flask and use a new reviewed source_instance_id"
                )
            return {
                "status": "already_imported",
                "runId": plan["runId"],
                "sourceSnapshotHash": plan["sourceSnapshotHash"],
            }

        backup_path = _backup_target(target, target_path, plan["runId"])
        try:
            created_files, _ = _copy_files(plan["filePlans"])
            now = int(dt.datetime.now(dt.timezone.utc).timestamp() * 1000)
            file_by_document = {item.source_document_id: item for item in plan["filePlans"]}
            document_map = {
                int(document["id"]): _stable_id("flask_evidence", plan["sourceInstanceId"], document["id"])
                for document in plan["documents"]
            }
            target.execute("BEGIN IMMEDIATE")
            target.execute(
                """INSERT INTO legacy_import_runs
                   (id, sourceRuntime, sourceInstanceId, userId, sourceUserId, sourceUserEmail,
                    status, sourceSnapshotHash, recordsImported, casesImported, filesCopied,
                    missingFiles, summary, startedAt, completedAt)
                   VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    plan["runId"], SOURCE_RUNTIME, plan["sourceInstanceId"], plan["targetUserId"],
                    plan["sourceUserId"], plan["sourceUserEmail"], plan["sourceSnapshotHash"],
                    len(plan["records"]), len(plan["cases"]), len(plan["filePlans"]), len(plan["fileIssues"]),
                    _canonical_json({
                        "excludedGlobalTables": plan["excludedTables"],
                        "fileIssues": plan["fileIssues"],
                        "operationalMappings": ["cases", "case_documents", "case_events", "deadlines",
                                                "legal_claims", "contradictions", "missing_evidence_warnings"],
                    }),
                    now, now,
                ),
            )

            for item in plan["cases"]:
                source_case_id = int(item["id"])
                target_case_id = plan["caseMap"][source_case_id]
                metadata = _canonical_json({
                    "legacyImport": {
                        "runId": plan["runId"],
                        "sourceRuntime": SOURCE_RUNTIME,
                        "sourceInstanceId": plan["sourceInstanceId"],
                        "sourceCaseId": source_case_id,
                    },
                    "desiredOutcome": item.get("desired_outcome") or "",
                    "opposingParties": item.get("opposing_parties") or "[]",
                    "courtOrInstitution": item.get("court_or_institution") or "",
                    "riskLevel": item.get("risk_level") or "medium",
                })
                target.execute(
                    """INSERT OR IGNORE INTO cases
                       (id, userId, clientName, clientEmail, caseType, caseSummary, urgency, status,
                        legalAreas, metadata, createdAt, updatedAt)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        target_case_id, plan["targetUserId"], item.get("title") or f"Flask case {source_case_id}",
                        plan["targetUserEmail"], item.get("legal_domain") or "unknown",
                        item.get("current_summary") or item.get("description") or "",
                        _urgency(item.get("priority")), _case_status(item.get("status")),
                        _canonical_json([item.get("legal_domain")]) if item.get("legal_domain") else "[]",
                        metadata, _parse_datetime(item.get("created_at")), _parse_datetime(item.get("updated_at")),
                    ),
                )
                _verify_insert_owner(target, "cases", target_case_id, plan["targetUserId"])

            for document in plan["documents"]:
                source_document_id = int(document["id"])
                target_case_id = plan["caseMap"][int(document["case_id"])]
                evidence_id = _stable_id("flask_evidence", plan["sourceInstanceId"], source_document_id)
                file_plan = file_by_document.get(source_document_id)
                filename = _safe_filename(str(document.get("original_filename") or document.get("title") or "document"))
                metadata = {
                    "legacyImport": {
                        "runId": plan["runId"],
                        "sourceInstanceId": plan["sourceInstanceId"],
                        "sourceDocumentId": source_document_id,
                    },
                    "sourceUri": document.get("source_uri") or "",
                    "sourceContentHash": document.get("content_hash") or "",
                    "dateOnDocument": document.get("date_on_document") or "",
                    "sender": document.get("sender") or "",
                    "recipient": document.get("recipient") or "",
                    "confidentialityLevel": document.get("confidentiality_level") or "normal",
                    "contentHash": file_plan.sha256 if file_plan else document.get("content_hash") or None,
                    "fileMigrationStatus": "copied" if file_plan else ("unavailable" if document.get("local_path") else "not_applicable"),
                }
                if file_plan:
                    metadata["storageKey"] = file_plan.storage_key
                target.execute(
                    """INSERT OR IGNORE INTO evidence
                       (id, caseId, userId, type, source, title, description, fileUrl, fileName,
                        fileSize, mimeType, metadata, relevant, createdAt, updatedAt)
                       VALUES (?, ?, ?, 'document', 'flask-ledger', ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)""",
                    (
                        evidence_id, target_case_id, plan["targetUserId"],
                        document.get("title") or filename, document.get("summary") or "",
                        file_plan.target_path.as_uri() if file_plan else None, filename,
                        str(file_plan.size) if file_plan else None,
                        mimetypes.guess_type(filename)[0] or "application/octet-stream",
                        _canonical_json(metadata), _parse_datetime(document.get("created_at")),
                        _parse_datetime(document.get("updated_at")),
                    ),
                )
                _verify_insert_owner(target, "evidence", evidence_id, plan["targetUserId"])

            operational = [
                ("case_events", "timeline", "flask_event", "eventAt", "event_date"),
                ("deadlines", "deadlines", "flask_deadline", "dueDate", "due_date"),
            ]
            for source_table, target_table, prefix, date_column, source_date in operational:
                if source_table not in _table_names(source) or not plan["caseMap"]:
                    continue
                rows = _select_by_ids(source, source_table, "case_id", plan["caseMap"].keys())
                for row in rows:
                    target_id = _stable_id(prefix, plan["sourceInstanceId"], row["id"])
                    target_case_id = plan["caseMap"][int(row["case_id"])]
                    if target_table == "timeline":
                        source_document_id = row.get("created_from_document_id")
                        evidence_id = document_map.get(int(source_document_id)) if source_document_id is not None else None
                        timeline_metadata = {
                            "legacyImport": {
                                "runId": plan["runId"],
                                "sourceInstanceId": plan["sourceInstanceId"],
                                "sourceEventId": row["id"],
                            },
                            "legacySource": row,
                        }
                        if evidence_id:
                            timeline_metadata["evidenceId"] = evidence_id
                        target.execute(
                            """INSERT OR IGNORE INTO timeline
                               (id, caseId, userId, eventType, title, description, eventAt, metadata, createdAt)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                            (target_id, target_case_id, plan["targetUserId"], row.get("event_type") or "event",
                             row.get("title") or "Imported event", row.get("description") or "",
                             _parse_datetime(row.get(source_date), fallback_now=False), _canonical_json(timeline_metadata),
                             _parse_datetime(row.get("created_at"))),
                        )
                    else:
                        target.execute(
                            """INSERT OR IGNORE INTO deadlines
                               (id, caseId, userId, title, description, dueDate, completed, createdAt, updatedAt)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                            (target_id, target_case_id, plan["targetUserId"], row.get("title") or "Imported deadline",
                             row.get("description") or "", _parse_datetime(row.get(source_date), fallback_now=False),
                             1 if str(row.get("status") or "").lower() in {"done", "closed", "completed"} else 0,
                             _parse_datetime(row.get("created_at")), _parse_datetime(row.get("updated_at"))),
                        )
                    _verify_insert_owner(target, target_table, target_id, plan["targetUserId"])

            derived_mappings = [
                ("legal_claims", "legal_inferences", "flask_claim"),
                ("contradictions", "suspicious_patterns", "flask_contradiction"),
                ("missing_evidence_warnings", "expected_documents", "flask_missing"),
            ]
            for source_table, target_table, prefix in derived_mappings:
                if source_table not in _table_names(source) or not plan["caseMap"]:
                    continue
                rows = _select_by_ids(source, source_table, "case_id", plan["caseMap"].keys())
                for row in rows:
                    target.execute(
                        f"INSERT OR IGNORE INTO {_safe_identifier(target_table)} (id, caseId, data, createdAt) VALUES (?, ?, ?, ?)",
                        (_stable_id(prefix, plan["sourceInstanceId"], row["id"]),
                         plan["caseMap"][int(row["case_id"])],
                         _canonical_json({"legacyImport": {"runId": plan["runId"], "sourceTable": source_table}, "record": row}),
                         _parse_datetime(row.get("created_at"))),
                    )

            for record in plan["records"]:
                mapped_case_id = plan["caseMap"].get(record.source_case_id) if record.source_case_id is not None else None
                target.execute(
                    """INSERT INTO legacy_import_records
                       (id, runId, userId, caseId, sourceRuntime, sourceInstanceId, sourceTable,
                        sourceRecordId, sourceHash, payloadHash, redactedFields, payload, importedAt)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        _stable_id("flask_record", plan["sourceInstanceId"], record.table, record.source_record_id,
                                   plan["targetUserId"]),
                        plan["runId"], plan["targetUserId"], mapped_case_id, SOURCE_RUNTIME,
                        plan["sourceInstanceId"], record.table, record.source_record_id,
                        record.source_hash, record.payload_hash, _canonical_json(record.redacted_fields),
                        record.payload, now,
                    ),
                )

            target.execute(
                """INSERT INTO audit_logs
                   (id, userId, action, resource, entityType, entityId, details, metadata, createdAt)
                   VALUES (?, ?, 'migration.flask.completed', 'legacy_import', 'legacy_import_run', ?, ?, ?, ?)""",
                (_stable_id("audit", plan["runId"]), plan["targetUserId"], plan["runId"],
                 f"Imported {len(plan['cases'])} Flask case(s) and {len(plan['records'])} archived record(s)",
                 _canonical_json({"sourceInstanceId": plan["sourceInstanceId"],
                                  "sourceSnapshotHash": plan["sourceSnapshotHash"]}), now),
            )
            target.commit()
        except Exception:
            target.rollback()
            for path in reversed(created_files):
                path.unlink(missing_ok=True)
            raise

    return {
        "status": "completed",
        "runId": plan["runId"],
        "sourceSnapshotHash": plan["sourceSnapshotHash"],
        "recordsImported": len(plan["records"]),
        "casesImported": len(plan["cases"]),
        "filesCopied": len(plan["filePlans"]),
        "missingFiles": len(plan["fileIssues"]),
        "backupPath": str(backup_path),
    }


def public_plan(plan: dict[str, Any]) -> dict[str, Any]:
    """Return a JSON-safe plan without source document contents or local paths."""
    return {
        "status": "ready" if not plan["fileIssues"] else "attention_required",
        "runId": plan["runId"],
        "sourceRuntime": plan["sourceRuntime"],
        "sourceInstanceId": plan["sourceInstanceId"],
        "sourceUserEmail": plan["sourceUserEmail"],
        "targetUserEmail": plan["targetUserEmail"],
        "sourceSnapshotHash": plan["sourceSnapshotHash"],
        "recordsToArchive": len(plan["records"]),
        "casesToImport": len(plan["cases"]),
        "filesToCopy": len(plan["filePlans"]),
        "fileIssues": plan["fileIssues"],
        "excludedGlobalTables": plan["excludedTables"],
    }


def _arguments(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Migrate one Flask ledger owner into LARO Desktop")
    parser.add_argument("--source-db", required=True, type=Path)
    parser.add_argument("--target-db", required=True, type=Path)
    parser.add_argument("--source-email", required=True)
    parser.add_argument("--target-email", required=True)
    parser.add_argument("--source-id", required=True, dest="source_instance_id")
    parser.add_argument("--source-upload-root", type=Path)
    parser.add_argument("--target-storage-root", type=Path)
    parser.add_argument("--allow-missing-files", action="store_true")
    parser.add_argument("--allow-identity-remap", action="store_true")
    parser.add_argument("--apply", action="store_true", help="Apply after a successful dry-run; default is read-only")
    return parser.parse_args(argv)


def main(argv: Optional[list[str]] = None) -> int:
    args = _arguments(argv)
    options = MigrationOptions(
        source_db=args.source_db,
        target_db=args.target_db,
        source_email=args.source_email,
        target_email=args.target_email,
        source_instance_id=args.source_instance_id,
        source_upload_root=args.source_upload_root,
        target_storage_root=args.target_storage_root,
        allow_missing_files=args.allow_missing_files,
        allow_identity_remap=args.allow_identity_remap,
    )
    try:
        result = apply_migration(options) if args.apply else public_plan(build_plan(options))
    except (MigrationError, FileNotFoundError, sqlite3.Error) as error:
        print(json.dumps({"status": "failed", "error": str(error)}, ensure_ascii=True), file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=True, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
