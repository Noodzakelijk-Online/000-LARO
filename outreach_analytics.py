"""
Outreach analytics for the LARO outreach workspace.

The builder accepts the in-memory campaign and matching caches used by app.py,
then returns a stable dashboard payload for the Outreach overview tab.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, List, Mapping, Optional


def _safe_list(value: Any) -> List[Dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []


def _matched_lawyers(lawyer_match_result: Optional[Mapping[str, Any]]) -> List[Dict[str, Any]]:
    return _safe_list((lawyer_match_result or {}).get("matched_lawyers"))


def _matched_targets(target_match_results: Optional[Mapping[str, Any]], key: str) -> List[Dict[str, Any]]:
    matches = target_match_results or {}
    candidates = [key]
    if key == "organizations":
        candidates.append("organization")
    if key == "organization":
        candidates.append("organizations")

    for candidate in candidates:
        result = matches.get(candidate)
        if isinstance(result, Mapping):
            return _safe_list(result.get("matched_targets"))
    return []


def _record_identity(record: Mapping[str, Any]) -> str:
    for key in ("target_id", "lawyer_id", "lawyer_email", "email", "outreach_id"):
        value = record.get(key)
        if value is not None:
            return str(value)
    return ""


def _response_type(response: Mapping[str, Any]) -> str:
    return str(response.get("response_type") or response.get("status") or "").lower()


def _category_stats(
    label: str,
    matches: Iterable[Mapping[str, Any]],
    records: Iterable[Mapping[str, Any]],
    responses: Iterable[Mapping[str, Any]],
) -> Dict[str, Any]:
    matched = len(list(matches))
    category_records = [
        record for record in records
        if str(record.get("target_type") or record.get("category") or label).lower() in {label, label.rstrip("s")}
    ]
    if label == "lawyers":
        category_records = [
            record for record in records
            if not record.get("target_type") or str(record.get("target_type")).lower() in {"lawyer", "lawyers"}
        ]

    contacted_ids = {_record_identity(record) for record in category_records if _record_identity(record)}
    response_ids = {str(response.get("lawyer_id") or response.get("target_id") or response.get("outreach_id") or "") for response in responses}
    positive_ids = {
        str(response.get("lawyer_id") or response.get("target_id") or response.get("outreach_id") or "")
        for response in responses
        if _response_type(response) in {"pre_assessment_positive", "positive", "accepted", "interested"}
    }

    if label != "lawyers":
        response_ids = set()
        positive_ids = set()

    contacted = len(contacted_ids)
    responded = len(response_ids - {""})
    accepted = len(positive_ids - {""})
    return {
        "label": label,
        "matched": matched,
        "contacted": contacted,
        "responded": responded,
        "accepted": accepted,
        "ready": max(matched - contacted, 0),
        "progress_percent": round((contacted / matched) * 100, 1) if matched else 0.0,
    }


def _average_response_hours(records: List[Dict[str, Any]], responses: List[Dict[str, Any]]) -> Optional[float]:
    record_by_outreach = {
        str(record.get("outreach_id")): record
        for record in records
        if record.get("outreach_id") is not None
    }
    intervals = []
    for response in responses:
        record = record_by_outreach.get(str(response.get("outreach_id")))
        if not record:
            continue
        sent_at = record.get("sent_timestamp")
        response_at = response.get("timestamp") or response.get("response_timestamp")
        try:
            sent_dt = datetime.fromisoformat(str(sent_at))
            response_dt = datetime.fromisoformat(str(response_at))
        except (TypeError, ValueError):
            continue
        intervals.append((response_dt - sent_dt).total_seconds() / 3600)
    if not intervals:
        return None
    return round(sum(intervals) / len(intervals), 1)


def _history(records: List[Dict[str, Any]], matches_by_category: Mapping[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    if records:
        entries = []
        for record in records[-8:]:
            entries.append({
                "title": record.get("lawyer_name") or record.get("target_name") or "Outreach target",
                "category": record.get("target_type") or "lawyers",
                "status": record.get("status") or "sent",
                "timestamp": record.get("sent_timestamp") or record.get("created_at"),
                "detail": record.get("subject") or "Initial outreach sent",
            })
        return list(reversed(entries))

    entries = []
    for category, matches in matches_by_category.items():
        for target in matches[:2]:
            entries.append({
                "title": target.get("name") or target.get("lawyer_name") or "Matched target",
                "category": category,
                "status": "ready",
                "timestamp": None,
                "detail": "Matched and ready for outreach",
            })
    return entries[:6]


def _insights(total_matched: int, contacted: int, responses: int, accepted: int, categories: Mapping[str, Dict[str, Any]]) -> List[Dict[str, str]]:
    insights = []
    if total_matched and not contacted:
        insights.append({
            "title": "Outreach ready to start",
            "detail": f"{total_matched} matched targets are ready for first contact.",
            "tone": "info",
        })
    if categories.get("media", {}).get("matched", 0):
        insights.append({
            "title": "Media shortlist available",
            "detail": "Use the Media tab to review public-interest and consumer program matches.",
            "tone": "success",
        })
    if categories.get("organizations", {}).get("matched", 0):
        insights.append({
            "title": "Organization support available",
            "detail": "Advocacy groups are ready to be compared by topic, impact, and actionability.",
            "tone": "success",
        })
    if responses and accepted:
        insights.append({
            "title": "Positive response detected",
            "detail": f"{accepted} target has accepted or shown interest so far.",
            "tone": "success",
        })
    if contacted and not responses:
        insights.append({
            "title": "Awaiting responses",
            "detail": "Follow response rate and follow-up timing from this overview.",
            "tone": "warning",
        })
    if not insights:
        insights.append({
            "title": "Outreach starting soon",
            "detail": "Run matching for lawyers, media, and organizations to populate this overview.",
            "tone": "info",
        })
    return insights[:4]


def build_outreach_analytics(
    case_id: int,
    outreach_campaign: Optional[Any] = None,
    lawyer_match_result: Optional[Mapping[str, Any]] = None,
    target_match_results: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    records = _safe_list(getattr(outreach_campaign, "outreach_records", []))
    responses = _safe_list(getattr(outreach_campaign, "responses", []))
    lawyers = _matched_lawyers(lawyer_match_result)
    media = _matched_targets(target_match_results, "media")
    organizations = _matched_targets(target_match_results, "organizations")
    matches_by_category = {
        "lawyers": lawyers,
        "media": media,
        "organizations": organizations,
    }

    categories = {
        name: _category_stats(name, matches, records, responses)
        for name, matches in matches_by_category.items()
    }
    matched_targets = sum(category["matched"] for category in categories.values())
    contacted_targets = len({_record_identity(record) for record in records if _record_identity(record)})
    responses_received = len(responses)
    accepted_targets = len([
        response for response in responses
        if _response_type(response) in {"pre_assessment_positive", "positive", "accepted", "interested"}
    ])
    response_rate = round((responses_received / contacted_targets) * 100, 1) if contacted_targets else 0.0
    acceptance_rate = round((accepted_targets / contacted_targets) * 100, 1) if contacted_targets else 0.0

    return {
        "case_id": case_id,
        "total_outreaches": len(records),
        "matched_targets": matched_targets,
        "contacted_targets": contacted_targets,
        "responses_received": responses_received,
        "accepted_targets": accepted_targets,
        "response_rate": response_rate,
        "acceptance_rate": acceptance_rate,
        "avg_response_time_hours": _average_response_hours(records, responses),
        "categories": categories,
        "history": _history(records, matches_by_category),
        "insights": _insights(matched_targets, contacted_targets, responses_received, accepted_targets, categories),
    }
