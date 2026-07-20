#!/usr/bin/env python3
"""Operator CLI for Flask command-center recovery sets."""

from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from flask_recovery import (  # noqa: E402
    RecoveryError,
    config_from_environment,
    create_backup_set,
    load_dotenv,
    restore_backup_set,
    validate_backup_set,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Back up, validate, or restore the Flask command-center runtime")
    subparsers = parser.add_subparsers(dest="command", required=True)

    def common(command: argparse.ArgumentParser) -> None:
        command.add_argument("--ledger-db", help="Override LARO_LEDGER_DATABASE_URL")
        command.add_argument("--auth-db", help="Override LARO_AUTH_DATABASE_PATH")
        command.add_argument("--uploads", help="Override LARO_UPLOAD_ROOT")
        command.add_argument("--tokens", help="Override LARO_TOKEN_STORE_DIR")
        command.add_argument(
            "--allow-session-reset",
            action="store_true",
            help="Accept invalidation of Flask browser sessions when no matching SECRET_KEY is available",
        )

    backup = subparsers.add_parser("backup", help="Create a complete recovery set")
    backup.add_argument("destination", nargs="?", help="New recovery-set directory")
    common(backup)

    validate = subparsers.add_parser("validate", help="Validate every recovery-set member")
    validate.add_argument("recovery_set", help="Recovery-set directory")
    common(validate)

    restore = subparsers.add_parser("restore", help="Restore a verified recovery set")
    restore.add_argument("recovery_set", help="Recovery-set directory")
    restore.add_argument(
        "--confirm-stopped",
        action="store_true",
        help="Confirm that the Flask command-center runtime and workers are stopped",
    )
    common(restore)
    return parser


def _config(args: argparse.Namespace):
    return config_from_environment(
        root=ROOT,
        ledger_database=args.ledger_db,
        auth_database=args.auth_db,
        upload_root=args.uploads,
        token_root=args.tokens,
    )


def main(argv=None) -> int:
    load_dotenv(ROOT / ".env")
    args = _parser().parse_args(argv)
    config = _config(args)
    if args.command == "backup":
        destination = Path(args.destination) if args.destination else (
            ROOT
            / "flask-backups"
            / f"laro-flask-{dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
        )
        manifest = create_backup_set(destination, config, allow_session_reset=args.allow_session_reset)
        print(f"[Flask backup] Recovery set: {destination.resolve()}")
        print(f"[Flask backup] Ledger bytes: {manifest['databases']['ledger']['bytes']}")
        print(f"[Flask backup] Auth bytes: {manifest['databases']['auth']['bytes']}")
        print(f"[Flask backup] Upload files: {manifest['storage']['uploads']['file_count']}")
        print(f"[Flask backup] Token-vault files: {manifest['storage']['tokens']['file_count']}")
        return 0
    if args.command == "validate":
        manifest = validate_backup_set(
            Path(args.recovery_set),
            config,
            allow_session_reset=args.allow_session_reset,
        )
        print(
            "[Flask validate] Complete recovery set: "
            f"{len(manifest['databases']['ledger']['tables'])} ledger tables, "
            f"{manifest['storage']['uploads']['file_count']} uploads, "
            f"{manifest['storage']['tokens']['file_count']} token-vault files."
        )
        return 0
    result = restore_backup_set(
        Path(args.recovery_set),
        config,
        confirm_stopped=args.confirm_stopped,
        allow_session_reset=args.allow_session_reset,
    )
    print(f"[Flask restore] Restored verified set {Path(args.recovery_set).resolve()}.")
    print(f"[Flask restore] Previous ledger: {result.previous_ledger or 'none'}")
    print(f"[Flask restore] Previous auth database: {result.previous_auth or 'none'}")
    print(f"[Flask restore] Previous uploads: {result.previous_uploads or 'none'}")
    print(f"[Flask restore] Previous token vault: {result.previous_tokens or 'none'}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RecoveryError as error:
        print(f"[Flask recovery] Failed: {error}", file=sys.stderr)
        raise SystemExit(1)
