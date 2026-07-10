import base64
import tempfile
import unittest

from google_evidence import GoogleEvidenceConnector
from google_token_store import LocalEncryptedTokenStore


class _Request:
    def __init__(self, payload):
        self.payload = payload

    def execute(self):
        return self.payload


class _GmailMessages:
    def __init__(self, messages):
        self.messages = messages

    def list(self, **kwargs):
        return _Request({"messages": [{"id": "message-1"}]})

    def get(self, **kwargs):
        return _Request(self.messages[kwargs["id"]])


class _GmailUsers:
    def __init__(self, messages):
        self.messages_api = _GmailMessages(messages)

    def messages(self):
        return self.messages_api


class _GmailService:
    def __init__(self, messages):
        self.users_api = _GmailUsers(messages)

    def users(self):
        return self.users_api


class _DriveFiles:
    def list(self, **kwargs):
        return _Request({
            "files": [{
                "id": "drive-1",
                "name": "CAK decision",
                "mimeType": "application/vnd.google-apps.document",
                "modifiedTime": "2026-07-10T10:00:00Z",
                "webViewLink": "https://drive.google.com/open?id=drive-1",
            }]
        })

    def export_media(self, **kwargs):
        return _Request(b"Decision dated 2026-07-01. CAK requested proof of payment.")


class _DriveService:
    def __init__(self):
        self.files_api = _DriveFiles()

    def files(self):
        return self.files_api


class GoogleEvidenceTests(unittest.TestCase):
    def test_token_vault_encrypts_credentials_outside_the_ledger(self):
        with tempfile.TemporaryDirectory() as directory:
            vault = LocalEncryptedTokenStore(directory)
            vault.save("robert@example.nl", "google", {
                "access_token": "raw-access-token",
                "refresh_token": "raw-refresh-token",
                "expires_in": 3600,
            })

            stored_files = list(vault.root.glob("*.vault"))
            self.assertEqual(len(stored_files), 1)
            self.assertNotIn(b"raw-access-token", stored_files[0].read_bytes())
            self.assertTrue(vault.status("robert@example.nl", "google")["available"])
            stored = vault.load("robert@example.nl", "google")
            self.assertEqual(stored["refresh_token"], "raw-refresh-token")
            self.assertIn("expiry", stored)

    def test_connector_maps_gmail_and_drive_results_to_source_records(self):
        encoded = base64.urlsafe_b64encode(b"Decision dated 2026-07-01. CAK asked for payment proof.").decode().rstrip("=")
        gmail = _GmailService({
            "message-1": {
                "id": "message-1",
                "threadId": "thread-1",
                "labelIds": ["LARO-CAK"],
                "payload": {
                    "mimeType": "text/plain",
                    "headers": [
                        {"name": "Subject", "value": "CAK decision"},
                        {"name": "From", "value": "CAK <cak@example.nl>"},
                        {"name": "To", "value": "Robert <robert@example.nl>"},
                        {"name": "Date", "value": "Wed, 1 Jul 2026 10:00:00 +0000"},
                    ],
                    "body": {"data": encoded},
                },
            }
        })
        connector = GoogleEvidenceConnector(
            {"access_token": "test-token"},
            client_id="client-id",
            client_secret="client-secret",
            scopes=[],
            gmail_service=gmail,
            drive_service=_DriveService(),
        )

        gmail_records = connector.fetch_gmail("label:LARO-CAK", 5)
        drive_records = connector.fetch_drive("CAK", 5)

        self.assertEqual(gmail_records[0]["source_type"], "gmail")
        self.assertIn("CAK asked for payment proof", gmail_records[0]["plain_text"])
        self.assertIn("mail.google.com", gmail_records[0]["source_uri"])
        self.assertEqual(drive_records[0]["source_type"], "google_drive")
        self.assertIn("CAK requested proof", drive_records[0]["content"])
        self.assertIn("drive.google.com", drive_records[0]["source_uri"])


if __name__ == "__main__":
    unittest.main()
