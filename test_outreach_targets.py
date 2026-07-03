import unittest

from outreach_target_matching import OutreachTargetEngine, sample_outreach_targets
from serverless_functions import match_outreach_targets


class TestOutreachTargets(unittest.TestCase):
    def test_media_matching_returns_consumer_programs(self):
        engine = OutreachTargetEngine()

        result = engine.match({
            "target_type": "media",
            "description": "Consumer contract dispute with a company, misleading claims and housing impact.",
            "legal_fields": ["CONTRACT_LAW"],
            "evidence_topics": ["consumer", "contracts", "misleading claims"],
            "max_results": 5,
        }, records=sample_outreach_targets())

        self.assertEqual(result["target_type"], "media")
        self.assertGreaterEqual(result["result_count"], 1)
        names = [target["name"] for target in result["matched_targets"]]
        self.assertIn("Radar", names)
        self.assertTrue(result["matched_targets"][0]["match_reasons"])

    def test_organization_matching_returns_advocacy_groups(self):
        engine = OutreachTargetEngine()

        result = engine.match({
            "target_type": "organization",
            "description": "Housing and rent dispute with landlord maintenance problems.",
            "legal_fields": ["PROPERTY_LAW"],
            "evidence_topics": ["housing", "rent", "tenants"],
            "max_results": 5,
        }, records=sample_outreach_targets())

        self.assertEqual(result["target_type"], "organization")
        self.assertGreaterEqual(result["result_count"], 1)
        self.assertEqual(result["matched_targets"][0]["name"], "Woonbond")

    def test_serverless_match_outreach_targets_returns_metadata(self):
        result = match_outreach_targets({
            "case_id": 909,
            "target_type": "organization",
            "case_data": {
                "description": "Privacy and data access dispute with a government body.",
                "legal_fields": ["ADMINISTRATIVE_LAW"],
                "evidence_topics": ["privacy", "data", "government"],
            },
            "max_results": 5,
            "candidate_targets": sample_outreach_targets(),
        }, {})

        self.assertEqual(result["statusCode"], 200)
        body = result["body"]
        self.assertIn("matched_targets", body)
        self.assertIn("search_criteria", body)
        self.assertEqual(body["target_type"], "organization")

    def test_sample_database_has_media_and_organizations(self):
        records = sample_outreach_targets()
        types = {record["target_type"] for record in records}

        self.assertIn("media", types)
        self.assertIn("organization", types)
        self.assertTrue(all(record.get("source_url") for record in records))


if __name__ == "__main__":
    unittest.main()
