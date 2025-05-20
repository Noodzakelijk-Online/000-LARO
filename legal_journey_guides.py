"""
Interactive Legal Journey Guides Module for Legal AI Platform

This module provides the structure and logic for guiding users 
through common legal processes step-by-step.
"""

# Simulated guide content 
# In a real implementation, this would be loaded from a database or configuration files.
LEGAL_JOURNEY_GUIDES = {
    "landlord_dispute": {
        "title": "Guide: Dispute with Your Landlord",
        "description": "Steps to take if you have a disagreement with your landlord about rent, maintenance, or other issues.",
        "steps": [
            {
                "id": "step1",
                "title": "Identify the Issue",
                "content": "Clearly define the problem. Is it about rent increase, needed repairs, service charges, or something else? Gather relevant documents like your rental agreement and correspondence.",
                "actions": [{"label": "Learn about Tenant Rights", "link_topic": "housing_law"}],
                "next_step": "step2"
            },
            {
                "id": "step2",
                "title": "Communicate with Landlord",
                "content": "First, try to discuss the issue directly with your landlord. Explain your position clearly and calmly. It's best to put your concerns in writing (email or registered letter) as well, keeping a copy for your records.",
                "actions": [{"label": "Tips for Formal Letters", "link_external": "#"}], # Placeholder link
                "next_step": "step3"
            },
            {
                "id": "step3",
                "title": "Formal Complaint / Mediation",
                "content": "If direct communication fails, consider a formal complaint. For social housing, you can often go to the Huurcommissie (Rent Tribunal). For private rentals, mediation might be an option. Check your rental agreement for dispute resolution clauses.",
                "actions": [
                    {"label": "Check Huurcommissie Website", "link_external": "https://www.huurcommissie.nl/"},
                    {"label": "Find a Mediator", "link_external": "#"} # Placeholder
                ],
                "next_step": "step4"
            },
            {
                "id": "step4",
                "title": "Seek Legal Advice",
                "content": "If the issue remains unresolved, it's time to seek formal legal advice. You can contact Het Juridisch Loket (if eligible) or consult a lawyer specialized in housing law. Use the platform's tools to prepare your case summary and gather evidence.",
                "actions": [
                    {"label": "Check Juridisch Loket Eligibility", "action_type": "eligibility_check", "target": "juridisch_loket"},
                    {"label": "Find a Housing Lawyer", "action_type": "lawyer_search", "specialization": "housing"},
                    {"label": "Prepare Case Summary", "action_type": "case_summary_tool"}
                ],
                "next_step": None # End of guide
            }
        ]
    },
    "unfair_dismissal": {
        "title": "Guide: Challenging Unfair Dismissal",
        "description": "Steps if you believe your dismissal (*ontslag*) was unfair or unlawful.",
        "steps": [
            {
                "id": "step1",
                "title": "Review Dismissal Reason",
                "content": "Carefully review the reason given for your dismissal. Does it align with legal grounds (e.g., redundancy, performance issues)? Gather your employment contract, dismissal letter, and any performance reviews.",
                "actions": [{"label": "Learn about Dismissal Rules", "link_topic": "employment_law"}],
                "next_step": "step2"
            },
            {
                "id": "step2",
                "title": "Seek Initial Advice Quickly",
                "content": "There are strict deadlines (*vervaltermijnen*) for challenging a dismissal (often within 2 months). Contact Het Juridisch Loket, your union (if applicable), or an employment lawyer immediately for initial advice.",
                "actions": [
                    {"label": "Check Juridisch Loket Eligibility", "action_type": "eligibility_check", "target": "juridisch_loket"},
                    {"label": "Find an Employment Lawyer", "action_type": "lawyer_search", "specialization": "employment"}
                ],
                "next_step": "step3"
            },
            {
                "id": "step3",
                "title": "Formal Objection / Negotiation",
                "content": "Based on legal advice, you might formally object to the dismissal in writing or attempt negotiation with your employer (e.g., for a settlement agreement - *vaststellingsovereenkomst*).",
                "actions": [],
                "next_step": "step4"
            },
            {
                "id": "step4",
                "title": "Legal Proceedings",
                "content": "If negotiation fails, you may need to start legal proceedings at the court (*kantonrechter*) to challenge the dismissal or claim compensation. Your lawyer will guide you through this process.",
                "actions": [{"label": "Prepare Case Summary", "action_type": "case_summary_tool"}],
                "next_step": None
            }
        ]
    }
    # Add more guides here
}

class LegalJourneyGuide:
    """Manages the interactive legal journey guides."""

    def __init__(self):
        self.guides = LEGAL_JOURNEY_GUIDES

    def get_guide_list(self):
        """Returns a list of available guides."""
        return [{"id": guide_id, "title": data["title"], "description": data["description"]}
                for guide_id, data in self.guides.items()]

    def get_guide_start(self, guide_id):
        """Returns the first step of a specific guide."""
        guide = self.guides.get(guide_id)
        if guide and guide.get("steps"): 
            return guide["steps"][0]
        return None

    def get_guide_step(self, guide_id, step_id):
        """Returns the details of a specific step within a guide."""
        guide = self.guides.get(guide_id)
        if guide:
            for step in guide.get("steps", []):
                if step.get("id") == step_id:
                    return step
        return None

# Example Usage
if __name__ == '__main__':
    guide_manager = LegalJourneyGuide()
    print("Available Guides:")
    print(guide_manager.get_guide_list())
    print("\nStart of 'landlord_dispute' guide:")
    print(guide_manager.get_guide_start('landlord_dispute'))
    print("\nDetails for step 3 of 'landlord_dispute':")
    print(guide_manager.get_guide_step('landlord_dispute', 'step3'))

