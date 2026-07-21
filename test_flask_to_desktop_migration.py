import hashlib
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from scripts.migrate_flask_ledger import (
    MigrationError,
    MigrationOptions,
    apply_migration,
    build_plan,
    public_plan,
)


SOURCE_SCHEMA = """
CREATE TABLE ledger_users (
    id INTEGER PRIMARY KEY, external_user_id TEXT NOT NULL UNIQUE, email TEXT, display_name TEXT,
    created_at TEXT, updated_at TEXT
);
CREATE TABLE legal_cases (
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT,
    legal_domain TEXT, status TEXT, priority TEXT, desired_outcome TEXT, current_summary TEXT,
    opposing_parties TEXT, court_or_institution TEXT, risk_level TEXT, created_at TEXT, updated_at TEXT
);
CREATE TABLE case_documents (
    id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL, source_type TEXT, source_uri TEXT,
    original_filename TEXT, local_path TEXT, content_hash TEXT, document_type TEXT,
    date_on_document TEXT, sender TEXT, recipient TEXT, title TEXT, ocr_text TEXT,
    extracted_text TEXT, summary TEXT, relevance_score REAL, confidentiality_level TEXT,
    metadata_json TEXT, created_at TEXT, updated_at TEXT
);
CREATE TABLE document_versions (
    id INTEGER PRIMARY KEY, document_id INTEGER NOT NULL, version_label TEXT, extraction_method TEXT,
    text_hash TEXT, extracted_text TEXT, metadata_json TEXT, created_at TEXT
);
CREATE TABLE case_events (
    id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL, event_date TEXT, event_type TEXT,
    title TEXT, description TEXT, created_from_document_id INTEGER, created_at TEXT, updated_at TEXT
);
CREATE TABLE deadlines (
    id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL, due_date TEXT, title TEXT,
    description TEXT, status TEXT, created_at TEXT, updated_at TEXT
);
CREATE TABLE legal_claims (
    id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL, statement TEXT, status TEXT, created_at TEXT
);
CREATE TABLE contradictions (
    id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL, title TEXT, description TEXT, created_at TEXT
);
CREATE TABLE missing_evidence_warnings (
    id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL, title TEXT, description TEXT, created_at TEXT
);
CREATE TABLE audit_events (
    id INTEGER PRIMARY KEY, user_id INTEGER, case_id INTEGER, action TEXT, after_state TEXT, created_at TEXT
);
CREATE TABLE external_connections (
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, provider TEXT, metadata_json TEXT, created_at TEXT
);
CREATE TABLE lawyer_outreach (
    id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL, lawyer_name TEXT, status TEXT, created_at TEXT
);
CREATE TABLE lawyer_responses (
    id INTEGER PRIMARY KEY, outreach_id INTEGER NOT NULL, content TEXT, created_at TEXT
);
CREATE TABLE outreach_directory_targets (
    id INTEGER PRIMARY KEY, name TEXT, source_url TEXT
);
"""


