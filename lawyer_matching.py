"""
Lawyer matching engine for LARO.

The public NOvA lawyer finder is filter-driven: legal subject, lawyer name,
location/radius, specialization association membership, and financed legal aid.
This module models those filters explicitly and ranks candidate lawyers against
the case intelligence that LARO already builds from documents.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
from urllib.parse import urlencode

import requests
from bs4 import BeautifulSoup

NOVA_BASE_URL = "https://zoekeenadvocaat.advocatenorde.nl"

# IDs currently used by the public NOvA finder.  A field absent from this map
# falls back to its public subject-search API instead of broadening the result
# set silently.
NOVA_FIELD_IDS = {
    "EMPLOYMENT_LAW": 14,
    "CRIMINAL_LAW": 56,
    "CONTRACT_LAW": 197,
    "PROPERTY_LAW": 24,
    "ADMINISTRATIVE_LAW": 227,
    "IMMIGRATION_LAW": 68,
    "TAX_LAW": 48,
}


FIELD_TO_NOVA_TERMS = {
    "FAMILY_LAW": ["personen- en familierecht", "echtscheiding", "alimentatie"],
    "family_law": ["personen- en familierecht", "echtscheiding", "alimentatie"],
    "CRIMINAL_LAW": ["strafrecht"],
    "criminal_law": ["strafrecht"],
    "CONTRACT_LAW": ["verbintenissenrecht", "contractenrecht"],
    "contract_law": ["verbintenissenrecht", "contractenrecht"],
    "PROPERTY_LAW": ["huurrecht", "vastgoedrecht"],
    "property_law": ["huurrecht", "vastgoedrecht"],
    "real_estate_law": ["huurrecht", "vastgoedrecht"],
    "EMPLOYMENT_LAW": ["arbeidsrecht", "ontslag", "arbeidsovereenkomst"],
    "employment_law": ["arbeidsrecht", "ontslag", "arbeidsovereenkomst"],
    "ADMINISTRATIVE_LAW": ["bestuursrecht", "bezwaar", "beroep"],
    "administrative_law": ["bestuursrecht", "bezwaar", "beroep"],
    "IMMIGRATION_LAW": ["vreemdelingenrecht", "asielrecht"],
    "immigration_law": ["vreemdelingenrecht", "asielrecht"],
    "TAX_LAW": ["belastingrecht"],
    "tax_law": ["belastingrecht"],
    "DEBT_COLLECTION": ["incasso", "schulden"],
    "debt_collection": ["incasso", "schulden"],
    "GENERAL_LAW": ["algemene praktijk"],
    "general_law": ["algemene praktijk"],
}


KEYWORD_TO_FIELD = {
    "ontslag": "EMPLOYMENT_LAW",
    "arbeid": "EMPLOYMENT_LAW",
    "werkgever": "EMPLOYMENT_LAW",
    "discriminatie": "EMPLOYMENT_LAW",
    "contract": "CONTRACT_LAW",
    "overeenkomst": "CONTRACT_LAW",
    "huur": "PROPERTY_LAW",
    "verhuur": "PROPERTY_LAW",
    "woning": "PROPERTY_LAW",
    "echtscheiding": "FAMILY_LAW",
    "alimentatie": "FAMILY_LAW",
    "gezag": "FAMILY_LAW",
    "straf": "CRIMINAL_LAW",
    "verdachte": "CRIMINAL_LAW",
    "bezwaar": "ADMINISTRATIVE_LAW",
    "beroep": "ADMINISTRATIVE_LAW",
    "bestuursorgaan": "ADMINISTRATIVE_LAW",
    "cak": "ADMINISTRATIVE_LAW",
    "belasting": "TAX_LAW",
    "asiel": "IMMIGRATION_LAW",
    "verblijf": "IMMIGRATION_LAW",
}


@dataclass
class NovaSearchCriteria:
    legal_fields: List[str] = field(default_factory=list)
    nova_subject_terms: List[str] = field(default_factory=list)
    nova_subject_ids: List[int] = field(default_factory=list)
    case_summary: str = ""
    case_description: str = ""
    postcode_or_city: str = ""
    radius_km: int = 50
    requires_financed_legal_aid: bool = False
    prefer_specialization_association: bool = True
    lawyer_name: str = ""
    language: str = "nl"
    urgency: str = "normal"
    complexity: str = "medium"
    evidence_topics: List[str] = field(default_factory=list)
    max_results: int = 30


class NovaDirectoryClient:
    """Read-only adapter for the public NOvA lawyer finder."""

    def __init__(self, base_url: str = NOVA_BASE_URL, timeout_seconds: int = 15):
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def build_search_url(self, criteria: NovaSearchCriteria) -> str:
        params: Dict[str, Any] = {"type": "advocaten"}
        subject_ids = criteria.nova_subject_ids or self._known_subject_ids(criteria)
        if subject_ids:
            params["filters[rechtsgebieden]"] = json.dumps(subject_ids, separators=(",", ":"))
        if criteria.lawyer_name:
            params["advocaat"] = criteria.lawyer_name
        if criteria.postcode_or_city:
            params["locatie[adres]"] = criteria.postcode_or_city
        if criteria.radius_km:
            params["locatie[straal]"] = str(criteria.radius_km)
        if criteria.prefer_specialization_association:
            params["filters[specialisatie]"] = "1"
        if criteria.requires_financed_legal_aid:
            params["filters[toevoegingen]"] = "1"
        suffix = f"?{urlencode(params)}" if params else ""
        return f"{self.base_url}/zoeken{suffix}"

    def search(
        self,
        criteria: NovaSearchCriteria,
        records: Optional[Sequence[Dict[str, Any]]] = None,
    ) -> Tuple[List[Dict[str, Any]], str, Dict[str, Any]]:
        if records is not None:
            return (
                [normalize_lawyer_record(record) for record in records],
                "provided",
                {"source": "provided_candidates"},
            )

        configured_records = self._load_configured_records()
        if configured_records:
            return (
                [normalize_lawyer_record(record) for record in configured_records],
                "configured_cache",
                {"source": "configured_cache", "cache_path_configured": True},
            )

        return self._search_public_directory(criteria)

    def _search_public_directory(
        self,
        criteria: NovaSearchCriteria,
    ) -> Tuple[List[Dict[str, Any]], str, Dict[str, Any]]:
        criteria.nova_subject_ids = self._resolve_subject_ids(criteria)
        retrieved_at = datetime.now(timezone.utc).isoformat()
        search_url = self.build_search_url(criteria)
        if not criteria.nova_subject_ids and not criteria.lawyer_name:
            return [], "live_directory_unavailable", {
                "source": "NOvA public lawyer finder",
                "retrieved_at": retrieved_at,
                "search_url": search_url,
                "reason": "No official legal-field filter could be resolved for this case.",
            }

        params: Dict[str, Any] = {
            "type": "advocaten",
            "limiet": str(min(max(criteria.max_results, 1), 30)),
            "pagina": "1",
        }
        if criteria.nova_subject_ids:
            params["filters[rechtsgebieden]"] = json.dumps(criteria.nova_subject_ids, separators=(",", ":"))
        if criteria.lawyer_name:
            params["q"] = criteria.lawyer_name
        if criteria.prefer_specialization_association:
            params["filters[specialisatie]"] = "1"
        if criteria.requires_financed_legal_aid:
            params["filters[toevoegingen]"] = "1"

        fetch_url = f"{self.base_url}/zoeken/fetch?{urlencode(params)}"
        try:
            response = requests.get(
                fetch_url,
                headers={"Accept": "application/json", "Referer": f"{self.base_url}/zoeken"},
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json()
            html = payload.get("html", "") if isinstance(payload, dict) else ""
        except (requests.RequestException, ValueError) as exc:
            return [], "live_directory_unavailable", {
                "source": "NOvA public lawyer finder",
                "retrieved_at": retrieved_at,
                "search_url": search_url,
                "fetch_url": fetch_url,
                "reason": f"Public directory request failed: {exc}",
            }

        candidates = self._parse_public_results(html, criteria, search_url, retrieved_at)
        return candidates, "nova_public_directory", {
            "source": "NOvA public lawyer finder",
            "retrieved_at": retrieved_at,
            "search_url": search_url,
            "fetch_url": fetch_url,
            "reported_total": payload.get("count") if isinstance(payload, dict) else None,
            "location_filter_applied": False,
            "location_filter_note": (
                "The live NOvA query applies legal-field, specialization, and legal-aid filters. "
                "Location/radius remain in the source link for user review because the public fetch endpoint "
                "requires an interactive location token."
            ) if criteria.postcode_or_city else "",
        }

    def _known_subject_ids(self, criteria: NovaSearchCriteria) -> List[int]:
        return [NOVA_FIELD_IDS[field_name] for field_name in criteria.legal_fields if field_name in NOVA_FIELD_IDS]

    def _resolve_subject_ids(self, criteria: NovaSearchCriteria) -> List[int]:
        known_ids = self._known_subject_ids(criteria)
        if known_ids:
            return dedupe_ints(known_ids)

        terms = criteria.nova_subject_terms or legal_fields_to_nova_terms(criteria.legal_fields)
        for term in terms[:3]:
            try:
                response = requests.get(
                    f"{self.base_url}/api/search/rechtsgebieden",
                    params={"filter": term},
                    headers={"Accept": "application/json"},
                    timeout=self.timeout_seconds,
                )
                response.raise_for_status()
                payload = response.json()
            except (requests.RequestException, ValueError):
                continue
            if not isinstance(payload, dict):
                continue
            ids = [item.get("id") for item in payload.values() if isinstance(item, dict) and item.get("id")]
            if ids:
                return dedupe_ints(ids[:3])
        return []

    def _parse_public_results(
        self,
        html: str,
        criteria: NovaSearchCriteria,
        search_url: str,
        retrieved_at: str,
    ) -> List[Dict[str, Any]]:
        soup = BeautifulSoup(html or "", "html.parser")
        candidates: List[Dict[str, Any]] = []
        for result in soup.select("div.result.advocaten"):
            profile = result.select_one('a[href*="/advocaten/"]')
            if not profile:
                continue
            office = result.select_one('a[href*="/kantoren/"]')
            strong_text = [node.get_text(" ", strip=True) for node in result.select(".heading strong")]
            fields = dedupe([node.get_text(" ", strip=True) for node in result.select(".jurisdictions .label")])
            associations = dedupe([
                node.get_text(" ", strip=True)
                for node in result.select(".specialisations li")
                if node.get_text(" ", strip=True).lower() != "geen"
            ])
            profile_path = profile.get("href") or ""
            profile_url = profile_path if profile_path.startswith("http") else f"{self.base_url}{profile_path}"
            lawyer_id = profile_path.rstrip("/").split("/")[-1] or profile_url
            candidates.append(normalize_lawyer_record({
                "id": lawyer_id,
                "lawyer_id": lawyer_id,
                "name": profile.get_text(" ", strip=True),
                "firm_name": office.get_text(" ", strip=True) if office else "",
                "city": strong_text[-1].title() if strong_text else "",
                "legal_fields": fields,
                "nova_rechtsgebieden": fields,
                "specialization_associations": associations,
                "financed_legal_aid": criteria.requires_financed_legal_aid,
                "profile_url": profile_url,
                "source_url": profile_url,
                "source_search_url": search_url,
                "source_retrieved_at": retrieved_at,
                "source_name": "NOvA public lawyer finder",
                "is_active": True,
            }))
        return candidates

    def _load_configured_records(self) -> List[Dict[str, Any]]:
        path = os.environ.get("NOVA_DIRECTORY_CACHE")
        if not path or not os.path.exists(path):
            return []

        import json

        with open(path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        if isinstance(payload, dict):
            payload = payload.get("lawyers", [])
        return payload if isinstance(payload, list) else []


class LawyerMatchingEngine:
    def __init__(self, directory_client: Optional[NovaDirectoryClient] = None):
        self.directory_client = directory_client or NovaDirectoryClient()

    def build_criteria(self, case_data: Dict[str, Any]) -> NovaSearchCriteria:
        description = " ".join(
            str(case_data.get(key, ""))
            for key in ("description", "case_description", "summary", "case_summary")
            if case_data.get(key)
        )
        legal_fields = normalize_legal_fields(
            case_data.get("legal_fields")
            or case_data.get("matched_fields")
            or infer_legal_fields(description, case_data.get("evidence_topics", []))
        )

        return NovaSearchCriteria(
            legal_fields=legal_fields,
            nova_subject_terms=dedupe(case_data.get("nova_subject_terms", [])),
            case_summary=str(case_data.get("summary") or case_data.get("case_summary") or ""),
            case_description=str(case_data.get("description") or case_data.get("case_description") or ""),
            postcode_or_city=str(
                case_data.get("postcode_or_city")
                or case_data.get("location")
                or case_data.get("city")
                or ""
            ),
            radius_km=int(case_data.get("radius_km") or case_data.get("search_radius_km") or 50),
            requires_financed_legal_aid=bool(
                case_data.get("requires_financed_legal_aid")
                or case_data.get("financed_legal_aid")
                or case_data.get("toevoeging")
            ),
            prefer_specialization_association=case_data.get("prefer_specialization_association", True) is not False,
            lawyer_name=str(case_data.get("lawyer_name") or ""),
            language=str(case_data.get("language") or "nl"),
            urgency=str(case_data.get("urgency") or "normal"),
            complexity=str(case_data.get("complexity") or "medium"),
            evidence_topics=dedupe(case_data.get("evidence_topics", []) + case_data.get("topics", [])),
            max_results=int(case_data.get("max_results") or 30),
        )

    def match(
        self,
        case_data: Dict[str, Any],
        records: Optional[Sequence[Dict[str, Any]]] = None,
        max_results: Optional[int] = None,
    ) -> Dict[str, Any]:
        criteria = self.build_criteria(case_data or {})
        if max_results:
            criteria.max_results = int(max_results)

        candidates, source_mode, source_details = self.directory_client.search(criteria, records=records)
        search_url = self.directory_client.build_search_url(criteria)
        ranked = []
        for candidate in candidates:
            scored = self._score_candidate(candidate, criteria)
            if scored:
                ranked.append(scored)

        ranked.sort(key=lambda lawyer: lawyer["match_score"], reverse=True)
        return {
            "matched_lawyers": ranked[: criteria.max_results],
            "search_criteria": criteria_to_dict(criteria),
            "source_mode": source_mode,
            "source_details": source_details,
            "nova_search_url": search_url,
            "result_count": len(ranked[: criteria.max_results]),
            "available_count": len(candidates),
        }

    def _score_candidate(self, lawyer: Dict[str, Any], criteria: NovaSearchCriteria) -> Optional[Dict[str, Any]]:
        if not lawyer.get("is_active", True):
            return None

        distance = lawyer.get("distance_km")
        if distance is not None and criteria.radius_km and distance > criteria.radius_km:
            return None

        if criteria.requires_financed_legal_aid and not lawyer.get("financed_legal_aid"):
            return None

        candidate_fields = normalize_legal_fields(lawyer.get("legal_fields", []))
        subject_terms = set(term.lower() for term in criteria.nova_subject_terms or legal_fields_to_nova_terms(criteria.legal_fields))
        candidate_terms = set(term.lower() for term in lawyer.get("nova_rechtsgebieden", []))
        field_overlap = set(criteria.legal_fields) & set(candidate_fields)
        term_overlap = subject_terms & candidate_terms
        if criteria.legal_fields and not field_overlap and not term_overlap:
            return None

        legal_score = 45.0 if field_overlap else 25.0 if term_overlap else 0.0
        text_blob = " ".join(
            [
                criteria.case_summary,
                criteria.case_description,
                " ".join(criteria.evidence_topics),
            ]
        ).lower()
        lawyer_blob = " ".join(
            lawyer.get("nova_rechtsgebieden", [])
            + lawyer.get("legal_fields", [])
            + lawyer.get("specialization_associations", [])
        ).lower()
        topic_hits = [term for term in subject_terms if term and term in text_blob and term in lawyer_blob]
        keyword_score = min(15.0, len(topic_hits) * 5.0)

        if distance is None:
            location_score = 0.0
        else:
            location_score = max(0.0, 15.0 * (1 - min(distance, criteria.radius_km) / max(criteria.radius_km, 1)))

        specialization_score = 10.0 if lawyer.get("specialization_associations") else 0.0
        if not criteria.prefer_specialization_association:
            specialization_score *= 0.5

        legal_aid_score = 8.0 if lawyer.get("financed_legal_aid") else 0.0
        response_rate = lawyer.get("response_rate")
        acceptance_rate = lawyer.get("acceptance_rate")
        response_score = 0.0
        if isinstance(response_rate, (int, float)) or isinstance(acceptance_rate, (int, float)):
            response_score = min(7.0, (float(response_rate or 0) * 4.0) + (float(acceptance_rate or 0) * 30.0))
        total_score = round(legal_score + keyword_score + location_score + specialization_score + legal_aid_score + response_score, 2)

        enriched = dict(lawyer)
        enriched.update(
            {
                "id": str(lawyer.get("id") or lawyer.get("lawyer_id")),
                "match_score": total_score,
                "relevance_score": round(total_score / 100, 3),
                "score_breakdown": {
                    "legal_area": round(legal_score, 2),
                    "case_terms": round(keyword_score, 2),
                    "location": round(location_score, 2),
                    "specialization": round(specialization_score, 2),
                    "financed_legal_aid": round(legal_aid_score, 2),
                    "responsiveness": round(response_score, 2),
                },
                "match_reasons": build_match_reasons(
                    lawyer,
                    field_overlap,
                    term_overlap,
                    topic_hits,
                    criteria,
                ),
                "filter_hits": {
                    "legal_fields": sorted(field_overlap),
                    "nova_terms": sorted(term_overlap),
                    "within_radius": distance <= criteria.radius_km if distance is not None else None,
                    "financed_legal_aid": bool(lawyer.get("financed_legal_aid")),
                    "specialization_association": bool(lawyer.get("specialization_associations")),
                },
                "nova_search_url": self.directory_client.build_search_url(criteria),
            }
        )
        return enriched


def build_match_reasons(
    lawyer: Dict[str, Any],
    field_overlap: Iterable[str],
    term_overlap: Iterable[str],
    topic_hits: Iterable[str],
    criteria: NovaSearchCriteria,
) -> List[str]:
    reasons = []
    if field_overlap:
        reasons.append(f"Matches legal field: {', '.join(sorted(field_overlap))}")
    if term_overlap:
        reasons.append(f"Matches NOvA subject filter: {', '.join(sorted(term_overlap))}")
    if topic_hits:
        reasons.append(f"Matches case evidence terms: {', '.join(sorted(set(topic_hits)))}")
    if lawyer.get("distance_km") is not None:
        reasons.append(f"{lawyer['distance_km']} km from {criteria.postcode_or_city or 'case location'}")
    if lawyer.get("financed_legal_aid"):
        reasons.append("Accepts financed legal aid/toevoeging")
    if lawyer.get("specialization_associations"):
        reasons.append("Member of a specialization association")
    return reasons or ["General practice candidate for manual review"]


def criteria_to_dict(criteria: NovaSearchCriteria) -> Dict[str, Any]:
    return {
        "legal_fields": criteria.legal_fields,
        "nova_subject_terms": criteria.nova_subject_terms or legal_fields_to_nova_terms(criteria.legal_fields),
        "nova_subject_ids": criteria.nova_subject_ids,
        "postcode_or_city": criteria.postcode_or_city,
        "radius_km": criteria.radius_km,
        "requires_financed_legal_aid": criteria.requires_financed_legal_aid,
        "prefer_specialization_association": criteria.prefer_specialization_association,
        "lawyer_name": criteria.lawyer_name,
        "language": criteria.language,
        "urgency": criteria.urgency,
        "complexity": criteria.complexity,
        "evidence_topics": criteria.evidence_topics,
        "max_results": criteria.max_results,
    }


def legal_fields_to_nova_terms(legal_fields: Sequence[str]) -> List[str]:
    terms: List[str] = []
    for field_name in legal_fields:
        terms.extend(FIELD_TO_NOVA_TERMS.get(field_name, []))
        terms.extend(FIELD_TO_NOVA_TERMS.get(field_name.upper(), []))
    return dedupe(terms)


def infer_legal_fields(text: str, evidence_topics: Sequence[str]) -> List[str]:
    haystack = f"{text} {' '.join(evidence_topics)}".lower()
    inferred = []
    for keyword, field_name in KEYWORD_TO_FIELD.items():
        if keyword in haystack:
            inferred.append(field_name)
    return dedupe(inferred) or ["GENERAL_LAW"]


def normalize_legal_fields(values: Any) -> List[str]:
    if not values:
        return []
    if isinstance(values, str):
        values = [values]
    normalized = []
    for value in values:
        field_name = str(value).strip()
        if not field_name:
            continue
        key = field_name.upper().replace(" ", "_").replace("-", "_")
        aliases = {
            "ARBEIDSRECHT": "EMPLOYMENT_LAW",
            "EMPLOYMENT": "EMPLOYMENT_LAW",
            "HUURRECHT": "PROPERTY_LAW",
            "VASTGOEDRECHT": "PROPERTY_LAW",
            "FAMILY": "FAMILY_LAW",
            "PERSONEN_EN_FAMILIERECHT": "FAMILY_LAW",
            "BESTUURSRECHT": "ADMINISTRATIVE_LAW",
            "STRAFRECHT": "CRIMINAL_LAW",
        }
        normalized.append(aliases.get(key, key))
    return dedupe(normalized)


def normalize_lawyer_record(record: Dict[str, Any]) -> Dict[str, Any]:
    name = record.get("name") or " ".join(
        part for part in [record.get("first_name"), record.get("last_name")] if part
    )
    first_name, last_name = split_name(name)
    lawyer_id = record.get("lawyer_id") or record.get("id") or record.get("nova_id")
    legal_fields = normalize_legal_fields(
        record.get("legal_fields")
        or record.get("specializations")
        or [record.get("specialization")]
    )
    return {
        **record,
        "id": str(record.get("id") or lawyer_id),
        "lawyer_id": lawyer_id,
        "nova_id": record.get("nova_id") or str(lawyer_id or ""),
        "name": name,
        "first_name": record.get("first_name") or first_name,
        "last_name": record.get("last_name") or last_name,
        "email": record.get("email") or "",
        "phone": record.get("phone") or "",
        "firm_name": record.get("firm_name") or record.get("firm") or "",
        "city": record.get("city") or "",
        "postcode": record.get("postcode") or "",
        "distance_km": record.get("distance_km"),
        "legal_fields": legal_fields,
        "nova_rechtsgebieden": dedupe(record.get("nova_rechtsgebieden", []) or legal_fields_to_nova_terms(legal_fields)),
        "specialization_associations": dedupe(record.get("specialization_associations", [])),
        "financed_legal_aid": bool(record.get("financed_legal_aid") or record.get("toevoegingen")),
        "languages": dedupe(record.get("languages", [])),
        "profile_url": record.get("profile_url") or "",
        "is_active": record.get("is_active", True),
        "response_rate": _optional_rate(record.get("response_rate")),
        "acceptance_rate": _optional_rate(record.get("acceptance_rate")),
    }


def split_name(name: str) -> Tuple[str, str]:
    parts = str(name or "").strip().split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def dedupe(values: Any) -> List[str]:
    if not values:
        return []
    if isinstance(values, str):
        values = [values]
    seen = set()
    result = []
    for value in values:
        text = str(value).strip()
        key = text.lower()
        if text and key not in seen:
            seen.add(key)
            result.append(text)
    return result


def dedupe_ints(values: Iterable[Any]) -> List[int]:
    result: List[int] = []
    for value in values:
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            continue
        if parsed not in result:
            result.append(parsed)
    return result


def _optional_rate(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
