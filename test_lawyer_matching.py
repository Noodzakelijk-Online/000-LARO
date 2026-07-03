import unittest

from lawyer_matching import LawyerMatchingEngine, NovaDirectoryClient, NovaSearchCriteria, sample_nova_records
from lawyer_outreach import LawyerOutreachSystem
from serverless_functions import match_lawyers


class TestLawyerMatching(unittest.TestCase):
    def test_nova_search_url_uses_official_filter_names(self):
        client = NovaDirectoryClient()
        criteria = NovaSearchCriteria(
            legal_fields=["EMPLOYMENT_LAW"],
            postcode_or_city="Amsterdam",
            radius_km=50,
            requires_financed_legal_aid=True,
            prefer_specialization_association=True,
        )

        url = client.build_search_url(criteria)

        self.assertIn("https://zoekeenadvocaat.advocatenorde.nl/zoeken", url)
        self.assertIn("filters%5Brechtsgebieden%5D=", url)
        self.assertIn("locatie%5Badres%5D=Amsterdam", url)
        self.assertIn("locatie%5Bstraal%5D=50", url)
        self.assertIn("filters%5Btoevoegingen%5D=1", url)
        self.assertIn("filters%5Bspecialisatie%5D=1", url)

    def test_engine_ranks_matching_legal_area_and_location_first(self):
        engine = LawyerMatchingEngine()

        result = engine.match({
            "description": "CAK besluit, bezwaar en beroep over onjuiste toepassing.",
            "legal_fields": ["ADMINISTRATIVE_LAW"],
            "postcode_or_city": "Amsterdam",
            "radius_km": 50,
            "requires_financed_legal_aid": True,
            "evidence_topics": ["CAK", "bezwaar", "bestuursorgaan"],
        }, records=sample_nova_records())

        self.assertGreaterEqual(result["result_count"], 1)
        first = result["matched_lawyers"][0]
        self.assertIn("ADMINISTRATIVE_LAW", first["legal_fields"])
        self.assertGreater(first["match_score"], 70)
        self.assertTrue(first["match_reasons"])
        self.assertIn("nova_search_url", first)

    def test_serverless_match_lawyers_returns_metadata(self):
        result = match_lawyers({
            "case_id": 77,
            "case_data": {
                "description": "Werkgever heeft werknemer zonder dossier ontslagen.",
                "legal_fields": ["EMPLOYMENT_LAW"],
                "postcode_or_city": "Amsterdam",
                "radius_km": 50,
                "requires_financed_legal_aid": True,
            },
            "max_results": 5,
            "candidate_lawyers": sample_nova_records(),
        }, {})

        self.assertEqual(result["statusCode"], 200)
        body = result["body"]
        self.assertIn("matched_lawyers", body)
        self.assertIn("search_criteria", body)
        self.assertIn("nova_search_url", body)
        self.assertGreaterEqual(len(body["matched_lawyers"]), 1)

    def test_outreach_accepts_preferred_matches_and_limit(self):
        outreach = LawyerOutreachSystem(case_id=101, user_id=202)
        matches = LawyerMatchingEngine().match({
            "legal_fields": ["EMPLOYMENT_LAW"],
            "postcode_or_city": "Amsterdam",
            "radius_km": 50,
        }, records=sample_nova_records())["matched_lawyers"]

        records = outreach.send_initial_outreach(
            "Employee was dismissed without a proper file.",
            "EMPLOYMENT_LAW",
            max_lawyers=1,
            preferred_lawyers=[matches[0]["id"]],
            match_criteria={
                "postcode_or_city": "Amsterdam",
                "radius_km": 50,
                "candidate_lawyers": sample_nova_records(),
            },
        )

        self.assertEqual(len(records), 1)
        self.assertEqual(str(records[0]["lawyer_id"]), str(matches[0]["lawyer_id"]))


if __name__ == "__main__":
    unittest.main()
