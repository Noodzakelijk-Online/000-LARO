import unittest
from unittest import mock

from outreach_discovery import OutreachDiscoveryError, OutreachTargetDiscovery


SEARCH_HTML = """
<html><body>
  <div class="result">
    <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Ftenant-help.example%2Fabout%3Futm_source%3Dsearch">Tenant Help</a>
    <a class="result__snippet">Independent tenant advocacy and rent support.</a>
  </div>
  <article>
    <a data-testid="result-title-a" href="https://media-watch.example/contact">Media Watch</a>
    <div data-testid="result-snippet">Public-interest reporting desk.</div>
  </article>
</body></html>
"""


class _Response:
    text = SEARCH_HTML

    def raise_for_status(self):
        return None


class TestOutreachDiscovery(unittest.TestCase):
    def test_search_candidates_preserve_source_and_review_metadata(self):
        http_get = mock.Mock(return_value=_Response())
        discovery = OutreachTargetDiscovery(http_get=http_get)

        result = discovery.discover("organization", "Dutch tenant support", limit=10)

        self.assertEqual(result["provider"], "duckduckgo_html")
        self.assertEqual(result["result_count"], 2)
        first = result["candidates"][0]
        self.assertEqual(first["name"], "Tenant Help")
        self.assertEqual(first["source_url"], "https://tenant-help.example/about")
        self.assertEqual(first["confidence"], "discovery_candidate")
        self.assertEqual(first["topics"], [])
        self.assertEqual(first["metadata"]["discovery_query"], "Dutch tenant support")
        self.assertIn("Verify", first["metadata"]["review_note"])
        http_get.assert_called_once()
        self.assertEqual(http_get.call_args.kwargs["params"]["q"], "Dutch tenant support")

    def test_rejects_empty_or_unbounded_discovery_input(self):
        discovery = OutreachTargetDiscovery(http_get=mock.Mock())
        with self.assertRaisesRegex(OutreachDiscoveryError, "Enter an external"):
            discovery.discover("media", "")
        with self.assertRaisesRegex(OutreachDiscoveryError, "target_type"):
            discovery.discover("lawyer", "consumer advocates")


if __name__ == "__main__":
    unittest.main()
