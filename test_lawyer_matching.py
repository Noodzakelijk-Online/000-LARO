import unittest
from unittest.mock import patch

from lawyer_matching import LawyerMatchingEngine, NovaDirectoryClient, NovaSearchCriteria
from lawyer_outreach import LawyerOutreachSystem
from serverless_functions import match_lawyers


TEST_LAWYERS = [
    {
        "lawyer_id": "fixture-admin",
        "name": "Fixture Administrative Lawyer",
        "city": "Amsterdam",
        "distance_km": 6,
        "legal_fields": ["ADMINISTRATIVE_LAW"],
        "nova_rechtsgebieden": ["bestuursrecht", "bezwaar", "beroep"],
        "specialization_associations": ["VAR"],
        "financed_legal_aid": True,
    },
    {
        "lawyer_id": "fixture-employment",
        "name": "Fixture Employment Lawyer",
        "city": "Amsterdam",
        "distance_km": 8,
        "legal_fields": ["EMPLOYMENT_LAW"],
        "nova_rechtsgebieden": ["arbeidsrecht", "ontslag"],
        "specialization_associations": ["VAAN"],
        "financed_legal_aid": True,
    },
]


class TestLawyerMatching(unittest.TestCase):
    def test_public_directory_results_keep_source_provenance(self):
        html = '''
        <div class="result advocaten">
            <div class="heading flex-container">
                <a href="/advocaten/amsterdam/mr-fixture/123">mr. Fixture</a>
                <a href="/kantoren/amsterdam/fixture-legal/456" class="secondary"><strong>Fixture Legal</strong></a>
                <strong>AMSTERDAM</strong>
            </div>
            <div class="jurisdictions"><span class="label dark-gray">Bestuursrecht</span></div>
            <div class="specialisations"><li>Fixture Association</li></div>
        </div>
        '''

        class FakeResponse:
            def raise_for_status(self):
                return None

            def json(self):
                return {"count": 1, "html": html}

        with patch("lawyer_matching.requests.get", return_value=FakeResponse()) as get:
            result = LawyerMatchingEngine().match({"legal_fields": ["ADMINISTRATIVE_LAW"], "max_results": 3})

        self.assertEqual(result["source_mode"], "nova_public_directory")
        self.assertEqual(result["source_details"]["reported_total"], 1)
        self.assertEqual(result["matched_lawyers"][0]["profile_url"], "https://zoekeenadvocaat.advocatenorde.nl/advocaten/amsterdam/mr-fixture/123")
        self.assertIsNone(result["matched_lawyers"][0]["response_rate"])
        self.assertIn("filters%5Brechtsgebieden%5D=%5B227%5D", get.call_args.args[0])

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
        }, records=TEST_LAWYERS)

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
            "candidate_lawyers": TEST_LAWYERS,
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
        }, records=TEST_LAWYERS)["matched_lawyers"]

        records = outreach.send_initial_outreach(
            "Employee was dismissed without a proper file.",
            "EMPLOYMENT_LAW",
            max_lawyers=1,
            preferred_lawyers=[matches[0]["id"]],
            match_criteria={
                "postcode_or_city": "Amsterdam",
                "radius_km": 50,
                "candidate_lawyers": TEST_LAWYERS,
            },
        )

        self.assertEqual(len(records), 1)
        self.assertEqual(str(records[0]["lawyer_id"]), str(matches[0]["lawyer_id"]))


if __name__ == "__main__":
    unittest.main()
