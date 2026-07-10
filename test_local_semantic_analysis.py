import json
import unittest

from document_intelligence import DocumentIntelligenceEngine
from local_semantic_analysis import LocalSemanticAnalysisProvider


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class TestLocalSemanticAnalysisProvider(unittest.TestCase):
    def test_local_ollama_output_keeps_only_literal_source_citations(self):
        calls = []

        def fake_post(url, **kwargs):
            calls.append({"url": url, **kwargs})
            return FakeResponse({"response": json.dumps({
                "findings": [
                    {
                        "category": "decision",
                        "source_quote": "CAK decided that Robert must pay EUR 125.",
                        "observation": "The source records a payment decision.",
                    },
                    {
                        "category": "deadline",
                        "source_quote": "Invented deadline that is not in the source.",
                        "observation": "This must be discarded.",
                    },
                ],
                "review_questions": [
                    {
                        "question": "Confirm whether an objection was filed.",
                        "source_quote": "File an objection before 2026-07-15.",
                    },
                ],
            })})

        provider = LocalSemanticAnalysisProvider({
            "provider": "ollama",
            "base_url": "http://127.0.0.1:11434",
            "model": "local-legal-model",
        }, request_post=fake_post)
        result = provider.analyze(
            "CAK decided that Robert must pay EUR 125. File an objection before 2026-07-15.",
            document_name="CAK decision",
        )

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["provider"], "ollama")
        self.assertEqual(len(result["findings"]), 1)
        self.assertEqual(result["findings"][0]["category"], "decision")
        self.assertEqual(result["rejected_uncited_findings"], 1)
        self.assertEqual(len(result["review_questions"]), 1)
        self.assertEqual(calls[0]["url"], "http://127.0.0.1:11434/api/generate")
        self.assertTrue(calls[0]["json"]["stream"] is False)

    def test_non_literal_loopback_configuration_never_receives_source_text(self):
        for base_url in ("https://example.test", "http://localhost:11434"):
            with self.subTest(base_url=base_url):
                calls = []
                provider = LocalSemanticAnalysisProvider({
                    "provider": "ollama",
                    "base_url": base_url,
                    "model": "not-allowed",
                }, request_post=lambda *args, **kwargs: calls.append((args, kwargs)))

                result = provider.analyze("Private legal source text.")

                self.assertEqual(result["status"], "configuration_invalid")
                self.assertEqual(calls, [])

    def test_document_engine_keeps_semantic_output_as_review_only(self):
        class SemanticFixture:
            def analyze(self, text, document_name=""):
                return {
                    "status": "completed",
                    "provider": "ollama",
                    "model": "fixture",
                    "findings": [{
                        "category": "decision",
                        "source_quote": "CAK decided on 2026-07-01.",
                        "observation": "A decision is recorded.",
                        "review_status": "needs_review",
                    }],
                    "review_questions": [],
                    "limitations": ["Review source."],
                }

        analysis = DocumentIntelligenceEngine(semantic_provider=SemanticFixture()).analyze_text(
            "CAK decided on 2026-07-01.", document_name="decision.txt"
        )

        self.assertEqual(analysis["semantic_reading"]["findings"][0]["review_status"], "needs_review")
        self.assertEqual(analysis["processing"]["semantic_analysis_status"], "completed")
        self.assertEqual(analysis["processing"]["analysis_method"], "rule_based_source_passage_v1")

    def test_case_analysis_requires_document_scoped_literal_citations(self):
        def fake_post(url, **kwargs):
            return FakeResponse({"response": json.dumps({
                "findings": [
                    {
                        "category": "cross_document_conflict",
                        "observation": "The amounts differ between sources.",
                        "sources": [
                            {"document_id": "1", "source_quote": "CAK asks for EUR 125."},
                            {"document_id": "2", "source_quote": "The notice asks for EUR 250."},
                        ],
                    },
                    {
                        "category": "cross_document_conflict",
                        "observation": "This must be discarded.",
                        "sources": [{"document_id": "99", "source_quote": "Invented source."}],
                    },
                ],
                "review_questions": [{
                    "category": "open_question",
                    "question": "Which amount is currently claimed?",
                    "sources": [{"document_id": "2", "source_quote": "The notice asks for EUR 250."}],
                }],
            })})

        provider = LocalSemanticAnalysisProvider({
            "provider": "ollama",
            "base_url": "http://127.0.0.1:11434",
            "model": "local-legal-model",
        }, request_post=fake_post)
        result = provider.analyze_case([
            {"document_id": 1, "title": "Decision", "content_hash": "one", "extracted_text": "CAK asks for EUR 125."},
            {"document_id": 2, "title": "Notice", "content_hash": "two", "extracted_text": "The notice asks for EUR 250."},
        ], {"title": "CAK review"})

        self.assertEqual(result["status"], "completed")
        self.assertEqual(len(result["findings"]), 1)
        self.assertEqual(result["findings"][0]["sources"][1]["document_id"], "2")
        self.assertEqual(result["rejected_uncited_findings"], 1)
        self.assertEqual(len(result["review_questions"]), 1)
        self.assertEqual(len(result["source_documents"]), 2)

    def test_default_case_analysis_compares_literal_sources_without_ollama(self):
        provider = LocalSemanticAnalysisProvider({"provider": "rule_based"})

        result = provider.analyze_case([
            {
                "document_id": 1,
                "title": "Decision",
                "extracted_text": "Case reference CAK-42. The decision records a payment amount of EUR 125.",
            },
            {
                "document_id": 2,
                "title": "Notice",
                "extracted_text": "Case reference CAK-42. The payment notice records a payment amount of EUR 250.",
            },
            {
                "document_id": 3,
                "title": "Undated notice",
                "extracted_text": "Submit the objection before the deadline.",
            },
        ])

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["provider"], "rule_based")
        self.assertEqual(result["analysis_method"], "deterministic_source_comparison_v1")
        conflict = next(item for item in result["findings"] if item["category"] == "cross_document_conflict")
        self.assertEqual([source["document_id"] for source in conflict["sources"]], ["1", "2"])
        self.assertIn("EUR 125", conflict["sources"][0]["source_quote"])
        self.assertTrue(any(item["category"] == "corroboration" for item in result["findings"]))
        self.assertTrue(any(item["category"] == "evidence_gap" for item in result["findings"]))
        self.assertTrue(any("current" in item["question"] for item in result["review_questions"]))


if __name__ == "__main__":
    unittest.main()
