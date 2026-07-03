"""
Document intelligence for legal case evidence.

This module turns raw email, Drive, and uploaded document text into a stable
analysis object that the rest of LARO can use for summaries, timelines,
contradiction checks, and lawyer outreach.
"""

import datetime
import html
import os
import re
from collections import Counter
from typing import Any, Dict, Iterable, List, Optional


class DocumentIntelligenceEngine:
    """Extracts legal signals and evidence facts from document contents."""

    DATE_PATTERNS = [
        re.compile(r"\b(?P<date>\d{4}[-/]\d{1,2}[-/]\d{1,2})\b"),
        re.compile(r"\b(?P<date>\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b"),
        re.compile(
            r"\b(?P<date>\d{1,2}\s+(?:jan|januari|feb|februari|mrt|maart|apr|april|mei|jun|juni|jul|juli|aug|augustus|sep|sept|september|okt|oktober|nov|november|dec|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4})\b",
            re.IGNORECASE,
        ),
        re.compile(
            r"\b(?P<date>(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b",
            re.IGNORECASE,
        ),
    ]

    MONTHS = {
        "jan": 1,
        "januari": 1,
        "january": 1,
        "feb": 2,
        "februari": 2,
        "february": 2,
        "mrt": 3,
        "maart": 3,
        "mar": 3,
        "march": 3,
        "apr": 4,
        "april": 4,
        "mei": 5,
        "may": 5,
        "jun": 6,
        "juni": 6,
        "june": 6,
        "jul": 7,
        "juli": 7,
        "july": 7,
        "aug": 8,
        "augustus": 8,
        "august": 8,
        "sep": 9,
        "sept": 9,
        "september": 9,
        "okt": 10,
        "oktober": 10,
        "oct": 10,
        "october": 10,
        "nov": 11,
        "november": 11,
        "dec": 12,
        "december": 12,
    }

    LEGAL_TOPICS = {
        "employment_law": [
            "ontslag",
            "arbeidsovereenkomst",
            "werkgever",
            "werknemer",
            "loon",
            "uwv",
            "transitievergoeding",
            "termination",
            "employment",
            "salary",
        ],
        "tenancy_law": [
            "huur",
            "huurder",
            "verhuurder",
            "woning",
            "gebrek",
            "huurcommissie",
            "lease",
            "tenant",
            "landlord",
            "rent",
        ],
        "consumer_law": [
            "consument",
            "aankoop",
            "garantie",
            "reparatie",
            "refund",
            "warranty",
            "defect",
            "delivery",
        ],
        "family_law": [
            "scheiding",
            "alimentatie",
            "ouderschap",
            "voogdij",
            "divorce",
            "custody",
            "alimony",
        ],
        "contract_law": [
            "overeenkomst",
            "contract",
            "clausule",
            "wanprestatie",
            "breach",
            "agreement",
            "terms",
        ],
        "administrative_law": [
            "besluit",
            "bezwaar",
            "beroep",
            "gemeente",
            "vergunning",
            "decision",
            "permit",
            "objection",
        ],
        "debt_collection": [
            "factuur",
            "betaling",
            "aanmaning",
            "incasso",
            "schuld",
            "invoice",
            "payment",
            "debt",
        ],
    }

    DOCUMENT_TYPE_KEYWORDS = {
        "court_filing": ["rechtbank", "dagvaarding", "verweerschrift", "court", "summons", "pleading"],
        "decision": ["beschikking", "vonnis", "uitspraak", "decision", "judgment", "ruling"],
        "contract": ["overeenkomst", "contract", "terms and conditions", "algemene voorwaarden"],
        "notice": ["ingebrekestelling", "aanmaning", "sommatie", "notice", "demand letter"],
        "invoice": ["factuur", "invoice", "payment request"],
        "correspondence": ["dear", "beste", "geachte", "kind regards", "met vriendelijke groet"],
    }

    LEGAL_SIGNAL_WORDS = [
        "deadline",
        "termijn",
        "bezwaar",
        "beroep",
        "ingebrekestelling",
        "aansprakelijk",
        "liability",
        "breach",
        "wanprestatie",
        "evidence",
        "bewijs",
        "court",
        "rechtbank",
        "contract",
        "overeenkomst",
        "payment",
        "betaling",
        "termination",
        "ontslag",
        "urgent",
        "spoed",
    ]

    OBLIGATION_WORDS = [
        "must",
        "shall",
        "required",
        "obliged",
        "agreed",
        "moet",
        "dient",
        "verplicht",
        "overeengekomen",
        "betaling",
        "betalen",
        "uiterlijk",
        "binnen",
    ]

    RISK_WORDS = [
        "deadline",
        "termijn",
        "verjaring",
        "default",
        "ingebrekestelling",
        "aansprakelijk",
        "penalty",
        "boete",
        "court",
        "rechtbank",
        "summons",
        "dagvaarding",
        "eviction",
        "ontruiming",
    ]

    def enrich_document(self, document: Dict[str, Any], case_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Return a copy of document with extracted text and legal analysis."""
        enriched = dict(document)
        text = self.extract_text_from_document(enriched)
        enriched["content"] = text
        analysis = self.analyze_text(
            text=text,
            document_name=enriched.get("document_name") or enriched.get("name", ""),
            metadata=enriched,
            case_context=case_context,
        )
        enriched["content_summary"] = analysis["summary"]
        enriched["legal_analysis"] = analysis
        enriched["is_key_document"] = bool(
            enriched.get("is_key_document") or analysis["evidence"]["relevance_score"] >= 0.7
        )
        return enriched

    def build_evidence_timeline(self, documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Build a chronological timeline with source-document deep links."""
        events = []
        for document in documents:
            analysis = document.get("legal_analysis") or self.analyze_text(
                document.get("content", ""),
                document_name=document.get("document_name", ""),
                metadata=document,
            )
            document_id = document.get("document_id") or document.get("id") or "unknown"
            document_name = document.get("document_name") or document.get("name") or "Untitled document"
            source_url = (
                document.get("source_url")
                or document.get("web_view_link")
                or document.get("document_url")
                or f"#document-{document_id}"
            )

            chronology_events = analysis.get("evidence", {}).get("chronology_events", [])
            if not chronology_events and document.get("upload_date"):
                chronology_events = [
                    {
                        "date": str(document["upload_date"])[:10],
                        "description": analysis.get("summary", ""),
                        "source": "upload_date",
                    }
                ]

            for index, event in enumerate(chronology_events):
                date = event.get("date") or str(document.get("upload_date", ""))[:10] or "Unknown date"
                description = event.get("description") or analysis.get("summary") or document_name
                actor = self._timeline_actor(description, document)
                action = self._timeline_action(description)
                events.append(
                    {
                        "timeline_id": f"{document_id}-{index}",
                        "date": date,
                        "summary": self._timeline_summary(description),
                        "actor": actor,
                        "action": action,
                        "event_label": f"{actor} {action}".strip(),
                        "evidence_quote": self._timeline_quote(description),
                        "source_document_id": document_id,
                        "source_document_name": document_name,
                        "source": document.get("source", "unknown"),
                        "document_type": analysis.get("document_type") or document.get("document_type", "unknown"),
                        "source_url": source_url,
                        "source_anchor": f"document-{document_id}",
                        "relevance_score": analysis.get("evidence", {}).get("relevance_score", 0.0),
                        "topics": analysis.get("topics", [])[:3],
                        "key_sentences": analysis.get("key_sentences", [])[:2],
                    }
                )

        return sorted(events, key=lambda item: self._timeline_sort_key(item["date"]))

    def extract_text_from_document(self, document: Dict[str, Any]) -> str:
        """Extract text from supported document shapes."""
        for key in ("content", "body", "text", "plain_text"):
            value = document.get(key)
            if isinstance(value, str) and value.strip():
                return self._clean_text(value)

        file_path = document.get("file_path") or document.get("path")
        if file_path:
            return self.extract_text_from_file(file_path)

        html_body = document.get("html") or document.get("html_body")
        if isinstance(html_body, str) and html_body.strip():
            return self._clean_text(self._strip_html(html_body))

        return ""

    def extract_text_from_file(self, file_path: str) -> str:
        """Extract readable text from a local file when available."""
        if not file_path or not os.path.exists(file_path):
            return ""

        extension = os.path.splitext(file_path)[1].lower()
        if extension in {".txt", ".md", ".csv", ".json", ".log", ".eml"}:
            return self._read_text_file(file_path)
        if extension in {".html", ".htm"}:
            return self._clean_text(self._strip_html(self._read_text_file(file_path)))
        if extension == ".pdf":
            return self._extract_pdf_text(file_path)
        if extension == ".docx":
            return self._extract_docx_text(file_path)

        return self._read_text_file(file_path)

    def analyze_text(
        self,
        text: str,
        document_name: str = "",
        metadata: Optional[Dict[str, Any]] = None,
        case_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Analyze text and return a stable legal evidence object."""
        metadata = metadata or {}
        normalized = self._clean_text(text)
        sentences = self._split_sentences(normalized)
        dates = self._extract_dates(sentences)
        legal_references = self._extract_legal_references(normalized)
        topics = self._detect_topics(normalized)
        document_type = self._classify_document_type(document_name, normalized, metadata)
        key_sentences = self._select_key_sentences(sentences)
        obligations = self._select_sentences(sentences, self.OBLIGATION_WORDS, limit=6)
        risk_flags = self._detect_risks(sentences)
        chronology_events = self._build_chronology_events(dates)
        relevance_score = self._score_relevance(normalized, dates, legal_references, topics, key_sentences)

        return {
            "readable": bool(normalized),
            "summary": self._summarize(normalized, key_sentences),
            "document_type": document_type,
            "topics": topics,
            "key_sentences": key_sentences,
            "facts": {
                "dates": dates,
                "parties": self._extract_parties(normalized, metadata),
                "contacts": self._extract_contacts(normalized, metadata),
                "monetary_amounts": self._extract_money(normalized),
                "legal_references": legal_references,
                "obligations": obligations,
            },
            "risks": risk_flags,
            "evidence": {
                "relevance_score": relevance_score,
                "chronology_events": chronology_events,
                "suggested_evidence_role": self._suggest_evidence_role(document_type, topics, risk_flags),
            },
            "processing": {
                "text_length": len(normalized),
                "word_count": len(normalized.split()),
                "sentence_count": len(sentences),
                "confidence": self._confidence(normalized, legal_references, dates),
            },
        }

    def _read_text_file(self, file_path: str) -> str:
        for encoding in ("utf-8", "utf-8-sig", "cp1252", "latin-1"):
            try:
                with open(file_path, "r", encoding=encoding) as handle:
                    return self._clean_text(handle.read())
            except UnicodeDecodeError:
                continue
        return ""

    def _extract_pdf_text(self, file_path: str) -> str:
        try:
            import PyPDF2

            chunks = []
            with open(file_path, "rb") as handle:
                reader = PyPDF2.PdfReader(handle)
                for page in reader.pages:
                    chunks.append(page.extract_text() or "")
            return self._clean_text("\n".join(chunks))
        except Exception:
            return ""

    def _extract_docx_text(self, file_path: str) -> str:
        try:
            import docx

            document = docx.Document(file_path)
            return self._clean_text("\n".join(paragraph.text for paragraph in document.paragraphs))
        except Exception:
            return ""

    def _strip_html(self, value: str) -> str:
        without_tags = re.sub(r"<(script|style).*?</\1>", " ", value, flags=re.IGNORECASE | re.DOTALL)
        without_tags = re.sub(r"<[^>]+>", " ", without_tags)
        return html.unescape(without_tags)

    def _clean_text(self, value: str) -> str:
        return re.sub(r"\s+", " ", value or "").strip()

    def _split_sentences(self, text: str) -> List[str]:
        if not text:
            return []
        return [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]

    def _extract_dates(self, sentences: Iterable[str]) -> List[Dict[str, str]]:
        dates = []
        seen = set()
        for sentence in sentences:
            for pattern in self.DATE_PATTERNS:
                for match in pattern.finditer(sentence):
                    raw = match.group("date")
                    normalized = self._normalize_date(raw)
                    key = (raw.lower(), normalized, sentence[:80])
                    if key in seen:
                        continue
                    seen.add(key)
                    dates.append(
                        {
                            "raw": raw,
                            "normalized": normalized or raw,
                            "context": sentence[:220],
                        }
                    )
        return dates

    def _normalize_date(self, raw: str) -> Optional[str]:
        cleaned = raw.strip().replace(".", "").replace(",", "")
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%y", "%d/%m/%y"):
            try:
                return datetime.datetime.strptime(cleaned, fmt).date().isoformat()
            except ValueError:
                pass

        parts = cleaned.lower().split()
        if len(parts) == 3:
            if parts[0].isdigit():
                day = int(parts[0])
                month = self.MONTHS.get(parts[1][:3], self.MONTHS.get(parts[1]))
                year = int(parts[2])
            else:
                month = self.MONTHS.get(parts[0][:3], self.MONTHS.get(parts[0]))
                day = int(parts[1])
                year = int(parts[2])
            if month:
                try:
                    return datetime.date(year, month, day).isoformat()
                except ValueError:
                    return None
        return None

    def _extract_contacts(self, text: str, metadata: Dict[str, Any]) -> Dict[str, List[str]]:
        emails = set(re.findall(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", text, flags=re.IGNORECASE))
        for key in ("from", "to", "cc"):
            value = metadata.get(key)
            if isinstance(value, str) and "@" in value:
                emails.add(value)
        phones = set(re.findall(r"(?:\+31|0031|0)\s?(?:\d[\s-]?){8,10}\b", text))
        return {"emails": sorted(emails), "phones": sorted(phones)}

    def _extract_parties(self, text: str, metadata: Dict[str, Any]) -> List[str]:
        candidates = set()
        for key in ("from", "to", "sender", "recipient"):
            value = metadata.get(key)
            if isinstance(value, str) and value.strip():
                candidates.add(value.strip())

        labels = r"(?:partij|eiser|gedaagde|huurder|verhuurder|werkgever|werknemer|client|landlord|tenant|employer|employee)"
        for match in re.finditer(labels + r"\s*[:\-]\s*([A-Z][A-Za-z .'-]{2,80})", text, flags=re.IGNORECASE):
            candidates.add(match.group(1).strip())

        return sorted(candidate for candidate in candidates if len(candidate) <= 120)

    def _extract_money(self, text: str) -> List[Dict[str, str]]:
        amounts = []
        pattern = re.compile(r"(?:EUR|euro|eur\.?)\s?\d[\d.,]*|\d[\d.,]*\s?(?:EUR|euro)", re.IGNORECASE)
        for match in pattern.finditer(text):
            amounts.append({"raw": match.group(0), "context": text[max(0, match.start() - 80) : match.end() + 80]})
        return amounts[:20]

    def _extract_legal_references(self, text: str) -> List[Dict[str, str]]:
        references = []
        patterns = {
            "ecli": r"\bECLI:[A-Z]{2}:[A-Z0-9]+:\d{4}:[A-Z0-9.]+\b",
            "case_number": r"\b(?:zaaknummer|kenmerk|referentie|dossiernummer|case no\.?|ref\.?)\s*[:#]?\s*([A-Z0-9][A-Z0-9./-]{3,})\b",
            "statute_article": r"\b(?:artikel|art\.?)\s+\d+[a-z]?(?::\d+[a-z]?)?\s*(?:bw|rv|sr|awb)?\b",
        }
        seen = set()
        for reference_type, pattern in patterns.items():
            for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                raw = match.group(0).strip()
                key = (reference_type, raw.lower())
                if key not in seen:
                    seen.add(key)
                    references.append({"type": reference_type, "value": raw})
        return references

    def _detect_topics(self, text: str) -> List[Dict[str, Any]]:
        lowered = text.lower()
        topics = []
        for topic, keywords in self.LEGAL_TOPICS.items():
            hits = sorted({keyword for keyword in keywords if keyword in lowered})
            if hits:
                topics.append({"topic": topic, "score": min(1.0, len(hits) / 4), "matched_terms": hits[:8]})
        topics.sort(key=lambda item: item["score"], reverse=True)
        return topics

    def _classify_document_type(self, document_name: str, text: str, metadata: Dict[str, Any]) -> str:
        extension = os.path.splitext(document_name or metadata.get("file_path", ""))[1].lower()
        if metadata.get("document_type") == "email" or metadata.get("source") in {"gmail", "outlook"}:
            return "correspondence"
        if extension in {".jpg", ".jpeg", ".png", ".gif"}:
            return "image_evidence"

        lowered = f"{document_name} {text}".lower()
        matches = []
        priority = {
            "notice": 6,
            "decision": 5,
            "court_filing": 4,
            "contract": 3,
            "invoice": 2,
            "correspondence": 1,
        }
        for document_type, keywords in self.DOCUMENT_TYPE_KEYWORDS.items():
            hit_count = sum(1 for keyword in keywords if keyword in lowered)
            if hit_count:
                matches.append((hit_count, priority.get(document_type, 0), document_type))
        if matches:
            matches.sort(reverse=True)
            return matches[0][2]
        return metadata.get("document_type") or "unknown"

    def _select_key_sentences(self, sentences: List[str], limit: int = 6) -> List[str]:
        scored = []
        for sentence in sentences:
            lowered = sentence.lower()
            score = sum(1 for word in self.LEGAL_SIGNAL_WORDS if word in lowered)
            score += len(self._extract_legal_references(sentence)) * 2
            score += len(self._extract_money(sentence))
            score += 1 if any(pattern.search(sentence) for pattern in self.DATE_PATTERNS) else 0
            if score:
                scored.append((score, sentence))

        scored.sort(key=lambda item: item[0], reverse=True)
        selected = []
        for _, sentence in scored:
            if sentence not in selected:
                selected.append(sentence[:320])
            if len(selected) >= limit:
                break
        return selected

    def _select_sentences(self, sentences: List[str], words: List[str], limit: int) -> List[str]:
        selected = []
        for sentence in sentences:
            lowered = sentence.lower()
            if any(word in lowered for word in words):
                selected.append(sentence[:320])
            if len(selected) >= limit:
                break
        return selected

    def _detect_risks(self, sentences: List[str]) -> List[Dict[str, str]]:
        risks = []
        for sentence in sentences:
            lowered = sentence.lower()
            matched = [word for word in self.RISK_WORDS if word in lowered]
            if matched:
                risks.append({"signal": matched[0], "context": sentence[:260]})
            if len(risks) >= 8:
                break
        return risks

    def _build_chronology_events(self, dates: List[Dict[str, str]]) -> List[Dict[str, str]]:
        return [
            {
                "date": item["normalized"],
                "description": item["context"],
                "source": "document_intelligence",
            }
            for item in dates
            if item.get("normalized")
        ]

    def _score_relevance(
        self,
        text: str,
        dates: List[Dict[str, str]],
        legal_references: List[Dict[str, str]],
        topics: List[Dict[str, Any]],
        key_sentences: List[str],
    ) -> float:
        if not text:
            return 0.0
        lowered = text.lower()
        keyword_hits = sum(1 for word in self.LEGAL_SIGNAL_WORDS if word in lowered)
        score = 0.2
        score += min(0.3, keyword_hits * 0.035)
        score += min(0.2, len(dates) * 0.05)
        score += min(0.25, len(legal_references) * 0.1)
        score += min(0.15, len(topics) * 0.05)
        score += min(0.05, len(key_sentences) * 0.01)
        return round(min(1.0, score), 2)

    def _suggest_evidence_role(self, document_type: str, topics: List[Dict[str, Any]], risks: List[Dict[str, str]]) -> str:
        if document_type in {"decision", "court_filing", "notice"}:
            return "procedural_anchor"
        if document_type == "contract":
            return "rights_and_obligations"
        if risks:
            return "risk_or_deadline"
        if topics:
            return "substantive_support"
        return "background"

    def _summarize(self, text: str, key_sentences: List[str]) -> str:
        if not text:
            return "No readable text was extracted from this document."
        if key_sentences:
            return " ".join(key_sentences[:3])
        words = text.split()
        if len(words) <= 70:
            return text
        return " ".join(words[:70]) + "..."

    def _timeline_summary(self, text: str) -> str:
        words = self._clean_text(text).split()
        if len(words) <= 28:
            return " ".join(words)
        return " ".join(words[:28]) + "..."

    def _timeline_quote(self, text: str) -> str:
        cleaned = self._clean_text(text)
        if len(cleaned) <= 180:
            return cleaned
        return cleaned[:177].rstrip() + "..."

    def _timeline_actor(self, text: str, metadata: Dict[str, Any]) -> str:
        for key in ("from", "sender", "author", "created_by"):
            value = metadata.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

        cleaned = self._clean_text(text)
        verb_pattern = r"\b(sent|sends|received|receives|wrote|writes|stated|states|decided|decides|invoiced|demands|requested|requests|confirmed|confirms|explained|explains|filed|files|paid|pays|rejected|rejects|approved|approves)\b"
        match = re.search(verb_pattern, cleaned, flags=re.IGNORECASE)
        if match:
            candidate = cleaned[:match.start()].strip(" ,.;:-")
            words = candidate.split()
            if words:
                return " ".join(words[-4:])[:80]

        party_match = re.search(r"\b(CAK|NO|Noodzakelijk Online|Robert|client|lawyer|gemeente|landlord|tenant|employer|employee)\b", cleaned, flags=re.IGNORECASE)
        if party_match:
            return party_match.group(0)
        return "Unknown actor"

    def _timeline_action(self, text: str) -> str:
        lowered = self._clean_text(text).lower()
        action_map = [
            ("sent", "sent"),
            ("received", "received"),
            ("wrote", "wrote"),
            ("stated", "stated"),
            ("decided", "decided"),
            ("invoic", "issued invoice"),
            ("demand", "demanded"),
            ("request", "requested"),
            ("confirm", "confirmed"),
            ("explain", "explained"),
            ("file", "filed"),
            ("paid", "paid"),
            ("reject", "rejected"),
            ("approv", "approved"),
            ("deadline", "set deadline"),
            ("must", "created obligation"),
            ("moet", "created obligation"),
        ]
        for needle, action in action_map:
            if needle in lowered:
                return action
        return "documented"

    def _timeline_sort_key(self, date_value: str) -> str:
        normalized = self._normalize_date(str(date_value))
        return normalized or str(date_value)

    def _confidence(self, text: str, legal_references: List[Dict[str, str]], dates: List[Dict[str, str]]) -> str:
        if len(text) < 40:
            return "low"
        if legal_references or len(dates) >= 2 or len(text) > 1000:
            return "high"
        return "medium"

    def top_terms(self, text: str, limit: int = 12) -> List[str]:
        words = re.findall(r"\b[a-zA-Z][a-zA-Z]{3,}\b", text.lower())
        stop_words = {
            "this",
            "that",
            "with",
            "from",
            "have",
            "will",
            "voor",
            "zijn",
            "naar",
            "door",
            "over",
            "heeft",
            "wordt",
        }
        counts = Counter(word for word in words if word not in stop_words)
        return [word for word, _ in counts.most_common(limit)]
