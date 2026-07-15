import sqlite3
import tempfile
import unittest
from contextlib import closing

from flask import Flask

from authentication import EmailAuthenticationSystem


class PersistentAuthenticationTests(unittest.TestCase):
    def setUp(self):
        self.temp_directory = tempfile.TemporaryDirectory()
        self.database_path = f"{self.temp_directory.name}/auth.sqlite3"
        self.delivered = []
        self.app = self._build_app()
        self.client = self.app.test_client()

    def tearDown(self):
        self.temp_directory.cleanup()

    def _build_app(self):
        app = Flask(__name__)
        app.config.update(
            TESTING=True,
            SECRET_KEY="test-only-secret",
            LARO_AUTH_DATABASE_PATH=self.database_path,
            LARO_PASSWORD_RESET_DELIVERY=lambda email, token: self.delivered.append((email, token)),
        )
        app.auth_system = EmailAuthenticationSystem(app)
        return app

    def _register(self, email="person@example.com", password="correct horse battery staple"):
        return self.client.post("/api/auth/register", json={
            "email": email,
            "password": password,
            "first_name": "Case",
            "last_name": "Owner",
        })

    def test_has_no_seeded_accounts_and_persists_registered_users(self):
        missing = self.client.post("/api/auth/login", json={
            "email": "user@example.com",
            "password": "password123",
        })
        self.assertEqual(missing.status_code, 401)

        registered = self._register()
        self.assertEqual(registered.status_code, 201)
        token = registered.get_json()["token"]

        with closing(sqlite3.connect(self.database_path)) as connection:
            stored = connection.execute(
                "SELECT password_hash FROM auth_users WHERE email = ?", ("person@example.com",)
            ).fetchone()[0]
            session_hash = connection.execute("SELECT token_hash FROM auth_sessions").fetchone()[0]
        self.assertNotEqual(stored, "correct horse battery staple")
        self.assertNotIn(token, session_hash)

        restarted_app = self._build_app()
        restarted_client = restarted_app.test_client()
        login = restarted_client.post("/api/auth/login", json={
            "email": "person@example.com",
            "password": "correct horse battery staple",
        })
        self.assertEqual(login.status_code, 200)

    def test_profile_requires_a_valid_bearer_session_and_logout_revokes_it(self):
        token = self._register().get_json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        profile = self.client.get("/api/user/profile", headers=headers)
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(profile.get_json()["email"], "person@example.com")

        self.assertEqual(self.client.post("/api/auth/logout", headers=headers).status_code, 200)
        self.assertEqual(self.client.get("/api/user/profile", headers=headers).status_code, 401)

    def test_password_reset_never_returns_the_token_and_invalidates_old_sessions(self):
        old_token = self._register().get_json()["token"]
        response = self.client.post("/api/auth/reset-password", json={"email": "person@example.com"})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("token", response.get_data(as_text=True).lower())
        self.assertEqual(len(self.delivered), 1)
        reset_token = self.delivered[0][1]

        reset = self.client.post(f"/api/auth/reset-password/{reset_token}", json={
            "password": "a different strong password",
        })
        self.assertEqual(reset.status_code, 200)
        self.assertEqual(
            self.client.get("/api/user/profile", headers={"Authorization": f"Bearer {old_token}"}).status_code,
            401,
        )
        self.assertEqual(self.client.post("/api/auth/login", json={
            "email": "person@example.com",
            "password": "a different strong password",
        }).status_code, 200)
        self.assertEqual(self.client.post(f"/api/auth/reset-password/{reset_token}", json={
            "password": "another strong password",
        }).status_code, 400)

    def test_unknown_reset_email_has_the_same_public_response(self):
        known = self._register()
        self.assertEqual(known.status_code, 201)
        known_response = self.client.post("/api/auth/reset-password", json={"email": "person@example.com"})
        unknown_response = self.client.post("/api/auth/reset-password", json={"email": "missing@example.com"})
        self.assertEqual(known_response.status_code, unknown_response.status_code)
        self.assertEqual(known_response.get_json(), unknown_response.get_json())

    def test_investor_access_requires_a_provisioned_password_and_returns_no_mock_metrics(self):
        self.app.auth_system.provision_investor("investor@example.com", "investor strong password", 2)
        no_password = self.client.post("/api/investor/auth", json={"email": "investor@example.com"})
        self.assertEqual(no_password.status_code, 401)

        login = self.client.post("/api/investor/auth", json={
            "email": "investor@example.com",
            "password": "investor strong password",
        })
        self.assertEqual(login.status_code, 200)
        dashboard = self.client.get("/api/investor/dashboard", headers={
            "Authorization": f"Bearer {login.get_json()['token']}"
        })
        self.assertEqual(dashboard.status_code, 200)
        self.assertIsNone(dashboard.get_json()["metrics"])


if __name__ == "__main__":
    unittest.main()
