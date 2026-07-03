"""
Lawyer matching engine for LARO.

The public NOvA lawyer finder is filter-driven: legal subject, lawyer name,
location/radius, specialization association membership, and financed legal aid.
This module models those filters explicitly and ranks candidate lawyers against
the case intelligence that LARO already builds from documents.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
from urllib.parse import urlencode


NOVA_BASE_URL = "https://zoekeenadvocaat.advocatenorde.nl"


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
    """Adapter around NOvA search semantics and local/remote candidate records."""

    def __init__(self, base_url: str = NOVA_BASE_URL):
        self.base_url = base_url.rstrip("/")

    def build_search_url(self, criteria: NovaSearchCriteria) -> str:
        params: Dict[str, Any] = {}
        terms = criteria.nova_subject_terms or legal_fields_to_nova_terms(criteria.legal_fields)
        if terms:
            params["filters[rechtsgebieden]"] = ",".join(terms)
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
    ) -> Tuple[List[Dict[str, Any]], str]:
        if records is not None:
            return [normalize_lawyer_record(record) for record in records], "provided"

        configured_records = self._load_configured_records()
        if configured_records:
            return [normalize_lawyer_record(record) for record in configured_records], "configured_cache"

        return [], "no_live_data"

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

        candidates, source_mode = self.directory_client.search(criteria, records=records)
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
        topic_hits = [term for term in subject_terms if term and (term in text_blob or term in lawyer_blob)]
        keyword_score = min(15.0, len(topic_hits) * 5.0)

        if distance is None:
            location_score = 7.0 if not criteria.postcode_or_city else 3.0
        else:
            location_score = max(0.0, 15.0 * (1 - min(distance, criteria.radius_km) / max(criteria.radius_km, 1)))

        specialization_score = 10.0 if lawyer.get("specialization_associations") else 0.0
        if not criteria.prefer_specialization_association:
            specialization_score *= 0.5

        legal_aid_score = 8.0 if lawyer.get("financed_legal_aid") else 2.0
        response_score = min(7.0, ((lawyer.get("response_rate", 0.2) * 4.0) + (lawyer.get("acceptance_rate", 0.05) * 30.0)))
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
                    "within_radius": distance is None or distance <= criteria.radius_km,
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
        "nova_id": record.get("nova_id") or f"NOVA-{lawyer_id}",
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
        "languages": dedupe(record.get("languages", ["nl"])),
        "profile_url": record.get("profile_url") or "",
        "is_active": record.get("is_active", True),
        "response_rate": float(record.get("response_rate", 0.25)),
        "acceptance_rate": float(record.get("acceptance_rate", 0.06)),
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


def sample_nova_records() -> List[Dict[str, Any]]:
    return [
        {
            "lawyer_id": 101,
            "nova_id": "NOVA-A101",
            "name": "Sanne de Vries",
            "email": "sanne.devries@example-law.nl",
            "phone": "+31 20 000 0101",
            "firm_name": "Amsterdam Arbeidsrecht Collectief",
            "city": "Amsterdam",
            "postcode": "1017",
            "distance_km": 6,
            "legal_fields": ["EMPLOYMENT_LAW"],
            "nova_rechtsgebieden": ["arbeidsrecht", "ontslag", "arbeidsovereenkomst"],
            "specialization_associations": ["VAAN"],
            "financed_legal_aid": True,
            "response_rate": 0.58,
            "acceptance_rate": 0.11,
            "profile_url": f"{NOVA_BASE_URL}/advocaat/sanne-de-vries",
        },
        {
            "lawyer_id": 102,
            "nova_id": "NOVA-A102",
            "name": "Murat Kaya",
            "email": "m.kaya@example-law.nl",
            "phone": "+31 30 000 0102",
            "firm_name": "Kaya Huurrecht",
            "city": "Utrecht",
            "postcode": "3511",
            "distance_km": 38,
            "legal_fields": ["PROPERTY_LAW"],
            "nova_rechtsgebieden": ["huurrecht", "vastgoedrecht"],
            "specialization_associations": ["VHA"],
            "financed_legal_aid": True,
            "response_rate": 0.42,
            "acceptance_rate": 0.09,
            "profile_url": f"{NOVA_BASE_URL}/advocaat/murat-kaya",
        },
        {
            "lawyer_id": 103,
            "nova_id": "NOVA-A103",
            "name": "Eva Jansen",
            "email": "eva.jansen@example-law.nl",
            "phone": "+31 10 000 0103",
            "firm_name": "Jansen Familie Advocatuur",
            "city": "Rotterdam",
            "postcode": "3011",
            "distance_km": 57,
            "legal_fields": ["FAMILY_LAW"],
            "nova_rechtsgebieden": ["personen- en familierecht", "alimentatie"],
            "specialization_associations": ["vFAS"],
            "financed_legal_aid": True,
            "response_rate": 0.51,
            "acceptance_rate": 0.08,
            "profile_url": f"{NOVA_BASE_URL}/advocaat/eva-jansen",
        },
        {
            "lawyer_id": 104,
            "nova_id": "NOVA-A104",
            "name": "Robert Mulder",
            "email": "r.mulder@example-law.nl",
            "phone": "+31 70 000 0104",
            "firm_name": "Mulder Bestuursrecht",
            "city": "The Hague",
            "postcode": "2511",
            "distance_km": 49,
            "legal_fields": ["ADMINISTRATIVE_LAW"],
            "nova_rechtsgebieden": ["bestuursrecht", "bezwaar", "beroep"],
            "specialization_associations": ["VAR"],
            "financed_legal_aid": True,
            "response_rate": 0.63,
            "acceptance_rate": 0.12,
            "profile_url": f"{NOVA_BASE_URL}/advocaat/robert-mulder",
        },
        {
            "lawyer_id": 105,
            "nova_id": "NOVA-A105",
            "name": "Lotte Bakker",
            "email": "l.bakker@example-law.nl",
            "phone": "+31 20 000 0105",
            "firm_name": "Bakker Sociaal Zekerheidsrecht",
            "city": "Amsterdam",
            "postcode": "1012",
            "distance_km": 4,
            "legal_fields": ["ADMINISTRATIVE_LAW"],
            "nova_rechtsgebieden": ["bestuursrecht", "socialezekerheidsrecht", "bezwaar"],
            "specialization_associations": ["SSZ"],
            "financed_legal_aid": True,
            "response_rate": 0.49,
            "acceptance_rate": 0.1,
            "profile_url": f"{NOVA_BASE_URL}/advocaat/lotte-bakker",
        },
        {
            "lawyer_id": 106,
            "nova_id": "NOVA-A106",
            "name": "Jeroen Smit",
            "email": "j.smit@example-law.nl",
            "phone": "+31 70 000 0106",
            "firm_name": "Smit Strafrecht",
            "city": "The Hague",
            "postcode": "2513",
            "distance_km": 51,
            "legal_fields": ["CRIMINAL_LAW"],
            "nova_rechtsgebieden": ["strafrecht"],
            "specialization_associations": ["NVSA"],
            "financed_legal_aid": False,
            "response_rate": 0.36,
            "acceptance_rate": 0.06,
            "profile_url": f"{NOVA_BASE_URL}/advocaat/jeroen-smit",
        },
    ]
