"""
Evidence Gathering Assistance Module for Legal AI Platform

Guides users on relevant evidence for their case type and allows 
upload/categorization.
"""

# Simulated evidence checklists 
# In a real implementation, this would be linked to case types identified by AI.
EVIDENCE_CHECKLISTS = {
    "landlord_dispute_maintenance": {
        "title": "Evidence for Landlord Dispute (Maintenance Issue)",
        "items": [
            {"id": "item1", "description": "Copy of your Rental Agreement (*Huurovereenkomst*)", "type": "document"},
            {"id": "item2", "description": "Photos/Videos of the maintenance issue (e.g., leak, damage)", "type": "media"},
            {"id": "item3", "description": "Written communication with landlord about the issue (emails, letters)", "type": "document"},
            {"id": "item4", "description": "Proof of rent payments", "type": "document"},
            {"id": "item5", "description": "Quotes or invoices for any repairs you had to arrange yourself (if applicable)", "type": "document"},
            {"id": "item6", "description": "Contact details of any witnesses (if applicable)", "type": "text"}
        ]
    },
    "unfair_dismissal_performance": {
        "title": "Evidence for Unfair Dismissal (Performance Related)",
        "items": [
            {"id": "item1", "description": "Copy of your Employment Contract (*Arbeidsovereenkomst*)", "type": "document"},
            {"id": "item2", "description": "Dismissal Letter from employer", "type": "document"},
            {"id": "item3", "description": "Performance Improvement Plan (PIP) documents (*Verbetertraject*), if any", "type": "document"},
            {"id": "item4", "description": "Written performance reviews or appraisals", "type": "document"},
            {"id": "item5", "description": "Emails or other communication regarding your performance", "type": "document"},
            {"id": "item6", "description": "Evidence of meeting targets or positive feedback (if available)", "type": "document/text"},
            {"id": "item7", "description": "Details of any warnings received", "type": "document/text"}
        ]
    }
    # Add more checklists for different case types
}

class EvidenceHelper:
    """Provides evidence checklists and manages user uploads."""

    def __init__(self):
        self.checklists = EVIDENCE_CHECKLISTS
        # In a real app, user_evidence would be stored per user/case in a database
        self.user_evidence = {}

    def get_checklist_for_case(self, case_type_id):
        """Returns the relevant checklist based on the identified case type."""
        # This would involve AI classification in a real scenario
        # Simulating based on provided ID for now
        return self.checklists.get(case_type_id)

    def add_user_evidence(self, user_id, case_id, checklist_item_id, evidence_details):
        """Associates uploaded evidence with a checklist item for a user/case."""
        # In a real app, handle file uploads securely and store metadata in DB
        key = (user_id, case_id)
        if key not in self.user_evidence:
            self.user_evidence[key] = {}
        if checklist_item_id not in self.user_evidence[key]:
            self.user_evidence[key][checklist_item_id] = []
        # Store details like filename, path, or reference to external source
        self.user_evidence[key][checklist_item_id].append(evidence_details)
        print(f"Evidence added for {user_id}/{case_id}, item {checklist_item_id}: {evidence_details}")
        return True

    def get_user_evidence_for_case(self, user_id, case_id):
        """Retrieves all evidence gathered by a user for a specific case."""
        return self.user_evidence.get((user_id, case_id), {})

# Example Usage
if __name__ == '__main__':
    helper = EvidenceHelper()
    checklist = helper.get_checklist_for_case("landlord_dispute_maintenance")
    print("Checklist for Landlord Dispute (Maintenance):")
    print(checklist)

    # Simulate adding evidence (e.g., after user upload or automated aggregation)
    helper.add_user_evidence("user123", "case001", "item1", {"source": "upload", "file_name": "rental_contract.pdf", "path": "/uploads/user123/case001/rental_contract.pdf"})
    helper.add_user_evidence("user123", "case001", "item3", {"source": "gmail_aggregation", "email_subject": "Re: Leak issue", "email_date": "2024-01-16"})
    
    print("\nEvidence gathered for user123/case001:")
    print(helper.get_user_evidence_for_case("user123", "case001"))

