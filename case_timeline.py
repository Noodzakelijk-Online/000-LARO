"""
Case Timeline Builder Module for Legal AI Platform

Allows users to create a chronological timeline of events related to their case.
Includes AI suggestions for events based on aggregated documents.
"""

import datetime
import re # Import regex for date finding

# Simple regex patterns for various date formats (can be expanded)
DATE_PATTERNS = [
    re.compile(r"\b(\d{4}-\d{1,2}-\d{1,2})\b"), # YYYY-MM-DD
    re.compile(r"\b(\d{1,2}-\d{1,2}-\d{4})\b"), # DD-MM-YYYY
    re.compile(r"\b(\d{1,2}/\d{1,2}/\d{4})\b"), # MM/DD/YYYY or DD/MM/YYYY
    re.compile(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b", re.IGNORECASE), # Month DD, YYYY
    re.compile(r"\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b", re.IGNORECASE)  # DD Month YYYY
]

class CaseTimeline:
    """Manages the creation and display of case timelines."""

    def __init__(self):
        # In a real app, timelines would be stored per user/case in a database
        self.timelines = {}

    def _normalize_date_str(self, date_str):
        """Attempts to normalize various date string formats to YYYY-MM-DD."""
        # This is a simplified normalization, a robust solution would use dateutil.parser
        try:
            # Try YYYY-MM-DD directly
            dt = datetime.datetime.strptime(date_str, "%Y-%m-%d")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass
        try:
            # Try DD-MM-YYYY
            dt = datetime.datetime.strptime(date_str, "%d-%m-%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass
        try:
            # Try MM/DD/YYYY
            dt = datetime.datetime.strptime(date_str, "%m/%d/%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass
        try:
            # Try DD/MM/YYYY
            dt = datetime.datetime.strptime(date_str, "%d/%m/%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass
        # Add more complex parsing for Month DD, YYYY etc. if needed
        # For simplicity, return original if not easily parsed
        return date_str # Fallback

    def add_timeline_event(self, user_id, case_id, event_date_str, description, linked_evidence_ids=None, source="manual"):
        """Adds an event to a specific case timeline. Source can be 'manual' or 'ai_suggested'."""
        key = (user_id, case_id)
        if key not in self.timelines:
            self.timelines[key] = []
        
        normalized_date_str = self._normalize_date_str(event_date_str)
        try:
            # Use the normalized string for parsing
            event_date = datetime.datetime.strptime(normalized_date_str, "%Y-%m-%d").date()
        except ValueError:            # If normalization failed and direct parsing fails, log error
            print(f"Error: Invalid or unparseable date format 	'{event_date_str}	' for event. Please use YYYY-MM-DD or similar.")
            return False

        event = {
            "date": event_date,
            "description": description,
            "evidence_ids": linked_evidence_ids or [],
            "source": source # Track if manually added or suggested by AI
        }
        self.timelines[key].append(event)
        # Keep the timeline sorted by date
        self.timelines[key].sort(key=lambda x: x["date"])
        print(f"Event added to timeline for {user_id}/{case_id}: {description}")

        return True

    def get_timeline_for_case(self, user_id, case_id):
        """Retrieves the sorted timeline for a specific case."""
        return self.timelines.get((user_id, case_id), [])

    def remove_timeline_event(self, user_id, case_id, event_index):
        """Removes an event from the timeline by its index."""
        key = (user_id, case_id)
        if key in self.timelines and 0 <= event_index < len(self.timelines[key]):
            removed_event = self.timelines[key].pop(event_index)
            print(f"Event removed from timeline for {user_id}/{case_id}: 	'{removed_event['description']}	'")
            return True
        print(f"Error: Event index {event_index} out of bounds for timeline {user_id}/{case_id}.")
        return False
        
    def suggest_events_from_evidence(self, user_id, case_id, evidence_list):
        """Analyzes text content from evidence to suggest potential timeline events using regex for dates."""
        suggestions = []
        processed_suggestions = set() # To avoid duplicate suggestions from same context

        # evidence_list is assumed to be a list of dicts like:
        # {"id": "doc1.pdf", "content": "...text content... on 2024-02-10 something happened..."}
        # {"id": "email_abc.eml", "content": "...Subject: Meeting... Date: March 5, 2024... discussed the issue..."}

        for evidence in evidence_list:
            content = evidence.get("content", "")
            evidence_id = evidence.get("id", "unknown")
            if not content:
                continue

            # Split content into sentences or chunks for context
            # Simple sentence split based on periods (can be improved with NLTK)
            sentences = re.split(r'(?<=[.!?])\s+', content)

            for sentence in sentences:
                if not sentence.strip():
                    continue
                
                found_date_str = None
                for pattern in DATE_PATTERNS:
                    match = pattern.search(sentence)
                    if match:
                        found_date_str = match.group(0) # Get the matched date string
                        normalized_date_str = self._normalize_date_str(found_date_str)

                        # Check if normalization was successful AND resulted in YYYY-MM-DD format
                        is_normalized_format = False
                        if normalized_date_str:
                            try:
                                datetime.datetime.strptime(normalized_date_str, "%Y-%m-%d")
                                is_normalized_format = True
                            except ValueError:
                                pass # Not in YYYY-MM-DD format
                        
                        # Create a unique key for the suggestion to avoid duplicates
                        suggestion_key = (normalized_date_str, sentence.strip()[:100]) # Use date + start of sentence
                        
                        if is_normalized_format and suggestion_key not in processed_suggestions:
                            try:
                                date_obj = datetime.datetime.strptime(normalized_date_str, "%Y-%m-%d").date()
                            except ValueError:
                                date_obj = None # Should not happen if is_normalized_format is true, but good practice
                                print(f"Warning: Could not parse normalized date 	'{normalized_date_str}'	 into date object.")

                            suggestion = {
                                "date": date_obj, # May be None
                                "date_str": normalized_date_str, # Guaranteed YYYY-MM-DD
                                "description": f"Potential event from 	'{evidence_id}'	: {sentence.strip()[:150]}...", # Truncate for brevity
                                "evidence_ref": evidence_id,
                                "source": "ai_suggested"
                            }
                            suggestions.append(suggestion)
                            processed_suggestions.add(suggestion_key)
                        # Break after first date match in a sentence to avoid multiple suggestions for same sentence
                        break 
        
        print(f"Generated {len(suggestions)} AI timeline suggestions for {user_id}/{case_id}.")
        return suggestions

# Example Usage
if __name__ == '__main__':
    timeline_builder = CaseTimeline()
    user = "user123"
    case = "case001"

    # Add events manually
    timeline_builder.add_timeline_event(user, case, "2024-01-15", "Noticed leak in ceiling")
    timeline_builder.add_timeline_event(user, case, "2024-01-16", "Emailed landlord about leak", linked_evidence_ids=["email_01.eml"])
    timeline_builder.add_timeline_event(user, case, "2024-01-20", "Landlord replied, promised to look into it", linked_evidence_ids=["email_02.eml"])
    
    # Simulate evidence content
    mock_evidence = [
        {"id": "contract.pdf", "content": "This agreement was signed on 2023-11-01. The terms are valid for one year. Payment due on 15-12-2023."}, 
        {"id": "email_log.txt", "content": "Received complaint email dated 10/01/2024. Responded on 12/01/2024 confirming receipt. Follow up meeting scheduled for Jan 25, 2024."}, 
        {"id": "notes.txt", "content": "Meeting notes from 2024-02-05. Discussed resolution options. No agreement reached."}, 
        {"id": "duplicate_date.txt", "content": "Another mention of 2024-02-05 in a different context."} 
    ]

    # Generate AI suggestions
    suggested_events = timeline_builder.suggest_events_from_evidence(user, case, mock_evidence)

    print("\n--- AI Suggested Events ---")
    if suggested_events:
        for suggestion in suggested_events:
            print(f"Date: {suggestion['date_str']}, Desc: {suggestion['description']} (Source: {suggestion['source']})")
        # In a real app, present these to the user for confirmation
        # Example: Add the first confirmed suggestion
        # confirmed_suggestion = suggested_events[0]
        # timeline_builder.add_timeline_event(user, case, confirmed_suggestion['date_str'], 
        #                                    confirmed_suggestion['description'].replace("Potential event from", "Confirmed event from"), 
        #                                    linked_evidence_ids=[confirmed_suggestion['evidence_ref']], 
        #                                    source='ai_confirmed')
    else:
        print("No timeline events suggested by AI.")

    print(f"\n--- Final Timeline for {user}/{case} ---")
    full_timeline = timeline_builder.get_timeline_for_case(user, case)
    for event in full_timeline:
        print(f"- {event.get(	'date	', 	''	).strftime(	'%Y-%m-%d	')}: {event.get(	'description	', 	''	)} (Source: {event.get(	'source	', 	'manual	')})")