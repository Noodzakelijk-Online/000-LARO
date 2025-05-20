"""
Structured Case Summary Generator Module for Legal AI Platform

Helps users create a structured summary of their case.
Can potentially pre-fill based on timeline and evidence data.
"""

class CaseSummaryGenerator:
    """Guides users to input case details and generates a summary."""

    def __init__(self):
        # Define the structure for the case summary
        self.summary_structure = [
            {"id": "parties", "label": "Involved Parties", "type": "textarea", "prompt": "List all parties involved (including yourself) and their roles (e.g., tenant, landlord, employer, employee)."},
            {"id": "problem", "label": "Core Problem", "type": "textarea", "prompt": "Briefly describe the main issue or disagreement.", "max_length": 500},
            {"id": "timeline_ref", "label": "Key Events (Reference)", "type": "info", "prompt": "Refer to the Case Timeline you built for the sequence of events."}, # Link to timeline tool
            {"id": "desired_outcome", "label": "Desired Outcome", "type": "textarea", "prompt": "What resolution or outcome are you seeking?"},
            {"id": "evidence_ref", "label": "Key Evidence (Reference)", "type": "info", "prompt": "Refer to the Evidence Checklist for supporting documents/information."}, # Link to evidence tool
            {"id": "steps_taken", "label": "Steps Already Taken", "type": "textarea", "prompt": "Describe any actions you have already taken to resolve the issue (e.g., communication with the other party, complaints filed)."}
        ]

    def get_summary_structure(self):
        """Returns the fields required for the summary."""
        return self.summary_structure

    def generate_summary_text(self, user_input_data, timeline_events=None, evidence_summary=None):
        """Generates a formatted text summary from user input, potentially using timeline/evidence."""
        summary_lines = ["# Case Summary\n"]
        for field in self.summary_structure:
            field_id = field["id"]
            label = field["label"]
            if field["type"] != "info": # Don't include info prompts in output
                user_value = user_input_data.get(field_id, "[Not provided]")
                summary_lines.append(f"## {label}\n{user_value}\n")
            elif field_id == "timeline_ref":
                summary_lines.append(f"## Key Events")
                if timeline_events:
                    summary_lines.append("(Based on provided timeline data)")
                    for event in timeline_events:
                         summary_lines.append(f"- {event.get('date', '')}: {event.get('description', '')}")
                else:
                    summary_lines.append("[See attached Case Timeline]") # Placeholder if no data passed
                summary_lines.append("") # Add newline
            elif field_id == "evidence_ref":
                summary_lines.append(f"## Key Evidence")
                if evidence_summary:
                     summary_lines.append("(Based on provided evidence data)")
                     # Simple summary - could be more detailed
                     for item_id, items in evidence_summary.items():
                         summary_lines.append(f"- Related to checklist item {item_id}: {len(items)} piece(s) of evidence")
                else:
                    summary_lines.append("[See attached Evidence List]") # Placeholder
                summary_lines.append("") # Add newline
        
        return "\n".join(summary_lines)

# Example Usage
if __name__ == '__main__':
    generator = CaseSummaryGenerator()
    structure = generator.get_summary_structure()
    print("Case Summary Structure (Fields to fill):")
    for field in structure:
        print(f"- {field['label']} ({field['type']}): {field['prompt']}")

    # Simulate user input
    simulated_input = {
        "parties": "Tenant: John Doe\nLandlord: Jane Smith Properties",
        "problem": "Persistent leak in the apartment ceiling (kitchen area) that the landlord has failed to repair despite multiple requests.",
        "desired_outcome": "Immediate repair of the leak and compensation for damages to kitchen items.",
        "steps_taken": "Emailed landlord on 2024-01-16 and 2024-02-05. Landlord acknowledged the issue on 2024-01-20 but has taken no action."
    }
    
    # Simulate data potentially passed from other modules
    simulated_timeline = [
        {'date': '2024-01-15', 'description': 'Noticed leak', 'source': 'manual'},
        {'date': '2024-01-16', 'description': 'Emailed landlord', 'source': 'manual'},
        {'date': '2024-01-20', 'description': 'Landlord replied', 'source': 'manual'}
    ]
    simulated_evidence = {
        'item1': [{'source': 'upload', 'file_name': 'contract.pdf'}],
        'item3': [{'source': 'gmail', 'subject': 'Leak'}]
    }

    print("\nGenerated Summary Text (with timeline/evidence data):")
    summary_text = generator.generate_summary_text(simulated_input, simulated_timeline, simulated_evidence)
    print(summary_text)

