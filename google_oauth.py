"""Google OAuth helpers for Gmail and Drive evidence intake."""

import os
import secrets
import json
from typing import Dict, List
from urllib.parse import urlencode
from urllib.request import Request, urlopen


GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_SCOPES: List[str] = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]


def google_oauth_config() -> Dict[str, object]:
    """Return Google OAuth configuration sourced from environment variables."""
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "").strip()
    return {
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "configured": bool(client_id and client_secret and redirect_uri),
        "scopes": GOOGLE_SCOPES,
    }


def build_google_oauth_state() -> str:
    """Create a CSRF-resistant OAuth state token."""
    return secrets.token_urlsafe(24)


def build_google_oauth_url(state: str) -> str:
    """Build the Google consent URL for the configured Gmail and Drive scopes."""
    config = google_oauth_config()
    if not config["configured"]:
        raise ValueError("GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI must be configured")

    params = {
        "client_id": config["client_id"],
        "redirect_uri": config["redirect_uri"],
        "response_type": "code",
        "scope": " ".join(GOOGLE_SCOPES),
        "state": state,
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
    }
    return f"{GOOGLE_OAUTH_AUTHORIZE_URL}?{urlencode(params)}"


def exchange_google_oauth_code(code: str) -> Dict[str, object]:
    """Exchange a Google authorization code for OAuth tokens."""
    config = google_oauth_config()
    if not config["configured"]:
        raise ValueError("GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI must be configured")

    payload = urlencode({
        "code": code,
        "client_id": config["client_id"],
        "client_secret": config["client_secret"],
        "redirect_uri": config["redirect_uri"],
        "grant_type": "authorization_code",
    }).encode("utf-8")
    request = Request(
        GOOGLE_OAUTH_TOKEN_URL,
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urlopen(request, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))
