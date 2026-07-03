import datetime
import unittest
from types import SimpleNamespace

from outreach_analytics import build_outreach_analytics


class OutreachAnalyticsTests(unittest.TestCase):
    def test_builds_progress_from_campaign_and_matches(self):
        sent_at = datetime.datetime(2026, 6, 27, 9, 0, 0)
        replied_at = datetime.datetime(2026, 6, 27, 13, 30, 0)
        campaign = SimpleNamespace(
            outreach_records=[
                {
                    "outreach_id": 1,
                    "lawyer_id": "lawyer-1",
                    "lawyer_name": "Lotte Bakker",
                    "sent_timestamp": sent_at.isoformat(),
                    "status": "responded",
                    "subject": "Case Inquiry",
                },
                {
                    "outreach_id": 2,
                    "lawyer_id": "lawyer-2",
                    "lawyer_name": "Robert Mulder",
                    "sent_timestamp": sent_at.isoformat(),
                    "status": "sent",
                    "subject": "Case Inquiry",
                },
            ],
            responses=[
                {
                    "outreach_id": 1,
                    "lawyer_id": "lawyer-1",
                    "timestamp": replied_at.isoformat(),
                    "response_type": "pre_assessment_positive",
                }
            ],
        )
        lawyer_matches = {"matched_lawyers": [{"name": "Lotte"}, {"name": "Robert"}]}
        target_matches = {
            "media": {"matched_targets": [{"name": "Radar"}, {"name": "Nieuwsuur"}, {"name": "Pointer"}]},
            "organization": {"matched_targets": [{"name": "Consumentenbond"}, {"name": "Woonbond"}]},
        }

        analytics = build_outreach_analytics(1, campaign, lawyer_matches, target_matches)

        self.assertEqual(analytics["matched_targets"], 7)
        self.assertEqual(analytics["total_outreaches"], 2)
        self.assertEqual(analytics["contacted_targets"], 2)
        self.assertEqual(analytics["responses_received"], 1)
        self.assertEqual(analytics["accepted_targets"], 1)
        self.assertEqual(analytics["response_rate"], 50.0)
        self.assertEqual(analytics["acceptance_rate"], 50.0)
        self.assertEqual(analytics["avg_response_time_hours"], 4.5)
        self.assertEqual(analytics["categories"]["media"]["matched"], 3)
        self.assertEqual(analytics["categories"]["organizations"]["matched"], 2)
        self.assertEqual(analytics["categories"]["lawyers"]["contacted"], 2)
        self.assertEqual(analytics["categories"]["lawyers"]["accepted"], 1)
        self.assertTrue(analytics["history"])
        self.assertTrue(analytics["insights"])

    def test_empty_state_is_stable(self):
        analytics = build_outreach_analytics(42)

        self.assertEqual(analytics["case_id"], 42)
        self.assertEqual(analytics["matched_targets"], 0)
        self.assertEqual(analytics["total_outreaches"], 0)
        self.assertEqual(analytics["response_rate"], 0.0)
        self.assertEqual(analytics["categories"]["lawyers"]["ready"], 0)
        self.assertEqual(analytics["history"], [])
        self.assertEqual(analytics["insights"][0]["title"], "Outreach starting soon")


if __name__ == "__main__":
    unittest.main()
