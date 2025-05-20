"""
Contradiction Detection Module for Legal AI Platform

Identifies potential contradictions or discrepancies in dates and facts
across aggregated documents and user inputs.
"""

import re
import datetime
from collections import defaultdict

# Reuse date patterns from case_timeline (or centralize them)
DATE_PATTERNS = [
    re.compile(r"\b(\d{4}-\d{1,2}-\d{1,2})\b"), # YYYY-MM-DD
    re.compile(r"\b(\d{1,2}-\d{1,2}-\d{4})\b"), # DD-MM-YYYY
    re.compile(r"\b(\d{1,2}/\d{1,2}/\d{4})\b"), # MM/DD/YYYY or DD/MM/YYYY
    re.compile(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b", re.IGNORECASE), # Month DD, YYYY
    re.compile(r"\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b", re.IGNORECASE)  # DD Month YYYY
]

class ContradictionDetector:
    """Analyzes case data to find potential inconsistencies."""

    def __init__(self):
        pass

    def _normalize_date_str(self, date_str):
        """Attempts to normalize various date string formats to YYYY-MM-DD."""
        # (Simplified normalization - reuse or enhance the one from CaseTimeline)
        try:
            dt = datetime.datetime.strptime(date_str, "%Y-%m-%d")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass
        try:
            dt = datetime.datetime.strptime(date_str, "%d-%m-%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass
        try:
            dt = datetime.datetime.strptime(date_str, "%m/%d/%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass
        try:
            dt = datetime.datetime.strptime(date_str, "%d/%m/%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass
        # Add more complex parsing if needed
        return None # Return None if not easily parseable to a standard format

    def find_date_discrepancies(self, documents, timeline_events=None):
        """
        Identifies potential date discrepancies across documents and timeline.
        Focuses on finding different dates mentioned in similar contexts.

        Args:
            documents (list): List of document dicts with 'id' and 'content'.
            timeline_events (list, optional): List of timeline event dicts with 'date', 'description'.

        Returns:
            list: A list of potential discrepancies found.
                  Each discrepancy is a dict like:
                  {'type': 'date_discrepancy', 'context': '...', 
                   'sources': [{'doc_id': '...', 'date': '...'}, {'doc_id': '...', 'date': '...'}]}
        """
        date_mentions = defaultdict(list) # Key: Context snippet, Value: List of (date, doc_id)
        discrepancies = []

        # 1. Extract dates and context from documents
        for doc in documents:
            content = doc.get("content", "")
            doc_id = doc.get("id", "unknown")
            if not content:
                continue

            sentences = re.split(r'(?<=[.!?])\s+', content)
            for sentence in sentences:
                if not sentence.strip():
                    continue
                
                normalized_date = None
                matched_date_str = None
                for pattern in DATE_PATTERNS:
                    match = pattern.search(sentence)
                    if match:
                        matched_date_str = match.group(0)
                        normalized_date = self._normalize_date_str(matched_date_str)
                        if normalized_date:
                            # Use a simplified context key (e.g., first N words after date, or keywords)
                            # This needs refinement for better context matching
                            context_key = sentence.strip()[:50] # Simple context key
                            date_mentions[context_key].append({"date": normalized_date, "doc_id": doc_id, "snippet": sentence.strip()[:150]+"..."})
                            break # Process first date found in sentence

        # 2. Compare dates within similar contexts
        for context_key, mentions in date_mentions.items():
            if len(mentions) > 1:
                # Check if different dates are mentioned for this context
                unique_dates = set(m["date"] for m in mentions)
                if len(unique_dates) > 1:
                    # Found a potential discrepancy
                    discrepancy = {
                        "type": "date_discrepancy",
                        "context_key": context_key, # The key used for grouping
                        "sources": mentions # List of dicts with date, doc_id, snippet
                    }
                    discrepancies.append(discrepancy)
                    print(f"Potential Date Discrepancy Found: Context=\"{context_key}\" Dates={unique_dates}")

        # 3. (Optional) Compare document dates with timeline events
        # This requires more sophisticated context matching between timeline descriptions
        # and document sentences. For now, we focus on document-vs-document discrepancies.

        print(f"Found {len(discrepancies)} potential date discrepancies.")
        return discrepancies

# Example Usage:
if __name__ == '__main__':
    detector = ContradictionDetector()
    mock_docs = [
        {"id": "doc1.pdf", "content": "The meeting occurred on 2024-03-10. We discussed the contract terms."}, 
        {"id": "email_log.txt", "content": "Further discussion happened on March 11, 2024 regarding the contract. Action items were assigned."}, 
        {"id": "notes.txt", "content": "Contract meeting notes from 2024-03-10. Final terms agreed."}, 
        {"id": "unrelated.txt", "content": "Invoice paid 2024-03-15."} 
    ]

    found_discrepancies = detector.find_date_discrepancies(mock_docs)

    print("\n--- Discrepancy Details ---")
    for disc in found_discrepancies:
        print(f"Context Key: {disc['context_key']}")
        for source in disc['sources']:
            print(f"  - Doc: {source['doc_id']}, Date: {source['date']}, Snippet: {source['snippet']}")
        print("---")

