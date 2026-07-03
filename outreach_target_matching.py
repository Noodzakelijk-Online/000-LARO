"""
Outreach target matching for media and organizations.

This is the non-lawyer side of LARO outreach: media programs, journalists,
advocacy groups, lobbies, and civil-society organizations that can create
pressure, amplify a case, or provide practical support.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

from lawyer_matching import dedupe, infer_legal_fields, normalize_legal_fields


@dataclass
class OutreachCriteria:
    target_type: str = "media"
    legal_fields: List[str] = field(default_factory=list)
    case_summary: str = ""
    case_description: str = ""
    evidence_topics: List[str] = field(default_factory=list)
    urgency: str = "normal"
    desired_outcome: str = ""
    region: str = "Netherlands"
    max_results: int = 30
    include_low_confidence: bool = False


class OutreachDirectoryClient:
    def __init__(self, cache_env: str = "OUTREACH_TARGET_CACHE"):
        self.cache_env = cache_env

    def search(
        self,
        criteria: OutreachCriteria,
        records: Optional[Sequence[Dict[str, Any]]] = None,
    ) -> Tuple[List[Dict[str, Any]], str]:
        if records is not None:
            return [normalize_outreach_target(record) for record in records], "provided"

        configured_records = self._load_configured_records()
        if configured_records:
            return [normalize_outreach_target(record) for record in configured_records], "configured_cache"

        return [], "no_live_data"

    def _load_configured_records(self) -> List[Dict[str, Any]]:
        path = os.environ.get(self.cache_env)
        if not path or not os.path.exists(path):
            return []

        with open(path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        if isinstance(payload, dict):
            payload = payload.get("targets", [])
        return payload if isinstance(payload, list) else []


class OutreachTargetEngine:
    def __init__(self, directory_client: Optional[OutreachDirectoryClient] = None):
        self.directory_client = directory_client or OutreachDirectoryClient()

    def build_criteria(self, case_data: Dict[str, Any]) -> OutreachCriteria:
        text = " ".join(
            str(case_data.get(key, ""))
            for key in ("description", "case_description", "summary", "case_summary", "desired_outcome")
            if case_data.get(key)
        )
        legal_fields = normalize_legal_fields(
            case_data.get("legal_fields")
            or case_data.get("matched_fields")
            or infer_legal_fields(text, case_data.get("evidence_topics", []))
        )

        return OutreachCriteria(
            target_type=str(case_data.get("target_type") or case_data.get("category") or "media").lower(),
            legal_fields=legal_fields,
            case_summary=str(case_data.get("summary") or case_data.get("case_summary") or ""),
            case_description=str(case_data.get("description") or case_data.get("case_description") or ""),
            evidence_topics=dedupe(case_data.get("evidence_topics", []) + case_data.get("topics", [])),
            urgency=str(case_data.get("urgency") or "normal"),
            desired_outcome=str(case_data.get("desired_outcome") or ""),
            region=str(case_data.get("region") or case_data.get("location") or "Netherlands"),
            max_results=int(case_data.get("max_results") or 30),
            include_low_confidence=bool(case_data.get("include_low_confidence", False)),
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
        ranked = []
        for target in candidates:
            scored = self._score_target(target, criteria)
            if scored:
                ranked.append(scored)
        ranked.sort(key=lambda item: item["match_score"], reverse=True)

        return {
            "matched_targets": ranked[: criteria.max_results],
            "target_type": criteria.target_type,
            "search_criteria": criteria_to_dict(criteria),
            "source_mode": source_mode,
            "result_count": len(ranked[: criteria.max_results]),
            "available_count": len(candidates),
        }

    def _score_target(self, target: Dict[str, Any], criteria: OutreachCriteria) -> Optional[Dict[str, Any]]:
        if not target.get("is_active", True):
            return None
        if criteria.target_type != "all" and target.get("target_type") != criteria.target_type:
            return None
        if target.get("confidence", "medium") == "low" and not criteria.include_low_confidence:
            return None

        case_terms = searchable_terms(criteria)
        target_terms = searchable_terms(target)
        topic_hits = sorted(set(case_terms) & set(target_terms))
        field_overlap = sorted(set(criteria.legal_fields) & set(normalize_legal_fields(target.get("legal_fields", []))))

        topic_score = min(35.0, len(topic_hits) * 7.0)
        field_score = 20.0 if field_overlap else 8.0 if target.get("target_type") == "media" else 0.0
        impact_score = min(15.0, float(target.get("influence_score", 0.5)) * 15.0)
        action_score = min(15.0, float(target.get("actionability_score", 0.5)) * 15.0)
        urgency_score = urgency_fit_score(target, criteria)
        confidence_score = {"high": 5.0, "medium": 3.0, "low": 1.0}.get(target.get("confidence", "medium"), 3.0)

        if not topic_hits and not field_overlap and target.get("target_type") != "media":
            return None

        total_score = round(topic_score + field_score + impact_score + action_score + urgency_score + confidence_score, 2)
        enriched = dict(target)
        enriched.update(
            {
                "match_score": total_score,
                "relevance_score": round(total_score / 100, 3),
                "score_breakdown": {
                    "topics": round(topic_score, 2),
                    "legal_field": round(field_score, 2),
                    "impact": round(impact_score, 2),
                    "actionability": round(action_score, 2),
                    "urgency": round(urgency_score, 2),
                    "confidence": round(confidence_score, 2),
                },
                "match_reasons": build_reasons(target, topic_hits, field_overlap),
                "filter_hits": {
                    "topics": topic_hits,
                    "legal_fields": field_overlap,
                    "target_type": target.get("target_type"),
                    "confidence": target.get("confidence"),
                },
            }
        )
        return enriched


def criteria_to_dict(criteria: OutreachCriteria) -> Dict[str, Any]:
    return {
        "target_type": criteria.target_type,
        "legal_fields": criteria.legal_fields,
        "evidence_topics": criteria.evidence_topics,
        "urgency": criteria.urgency,
        "desired_outcome": criteria.desired_outcome,
        "region": criteria.region,
        "max_results": criteria.max_results,
        "include_low_confidence": criteria.include_low_confidence,
    }


def normalize_outreach_target(record: Dict[str, Any]) -> Dict[str, Any]:
    target_id = record.get("id") or record.get("target_id") or slugify(record.get("name", "target"))
    target_type = str(record.get("target_type") or record.get("category") or "organization").lower()
    return {
        **record,
        "id": str(target_id),
        "target_id": str(target_id),
        "target_type": "organization" if target_type in {"org", "organisations", "organizations"} else target_type,
        "name": str(record.get("name") or target_id),
        "subtype": str(record.get("subtype") or ""),
        "parent_org": str(record.get("parent_org") or ""),
        "description": str(record.get("description") or ""),
        "topics": dedupe(record.get("topics", [])),
        "legal_fields": normalize_legal_fields(record.get("legal_fields", [])),
        "audience": dedupe(record.get("audience", [])),
        "channels": dedupe(record.get("channels", [])),
        "region": str(record.get("region") or "Netherlands"),
        "url": str(record.get("url") or ""),
        "contact_url": str(record.get("contact_url") or record.get("url") or ""),
        "source_url": str(record.get("source_url") or record.get("url") or ""),
        "influence_score": float(record.get("influence_score", 0.5)),
        "actionability_score": float(record.get("actionability_score", 0.5)),
        "confidence": str(record.get("confidence") or "medium"),
        "is_active": record.get("is_active", True),
    }


def searchable_terms(data: Any) -> List[str]:
    if isinstance(data, OutreachCriteria):
        values = data.legal_fields + data.evidence_topics + [
            data.case_summary,
            data.case_description,
            data.desired_outcome,
            data.region,
        ]
    elif isinstance(data, dict):
        values = (
            data.get("topics", [])
            + data.get("legal_fields", [])
            + data.get("audience", [])
            + data.get("channels", [])
            + [
                data.get("name", ""),
                data.get("description", ""),
                data.get("subtype", ""),
                data.get("region", ""),
            ]
        )
    else:
        values = []

    terms: List[str] = []
    for value in values:
        if isinstance(value, str):
            terms.extend(tokenize(value))
        else:
            terms.extend(tokenize(str(value)))
    return dedupe(terms)


def tokenize(text: str) -> List[str]:
    separators = ",.;:/()[]{}|_-"
    cleaned = str(text or "").lower()
    for separator in separators:
        cleaned = cleaned.replace(separator, " ")
    stop = {"and", "the", "een", "het", "de", "van", "voor", "met", "law", "recht"}
    return [word for word in cleaned.split() if len(word) > 2 and word not in stop]


def urgency_fit_score(target: Dict[str, Any], criteria: OutreachCriteria) -> float:
    if criteria.urgency.lower() in {"high", "urgent", "critical"}:
        if "breaking" in target.get("channels", []) or target.get("target_type") == "media":
            return 10.0
        return 6.0
    if target.get("target_type") == "organization":
        return 8.0
    return 6.0


def build_reasons(target: Dict[str, Any], topic_hits: List[str], field_overlap: List[str]) -> List[str]:
    reasons = []
    if topic_hits:
        reasons.append(f"Matches case topics: {', '.join(topic_hits[:5])}")
    if field_overlap:
        reasons.append(f"Matches legal field: {', '.join(field_overlap)}")
    if target.get("target_type") == "media":
        reasons.append(f"Media route: {target.get('subtype') or 'newsroom'}")
    if target.get("target_type") == "organization":
        reasons.append(f"Support route: {target.get('subtype') or 'advocacy'}")
    if target.get("contact_url"):
        reasons.append("Has a direct contact or source URL")
    return reasons


def slugify(value: str) -> str:
    return "-".join(tokenize(value)) or "target"


def sample_outreach_targets() -> List[Dict[str, Any]]:
    return [
        {
            "id": "media-radar",
            "target_type": "media",
            "name": "Radar",
            "subtype": "consumer program",
            "parent_org": "AVROTROS",
            "description": "Consumer affairs platform and TV program covering consumer problems, companies, services, and public-interest complaints.",
            "topics": ["consumer", "companies", "contracts", "housing", "healthcare", "privacy", "misleading claims"],
            "legal_fields": ["CONTRACT_LAW", "PROPERTY_LAW", "ADMINISTRATIVE_LAW"],
            "audience": ["consumers", "public"],
            "channels": ["television", "web", "forum", "panel", "breaking"],
            "url": "https://radar.avrotros.nl/",
            "contact_url": "https://radar.avrotros.nl/tip-de-redactie",
            "source_url": "https://radar.avrotros.nl/",
            "influence_score": 0.92,
            "actionability_score": 0.86,
            "confidence": "high",
        },
        {
            "id": "media-nieuwsuur",
            "target_type": "media",
            "name": "Nieuwsuur",
            "subtype": "current affairs program",
            "parent_org": "NOS/NTR",
            "description": "Current affairs program for public-interest cases, administrative failures, politics, policy, and systemic problems.",
            "topics": ["administrative", "government", "policy", "fraud", "healthcare", "privacy", "public interest"],
            "legal_fields": ["ADMINISTRATIVE_LAW", "PROPERTY_LAW", "EMPLOYMENT_LAW"],
            "audience": ["national", "policy makers", "public"],
            "channels": ["television", "web", "breaking"],
            "url": "https://nos.nl/nieuwsuur",
            "contact_url": "https://nos.nl/nieuwsuur",
            "source_url": "https://nos.nl/nieuwsuur",
            "influence_score": 0.95,
            "actionability_score": 0.68,
            "confidence": "high",
        },
        {
            "id": "media-pointer",
            "target_type": "media",
            "name": "Pointer",
            "subtype": "investigative journalism",
            "parent_org": "KRO-NCRV",
            "description": "Investigative journalism platform that starts from public tips and data-driven research.",
            "topics": ["investigation", "data", "government", "healthcare", "housing", "privacy", "public interest"],
            "legal_fields": ["ADMINISTRATIVE_LAW", "PROPERTY_LAW", "CONTRACT_LAW"],
            "audience": ["national", "public"],
            "channels": ["web", "television", "research"],
            "url": "https://pointer.kro-ncrv.nl/",
            "contact_url": "https://pointer.kro-ncrv.nl/",
            "source_url": "https://pointer.kro-ncrv.nl/",
            "influence_score": 0.86,
            "actionability_score": 0.78,
            "confidence": "high",
        },
        {
            "id": "media-kassa",
            "target_type": "media",
            "name": "Kassa",
            "subtype": "consumer program",
            "parent_org": "BNNVARA",
            "description": "Consumer program for problems with products, services, companies, and consumer rights.",
            "topics": ["consumer", "contracts", "companies", "money", "housing", "healthcare"],
            "legal_fields": ["CONTRACT_LAW", "PROPERTY_LAW", "ADMINISTRATIVE_LAW"],
            "audience": ["consumers", "public"],
            "channels": ["television", "web", "consumer"],
            "url": "https://www.bnnvara.nl/kassa",
            "contact_url": "https://www.bnnvara.nl/kassa",
            "source_url": "https://www.bnnvara.nl/kassa",
            "influence_score": 0.84,
            "actionability_score": 0.76,
            "confidence": "medium",
        },
        {
            "id": "org-consumentenbond",
            "target_type": "organization",
            "name": "Consumentenbond",
            "subtype": "consumer advocacy",
            "description": "Consumer organization with legal advice, actions, claims, product tests, and collective pressure against companies.",
            "topics": ["consumer", "contracts", "claims", "misleading claims", "legal advice", "companies"],
            "legal_fields": ["CONTRACT_LAW", "PROPERTY_LAW", "ADMINISTRATIVE_LAW"],
            "audience": ["consumers"],
            "channels": ["advocacy", "claims", "legal advice", "campaigns"],
            "url": "https://www.consumentenbond.nl/",
            "contact_url": "https://www.consumentenbond.nl/contact",
            "source_url": "https://www.consumentenbond.nl/",
            "influence_score": 0.91,
            "actionability_score": 0.9,
            "confidence": "high",
        },
        {
            "id": "org-woonbond",
            "target_type": "organization",
            "name": "Woonbond",
            "subtype": "tenant advocacy",
            "description": "Tenant association and advocacy group for rental housing, landlord disputes, rent, maintenance, and housing policy.",
            "topics": ["housing", "rent", "tenants", "maintenance", "landlord", "social housing"],
            "legal_fields": ["PROPERTY_LAW", "ADMINISTRATIVE_LAW"],
            "audience": ["tenants"],
            "channels": ["advocacy", "campaigns", "legal support"],
            "url": "https://www.woonbond.nl/",
            "contact_url": "https://www.woonbond.nl/contact/",
            "source_url": "https://www.woonbond.nl/",
            "influence_score": 0.82,
            "actionability_score": 0.84,
            "confidence": "high",
        },
        {
            "id": "org-iederin",
            "target_type": "organization",
            "name": "Ieder(in)",
            "subtype": "disability and chronic illness advocacy",
            "description": "Network and advocacy organization for people with disabilities and chronic illness, including care, accessibility, money, work, and housing.",
            "topics": ["disability", "chronic illness", "healthcare", "accessibility", "wmo", "wlz", "money", "housing"],
            "legal_fields": ["ADMINISTRATIVE_LAW", "PROPERTY_LAW", "EMPLOYMENT_LAW"],
            "audience": ["people with disabilities", "patients", "local advocacy groups"],
            "channels": ["advocacy", "lobby", "panel", "meldpunt"],
            "url": "https://iederin.nl/",
            "contact_url": "https://iederin.nl/contact/",
            "source_url": "https://iederin.nl/",
            "influence_score": 0.84,
            "actionability_score": 0.87,
            "confidence": "high",
        },
        {
            "id": "org-bits-of-freedom",
            "target_type": "organization",
            "name": "Bits of Freedom",
            "subtype": "digital rights advocacy",
            "description": "Digital rights organization focused on online fundamental rights, privacy, freedom of communication, and technology power.",
            "topics": ["privacy", "technology", "data", "surveillance", "digital rights", "communication freedom"],
            "legal_fields": ["ADMINISTRATIVE_LAW", "CONTRACT_LAW"],
            "audience": ["public", "digital rights supporters"],
            "channels": ["advocacy", "campaigns", "press"],
            "url": "https://www.bitsoffreedom.nl/",
            "contact_url": "https://www.bitsoffreedom.nl/contact/",
            "source_url": "https://www.bitsoffreedom.nl/",
            "influence_score": 0.8,
            "actionability_score": 0.76,
            "confidence": "high",
        },
    ]