TARGET_SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE);
CREATE TABLE cases (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, clientName TEXT, clientEmail TEXT, caseType TEXT,
    caseSummary TEXT, urgency TEXT, status TEXT, legalAreas TEXT, metadata TEXT,
    createdAt INTEGER, updatedAt INTEGER
);
CREATE TABLE evidence (
    id TEXT PRIMARY KEY, caseId TEXT NOT NULL, userId TEXT NOT NULL, type TEXT, source TEXT,
    title TEXT, description TEXT, fileUrl TEXT, fileName TEXT, fileSize TEXT, mimeType TEXT,
    metadata TEXT, relevant INTEGER, createdAt INTEGER, updatedAt INTEGER
);
CREATE TABLE timeline (
    id TEXT PRIMARY KEY, caseId TEXT, userId TEXT, eventType TEXT, title TEXT,
    description TEXT, eventAt INTEGER, metadata TEXT, createdAt INTEGER
);
CREATE TABLE deadlines (
    id TEXT PRIMARY KEY, caseId TEXT, userId TEXT, title TEXT, description TEXT,
    dueDate INTEGER, completed INTEGER, createdAt INTEGER, updatedAt INTEGER
);
CREATE TABLE legal_inferences (id TEXT PRIMARY KEY, caseId TEXT, data TEXT, createdAt INTEGER);
CREATE TABLE suspicious_patterns (id TEXT PRIMARY KEY, caseId TEXT, data TEXT, createdAt INTEGER);
CREATE TABLE expected_documents (id TEXT PRIMARY KEY, caseId TEXT, data TEXT, createdAt INTEGER);
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY, userId TEXT, action TEXT, resource TEXT, entityType TEXT,
    entityId TEXT, details TEXT, metadata TEXT, createdAt INTEGER
);
CREATE TABLE legacy_import_runs (
    id TEXT PRIMARY KEY, sourceRuntime TEXT NOT NULL, sourceInstanceId TEXT NOT NULL,
    userId TEXT NOT NULL, sourceUserId TEXT NOT NULL, sourceUserEmail TEXT, status TEXT NOT NULL,
    sourceSnapshotHash TEXT NOT NULL, recordsImported INTEGER NOT NULL, casesImported INTEGER NOT NULL,
    filesCopied INTEGER NOT NULL, missingFiles INTEGER NOT NULL, summary TEXT NOT NULL,
    startedAt INTEGER NOT NULL, completedAt INTEGER,
    UNIQUE(sourceRuntime, sourceInstanceId, userId)
);
CREATE TABLE legacy_import_records (
    id TEXT PRIMARY KEY, runId TEXT NOT NULL, userId TEXT NOT NULL, caseId TEXT,
    sourceRuntime TEXT NOT NULL, sourceInstanceId TEXT NOT NULL, sourceTable TEXT NOT NULL,
    sourceRecordId TEXT NOT NULL, sourceHash TEXT NOT NULL, payloadHash TEXT NOT NULL,
    redactedFields TEXT NOT NULL, payload TEXT NOT NULL, importedAt INTEGER NOT NULL,
    UNIQUE(sourceRuntime, sourceInstanceId, sourceTable, sourceRecordId, userId)
);
"""


class FlaskToDesktopMigrationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="laro-flask-migration-")
        self.root = Path(self.temp.name)
        self.source_db = self.root / "source.sqlite3"
        self.target_db = self.root / "target.sqlite"
        self.source_uploads = self.root / "source-uploads"
        self.target_storage = self.root / "target-storage"
        self.source_uploads.mkdir()
        self.target_storage.mkdir()
        self.document = self.source_uploads / "notice.txt"
        self.document.write_bytes(b"Source-linked evidence bytes")
        content_hash = hashlib.sha256(self.document.read_bytes()).hexdigest()

        with closing(sqlite3.connect(self.source_db)) as source:
            source.executescript(SOURCE_SCHEMA)
            source.executemany(
                "INSERT INTO ledger_users VALUES (?, ?, ?, ?, ?, ?)",
                [
                    (1, "flask-owner", "owner@example.test", "Owner", "2026-01-01", "2026-01-01"),
                    (2, "flask-other", "other@example.test", "Other", "2026-01-01", "2026-01-01"),
                ],
            )
            source.executemany(
                "INSERT INTO legal_cases VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    (10, 1, "Benefits dispute", "Original description", "Social Security Law", "pending", "high",
                     "Restore benefit", "Current owner summary", "[]", "UWV", "high", "2026-02-01", "2026-02-02"),
                    (20, 2, "Other private case", "Must not migrate", "Family Law", "pending", "low",
                     "", "", "[]", "", "low", "2026-02-01", "2026-02-02"),
                ],
            )
            source.executemany(
                """INSERT INTO case_documents
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [
                    (100, 10, "manual", "", "notice.txt", str(self.document), content_hash, "letter",
                     "2026-02-03", "UWV", "Owner", "Decision notice", "", "Decision text", "Adverse decision",
                     0.9, "normal", "{}", "2026-02-03", "2026-02-03"),
                    (200, 20, "manual", "", "other.txt", "", "", "letter", "", "", "", "Other document",
                     "", "", "", 0.2, "normal", "{}", "2026-02-03", "2026-02-03"),
                ],
            )
            source.execute(
                "INSERT INTO document_versions VALUES (101, 100, 'initial', 'manual', ?, 'Decision text', '{}', '2026-02-03')",
                (hashlib.sha256(b"Decision text").hexdigest(),),
            )
            source.execute("INSERT INTO case_events VALUES (300, 10, '2026-02-03', 'decision', 'UWV decision', 'Benefit denied', 100, '2026-02-03', '2026-02-03')")
            source.execute("INSERT INTO deadlines VALUES (400, 10, '2026-03-01', 'File objection', 'Six-week deadline', 'open', '2026-02-03', '2026-02-03')")
            source.execute("INSERT INTO legal_claims VALUES (500, 10, 'Decision lacks reasons', 'unreviewed', '2026-02-03')")
            source.execute("INSERT INTO contradictions VALUES (600, 10, 'Conflicting dates', 'Two dates differ', '2026-02-03')")
            source.execute("INSERT INTO missing_evidence_warnings VALUES (700, 10, 'Missing call log', 'Obtain provider log', '2026-02-03')")
            source.execute(
                "INSERT INTO audit_events VALUES (800, 1, 10, 'created', ?, '2026-02-03')",
                (json.dumps({"api_key": "audit-secret", "result": "created"}),),
            )
            source.execute(
                "INSERT INTO audit_events VALUES (801, 2, 10, 'conflicting-owner', '{}', '2026-02-03')"
            )
            source.execute(
                "INSERT INTO external_connections VALUES (900, 1, 'google', ?, '2026-02-03')",
                (json.dumps({"access_token": "must-not-migrate", "label": "Google"}),),
            )
            source.execute("INSERT INTO lawyer_outreach VALUES (1000, 10, 'Counsel', 'draft', '2026-02-03')")
            source.execute("INSERT INTO lawyer_responses VALUES (1001, 1000, 'Private response', '2026-02-04')")
            source.execute("INSERT INTO outreach_directory_targets VALUES (1100, 'Global target', 'https://example.test')")
            source.commit()

        with closing(sqlite3.connect(self.target_db)) as target:
            target.executescript(TARGET_SCHEMA)
            target.executemany(
                "INSERT INTO users VALUES (?, ?)",
                [("desktop-owner", "owner@example.test"), ("desktop-other", "other@example.test")],
            )
            target.commit()

        self.options = MigrationOptions(
            source_db=self.source_db,
            target_db=self.target_db,
            source_email="owner@example.test",
            target_email="owner@example.test",
            source_instance_id="workspace-a",
            source_upload_root=self.source_uploads,
            target_storage_root=self.target_storage,
        )

    def tearDown(self):
        self.temp.cleanup()

    def test_dry_run_and_apply_are_owner_bound_loss_aware_and_idempotent(self):
        dry_run = public_plan(build_plan(self.options))
        self.assertEqual("ready", dry_run["status"])
        self.assertEqual(1, dry_run["casesToImport"])
        self.assertEqual(1, dry_run["filesToCopy"])
        self.assertIn("outreach_directory_targets", dry_run["excludedGlobalTables"])

        with closing(sqlite3.connect(self.target_db)) as target:
            self.assertEqual(0, target.execute("SELECT count(*) FROM legacy_import_runs").fetchone()[0])

        result = apply_migration(self.options)
        self.assertEqual("completed", result["status"])
        self.assertEqual(1, result["casesImported"])
        self.assertEqual(1, result["filesCopied"])
        self.assertTrue(Path(result["backupPath"]).is_file())

        with closing(sqlite3.connect(self.target_db)) as target:
            target.row_factory = sqlite3.Row
            case = target.execute("SELECT * FROM cases").fetchone()
            self.assertEqual("desktop-owner", case["userId"])
            self.assertEqual("Benefits dispute", case["clientName"])
            self.assertEqual("Intake", case["status"])
            timeline = target.execute("SELECT metadata FROM timeline").fetchone()
            self.assertIsNotNone(json.loads(timeline["metadata"])["evidenceId"])
            self.assertEqual(
                0,
                target.execute(
                    "SELECT count(*) FROM legacy_import_records WHERE sourceTable = 'audit_events' AND sourceRecordId = '801'"
                ).fetchone()[0],
            )
            self.assertEqual(1, target.execute("SELECT count(*) FROM deadlines").fetchone()[0])
            self.assertEqual(1, target.execute("SELECT count(*) FROM legal_inferences").fetchone()[0])
            self.assertEqual(1, target.execute("SELECT count(*) FROM suspicious_patterns").fetchone()[0])
            self.assertEqual(1, target.execute("SELECT count(*) FROM expected_documents").fetchone()[0])
            self.assertEqual(0, target.execute("SELECT count(*) FROM cases WHERE clientName = 'Other private case'").fetchone()[0])
            connection_archive = target.execute(
                "SELECT payload, redactedFields FROM legacy_import_records WHERE sourceTable = 'external_connections'"
            ).fetchone()
            self.assertNotIn("must-not-migrate", connection_archive["payload"])
            self.assertIn("REDACTED", connection_archive["payload"])
            self.assertIn("metadata_json.access_token", connection_archive["redactedFields"])
            audit_archive = target.execute(
                "SELECT payload FROM legacy_import_records WHERE sourceTable = 'audit_events'"
            ).fetchone()
            self.assertNotIn("audit-secret", audit_archive["payload"])
            self.assertIn("REDACTED", audit_archive["payload"])
            evidence = target.execute("SELECT metadata FROM evidence").fetchone()
            storage_key = json.loads(evidence["metadata"])["storageKey"]
            copied = self.target_storage / storage_key
            self.assertEqual(self.document.read_bytes(), copied.read_bytes())

        repeated = apply_migration(self.options)
        self.assertEqual("already_imported", repeated["status"])

        with closing(sqlite3.connect(self.source_db)) as source:
            source.execute("UPDATE legal_cases SET current_summary = 'Changed after migration' WHERE id = 10")
            source.commit()
        with self.assertRaisesRegex(MigrationError, "source changed"):
            apply_migration(self.options)

    def test_apply_blocks_uncontained_or_missing_source_files_by_default(self):
        outside = self.root / "outside.txt"
        outside.write_text("outside", encoding="utf-8")
        with closing(sqlite3.connect(self.source_db)) as source:
            source.execute("UPDATE case_documents SET local_path = ? WHERE id = 100", (str(outside),))
            source.commit()
        plan = public_plan(build_plan(self.options))
        self.assertEqual("attention_required", plan["status"])
        self.assertEqual(1, len(plan["fileIssues"]))
        with self.assertRaisesRegex(MigrationError, "cannot be migrated"):
            apply_migration(self.options)

    def test_target_identity_must_exist_exactly_once(self):
        invalid = MigrationOptions(**{
            **self.options.__dict__,
            "target_email": "absent@example.test",
            "allow_identity_remap": True,
        })
        with self.assertRaisesRegex(MigrationError, "Expected exactly one users row"):
            build_plan(invalid)

    def test_identity_remapping_requires_explicit_approval(self):
        remap = MigrationOptions(**{**self.options.__dict__, "target_email": "other@example.test"})
        with self.assertRaisesRegex(MigrationError, "owner emails differ"):
            build_plan(remap)
        approved = MigrationOptions(**{**remap.__dict__, "allow_identity_remap": True})
        self.assertEqual("desktop-other", build_plan(approved)["targetUserId"])

    def test_large_case_sets_are_chunked_without_sqlite_parameter_overflow(self):
        with closing(sqlite3.connect(self.source_db)) as source:
            source.executemany(
                """INSERT INTO legal_cases
                   (id, user_id, title, description, legal_domain, status, priority, created_at, updated_at)
                   VALUES (?, 1, ?, '', 'Employment Law', 'pending', 'normal', '2026-02-01', '2026-02-01')""",
                [(case_id, f"Bulk case {case_id}") for case_id in range(10000, 10600)],
            )
            source.commit()
        plan = build_plan(self.options)
        self.assertEqual(601, len(plan["cases"]))
        self.assertEqual(601, len(plan["caseMap"]))

    def test_empty_owner_does_not_mislabel_case_tables_as_global(self):
        with closing(sqlite3.connect(self.source_db)) as source:
            source.execute(
                "INSERT INTO ledger_users VALUES (3, 'flask-empty', 'empty@example.test', 'Empty', '2026-01-01', '2026-01-01')"
            )
            source.commit()
        with closing(sqlite3.connect(self.target_db)) as target:
            target.execute("INSERT INTO users VALUES ('desktop-empty', 'empty@example.test')")
            target.commit()
        empty_options = MigrationOptions(**{
            **self.options.__dict__,
            "source_email": "empty@example.test",
            "target_email": "empty@example.test",
            "source_instance_id": "workspace-empty",
        })
        plan = public_plan(build_plan(empty_options))
        self.assertEqual(0, plan["casesToImport"])
        self.assertIn("outreach_directory_targets", plan["excludedGlobalTables"])
        self.assertNotIn("case_events", plan["excludedGlobalTables"])

    def test_unknown_legal_dates_remain_unknown(self):
        with closing(sqlite3.connect(self.source_db)) as source:
            source.execute("UPDATE case_events SET event_date = 'not-a-date' WHERE id = 300")
            source.execute("UPDATE deadlines SET due_date = NULL WHERE id = 400")
            source.commit()
        apply_migration(self.options)
        with closing(sqlite3.connect(self.target_db)) as target:
            self.assertIsNone(target.execute("SELECT eventAt FROM timeline WHERE id LIKE 'flask_event_%'").fetchone()[0])
            self.assertIsNone(target.execute("SELECT dueDate FROM deadlines WHERE id LIKE 'flask_deadline_%'").fetchone()[0])


if __name__ == "__main__":
    unittest.main()
