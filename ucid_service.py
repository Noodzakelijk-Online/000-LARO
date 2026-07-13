"""Unique case identifier service for LARO.

UCIDs let LARO connect the same legal matter across court numbers, agency
references, police references, document IDs, and other external sub-case IDs.
The service is intentionally small and local-first, using the existing Flask
SQLAlchemy session exposed by app.py.
"""

from __future__ import annotations

import uuid
from typing import Iterable, List, Sequence, Tuple

from app import db


class UCIDCase(db.Model):
    __tablename__ = "ucid_cases"

    ucid = db.Column(db.String(64), primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, default="")

    sub_ids = db.relationship(
        "UCIDSubCaseID",
        back_populates="case",
        cascade="all, delete-orphan",
        lazy=True,
    )


class UCIDSubCaseID(db.Model):
    __tablename__ = "ucid_sub_case_ids"

    id = db.Column(db.Integer, primary_key=True)
    ucid_id = db.Column(db.String(64), db.ForeignKey("ucid_cases.ucid"), nullable=False, index=True)
    sub_id_value = db.Column(db.String(255), nullable=False, index=True)
    source_party = db.Column(db.String(255), default="")

    case = db.relationship("UCIDCase", back_populates="sub_ids")


class UCIDService:
    """Manage LARO UCIDs and external sub-case identifiers."""

    def __init__(self, session):
        self.session = session

    def generate_ucid(self) -> str:
        return f"LARO-{uuid.uuid4()}"

    def create_case(self, details: dict) -> UCIDCase:
        case = UCIDCase(
            ucid=self.generate_ucid(),
            name=details.get("name") or details.get("title") or "Untitled case",
            description=details.get("description") or "",
        )
        self.session.add(case)
        self.session.commit()
        return case

    def link_sub_case_id(self, ucid: str, details: dict) -> UCIDSubCaseID:
        case = self.get_case_by_ucid(ucid)
        if case is None:
            raise ValueError(f"Case with UCID {ucid} not found")

        sub_id_value = details.get("sub_id_value")
        if not sub_id_value:
            raise ValueError("sub_id_value is required")

        existing = (
            self.session.query(UCIDSubCaseID)
            .filter_by(ucid_id=ucid, sub_id_value=sub_id_value)
            .one_or_none()
        )
        if existing:
            if details.get("source_party") and not existing.source_party:
                existing.source_party = details.get("source_party")
                self.session.commit()
            return existing

        sub_id = UCIDSubCaseID(
            ucid_id=ucid,
            sub_id_value=sub_id_value,
            source_party=details.get("source_party") or "",
        )
        self.session.add(sub_id)
        self.session.commit()
        return sub_id

    def get_case_by_ucid(self, ucid: str) -> UCIDCase | None:
        return self.session.get(UCIDCase, ucid)

    def get_cases_by_sub_id(self, sub_id_value: str) -> List[UCIDCase]:
        sub_ids = (
            self.session.query(UCIDSubCaseID)
            .filter_by(sub_id_value=sub_id_value)
            .all()
        )
        return [sub_id.case for sub_id in sub_ids if sub_id.case is not None]

    def get_sub_ids_for_ucid(self, ucid: str) -> List[UCIDSubCaseID]:
        return (
            self.session.query(UCIDSubCaseID)
            .filter_by(ucid_id=ucid)
            .order_by(UCIDSubCaseID.id.asc())
            .all()
        )

    def find_or_create_case_with_sub_ids(
        self,
        case_details: dict,
        document_identifiers: Sequence[Tuple[str, str]],
    ) -> tuple[UCIDCase, List[UCIDSubCaseID]]:
        existing_case = self._find_case_by_identifiers(document_identifiers)
        case = existing_case or self.create_case(case_details)
        linked = []
        for sub_id_value, source_party in document_identifiers:
            linked.append(self.link_sub_case_id(
                case.ucid,
                {"sub_id_value": sub_id_value, "source_party": source_party},
            ))
        return case, linked

    def _find_case_by_identifiers(self, document_identifiers: Iterable[Tuple[str, str]]) -> UCIDCase | None:
        values = [value for value, _source in document_identifiers if value]
        if not values:
            return None
        match = (
            self.session.query(UCIDSubCaseID)
            .filter(UCIDSubCaseID.sub_id_value.in_(values))
            .order_by(UCIDSubCaseID.id.asc())
            .first()
        )
        return match.case if match else None

