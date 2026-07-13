"""
Suggestion Engine for Legal AI Platform

Generates proactive suggestions for knowledge hub articles or journey guide steps
based on the user's case context.
"""

from knowledge_hub import KnowledgeHub # Assuming knowledge_hub.py is in the same directory
# from legal_journey_guides import LegalJourneyGuides # If suggesting guide steps too

class SuggestionEngine:
    """Provides relevant suggestions based on case context."""

    def __init__(self, knowledge_hub: KnowledgeHub):
        self.knowledge_hub = knowledge_hub
        # self.journey_guides = journey_guides # If applicable

        # Define mappings from potential case classifications (or keywords)
        # to relevant knowledge hub topics/sections.
        # This mapping needs to be expanded based on actual case types used.
        self.context_to_knowledge_map = {
            # Employment Law
            "unfair_dismissal": [("employment_law", "Dismissal (*Ontslag*)")],
            "employment_contract_issue": [("employment_law", "Employment Contracts")],
            "sick_leave_dispute": [("employment_law", "Sick Leave (*Ziekteverzuim*)")],
            "redundancy": [("employment_law", "Dismissal (*Ontslag*)")],
            # Consumer Rights
            "defective_product": [("consumer_rights", "Right to a Sound Product (*Deugdelijk Product*)")],
            "online_purchase_return": [("consumer_rights", "Cooling-Off Period (*Bedenktijd*)")],
            "misleading_advertisement": [("consumer_rights", "Misleading Information")],
            # Housing Law (Rental)
            "rent_dispute": [("housing_law", "Rental Agreement (*Huurovereenkomst*)"), ("housing_law", "Rent Increases")],
            "maintenance_issue": [("housing_law", "Maintenance and Repairs")],
            "eviction_notice": [("housing_law", "Rental Agreement (*Huurovereenkomst*)")] # Needs more specific section
            # Add more mappings...
        }

    def get_suggestions(self, case_context):
        """
        Generates suggestions based on the provided case context.

        Args:
            case_context (dict): Contains information like 'case_type', 
                                 'current_workflow_step', 'keywords'.

        Returns:
            list: A list of suggestion dictionaries, e.g., 
                  [{
                      'type': 'knowledge_hub',
                      'topic_id': 'employment_law',
                      'section_heading': 'Dismissal (*Ontslag*)',
                      'title': 'Employment Law Basics',
                      'snippet': 'Your employer cannot simply fire you...'
                  }]
        """
        suggestions = []
        processed_suggestions = set() # Avoid duplicates

        case_type = case_context.get("case_type")
        keywords = case_context.get("keywords", [])
        # current_step = case_context.get("current_workflow_step") # Could use this too

        # 1. Suggestions based on Case Type Mapping
        if case_type and case_type in self.context_to_knowledge_map:
            mappings = self.context_to_knowledge_map[case_type]
            for topic_id, section_heading in mappings:
                topic_details = self.knowledge_hub.get_topic_details(topic_id)
                if topic_details:
                    for section in topic_details.get("sections", []):
                        if section.get("heading") == section_heading:
                            suggestion_key = (topic_id, section_heading)
                            if suggestion_key not in processed_suggestions:
                                suggestions.append({
                                    "type": "knowledge_hub",
                                    "topic_id": topic_id,
                                    "section_heading": section_heading,
                                    "title": topic_details.get("title", ""),
                                    "snippet": section.get("content", "")[:200] + "..."
                                })
                                processed_suggestions.add(suggestion_key)
                            break # Found the specific section

        # 2. Suggestions based on Keywords (using Knowledge Hub search)
        if keywords:
            combined_query = " ".join(keywords)
            search_results = self.knowledge_hub.search(combined_query)
            for result in search_results:
                suggestion_key = (result["topic_id"], result["section_heading"])
                if suggestion_key not in processed_suggestions:
                    suggestions.append({
                        "type": "knowledge_hub",
                        "topic_id": result["topic_id"],
                        "section_heading": result["section_heading"],
                        "title": result["topic_title"],
                        "snippet": result["content_snippet"]
                    })
                    processed_suggestions.add(suggestion_key)

        # 3. (Optional) Suggestions based on current workflow step
        # if current_step:
        #    # Add logic to map workflow steps to specific knowledge/guides
        #    pass

        print(f"Generated {len(suggestions)} proactive suggestions.")
        return suggestions

# Example Usage:
if __name__ == '__main__':
    hub = KnowledgeHub()
    engine = SuggestionEngine(hub)

    print("--- Suggestions for 'unfair_dismissal' case type ---")
    context1 = {"case_type": "unfair_dismissal"}
    suggestions1 = engine.get_suggestions(context1)
    for sug in suggestions1:
        print(f"- [{sug['type']}] {sug['title']} > {sug['section_heading']}: {sug['snippet']}")

    print("\n--- Suggestions based on keywords ['rent', 'increase'] ---")
    context2 = {"keywords": ["rent", "increase"]}
    suggestions2 = engine.get_suggestions(context2)
    for sug in suggestions2:
        print(f"- [{sug['type']}] {sug['title']} > {sug['section_heading']}: {sug['snippet']}")

    print("\n--- Suggestions for combined context ---")
    context3 = {"case_type": "defective_product", "keywords": ["warranty", "repair"]}
    suggestions3 = engine.get_suggestions(context3)
    for sug in suggestions3:
        print(f"- [{sug['type']}] {sug['title']} > {sug['section_heading']}: {sug['snippet']}")

