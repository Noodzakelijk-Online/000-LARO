"""Bounded, review-first discovery of public outreach candidates.

This adapter deliberately searches only the query the user submits.  It does
not upload case material, crawl target sites, or treat a search result as a
verified contact.  Every returned record is intended for the LARO directory's
existing human-review gate.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, unquote, urlencode, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup


DUCKDUCKGO_HTML_URL = "https://html.duckduckgo.com/html/"
ALLOWED_TARGET_TYPES = {"media", "organization"}
MAX_QUERY_LENGTH = 240
MAX_RESULTS = 20


class OutreachDiscoveryError(RuntimeError):
    """Raised when a public candidate search cannot be completed safely."""


class OutreachTargetDiscovery:
    """Read-only public-search adapter for LARO's review queue."""

    def __init__(
        self,
        http_get=requests.get,
        search_url: str = DUCKDUCKGO_HTML_URL,
        timeout_seconds: int = 12,
    ):
        self.http_get = http_get
        self.search_url = search_url
        self.timeout_seconds = timeout_seconds

    def discover(
        self,
        target_type: str,
        query: str,
        limit: Any = 10,
    ) -> Dict[str, Any]:
        normalized_type = str(target_type or "").strip().lower()
        if normalized_type not in ALLOWED_TARGET_TYPES:
            raise OutreachDiscoveryError("target_type must be media or organization")

        normalized_query = " ".join(str(query or "").split())
        if not normalized_query:
            raise OutreachDiscoveryError("Enter an external search query before discovering targets")
        if len(normalized_query) > MAX_QUERY_LENGTH:
            raise OutreachDiscoveryError(f"Search query must be {MAX_QUERY_LENGTH} characters or fewer")

        try:
            bounded_limit = min(max(int(limit or 10), 1), MAX_RESULTS)
        except (TypeError, ValueError):
            bounded_limit = 10

        retrieved_at = datetime.now(timezone.utc).isoformat()
        try:
            response = self.http_get(
                self.search_url,
                params={"q": normalized_query, "kl": "nl-nl"},
                headers={
                    "Accept": "text/html,application/xhtml+xml",
                    "User-Agent": "LARO-local-outreach-discovery/1.0 (+local-only)",
                },
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise OutreachDiscoveryError(f"Public web search could not be reached: {exc}") from exc

        candidates = self._parse_results(
            html=getattr(response, "text", ""),
            target_type=normalized_type,
            query=normalized_query,
            retrieved_at=retrieved_at,
            limit=bounded_limit,
        )
        return {
            "provider": "duckduckgo_html",
            "provider_label": "DuckDuckGo public web search",
            "query": normalized_query,
            "retrieved_at": retrieved_at,
            "candidates": candidates,
            "result_count": len(candidates),
            "search_url": f"{self.search_url}?{urlencode({'q': normalized_query, 'kl': 'nl-nl'})}",
        }

    def _parse_results(
        self,
        html: str,
        target_type: str,
        query: str,
        retrieved_at: str,
        limit: int,
    ) -> List[Dict[str, Any]]:
        soup = BeautifulSoup(html or "", "html.parser")
        links = soup.select("a.result__a, a[data-testid='result-title-a']")
        candidates: List[Dict[str, Any]] = []
        seen_urls = set()

        for link in links:
            source_url = self._clean_result_url(link.get("href") or "")
            title = link.get_text(" ", strip=True)
            if not source_url or not title or source_url in seen_urls:
                continue
            seen_urls.add(source_url)

            container = link.find_parent(class_="result") or link.find_parent("article") or link.parent
            snippet_node = container.select_one(".result__snippet, [data-result='snippet'], [data-testid='result-snippet']") if container else None
            snippet = snippet_node.get_text(" ", strip=True) if snippet_node else ""
            rank = len(candidates) + 1
            candidates.append({
                "target_type": target_type,
                "name": title[:255],
                "subtype": f"{target_type} discovery candidate",
                "description": snippet[:2000],
                "topics": [],
                "legal_fields": [],
                "audience": [],
                "channels": ["web"],
                "region": "Netherlands",
                "url": source_url,
                "source_url": source_url,
                "source_label": "DuckDuckGo public web search",
                "source_retrieved_at": retrieved_at,
                "confidence": "discovery_candidate",
                "metadata": {
                    "discovery_provider": "duckduckgo_html",
                    "discovery_query": query,
                    "discovery_rank": rank,
                    "discovery_snippet": snippet[:2000],
                    "discovered_at": retrieved_at,
                    "review_note": "Public search result only. Verify the target, scope, and contact route before approval.",
                },
            })
            if len(candidates) >= limit:
                break
        return candidates

    @staticmethod
    def _clean_result_url(raw_url: str) -> str:
        raw_url = str(raw_url or "").strip()
        if not raw_url:
            return ""
        parsed = urlparse(raw_url)
        if parsed.netloc.endswith("duckduckgo.com"):
            redirect_target = parse_qs(parsed.query).get("uddg", [""])[0]
            raw_url = unquote(redirect_target)
            parsed = urlparse(raw_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return ""
        filtered_query = urlencode([
            (key, value)
            for key, values in parse_qs(parsed.query, keep_blank_values=True).items()
            if not key.lower().startswith("utm_")
            for value in values
        ])
        return urlunparse((parsed.scheme, parsed.netloc, parsed.path or "/", "", filtered_query, ""))
