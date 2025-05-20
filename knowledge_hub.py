"""
Knowledge Hub Module for Legal AI Platform

This module manages the content and search functionality for the 
plain language legal information hub.
"""

import re

# Simulated knowledge base content 
# In a real implementation, this would be loaded from a database or structured files.
KNOWLEDGE_BASE = {
    "consumer_rights": {
        "title": "Consumer Rights in the Netherlands",
        "summary": "Understanding your rights when buying goods or services.",
        "sections": [
            {"heading": "Right to a Sound Product (*Deugdelijk Product*)", "content": "When you buy a product, it must be 'sound' (*deugdelijk*). This means it should do what you can reasonably expect it to do during its normal lifespan. If a product breaks too quickly or doesn't work properly, you may have the right to a free repair, a replacement, or a refund.", "keywords": ["sound product", "deugdelijk", "repair", "replacement", "refund", "warranty"]},
            {"heading": "Cooling-Off Period (*Bedenktijd*)", "content": "For purchases made online, by phone, or door-to-door (*koop op afstand*), you usually have a 14-day cooling-off period (*bedenktijd*). During this time, you can cancel the purchase without giving a reason and get a full refund. Exceptions apply, for example, for personalized goods or sealed items that have been opened.", "keywords": ["cooling-off period", "bedenktijd", "distance selling", "koop op afstand", "cancel", "refund", "online purchase"]},
            {"heading": "Misleading Information", "content": "Sellers are not allowed to provide misleading information about a product or service. If you were misled into making a purchase, the agreement might be voidable.", "keywords": ["misleading information", "false advertising", "unfair commercial practices"]}
        ]
    },
    "employment_law": {
        "title": "Employment Law Basics",
        "summary": "Key aspects of employment contracts and rights in the Netherlands.",
        "sections": [
            {"heading": "Employment Contracts", "content": "An employment contract (*arbeidsovereenkomst*) outlines the terms of your employment. It can be for a fixed term (*bepaalde tijd*) or indefinite (*onbepaalde tijd*). Key elements include salary, working hours, job description, and notice period.", "keywords": ["employment contract", "arbeidsovereenkomst", "fixed term", "indefinite term", "salary", "working hours"]},
            {"heading": "Dismissal (*Ontslag*)", "content": "Your employer cannot simply fire you. There are strict rules for dismissal (*ontslag*). Usually, the employer needs permission from the UWV (Employee Insurance Agency) or must go through the court (*kantonrechter*), depending on the reason for dismissal. There are specific grounds for dismissal, such as poor performance or redundancy.", "keywords": ["dismissal", "ontslag", "firing", "termination", "UWV", "kantonrechter", "notice period"]},
            {"heading": "Sick Leave (*Ziekteverzuim*)", "content": "If you become ill, your employer is generally required to continue paying at least 70% of your salary for up to two years. Both you and your employer have obligations regarding reintegration efforts.", "keywords": ["sick leave", "ziekteverzuim", "illness", "salary payment", "reintegration"]}
        ]
    },
    "housing_law": {
        "title": "Housing Law (Rental)",
        "summary": "Rights and obligations for tenants renting property.",
        "sections": [
            {"heading": "Rental Agreement (*Huurovereenkomst*)", "content": "A rental agreement (*huurovereenkomst*) sets out the terms between landlord and tenant. It includes details like rent amount, duration, and rules for use. Tenants have significant legal protection in the Netherlands.", "keywords": ["rental agreement", "huurovereenkomst", "tenant rights", "landlord obligations", "rent"]},
            {"heading": "Rent Increases", "content": "There are legal limits on how much and how often rent can be increased, especially for social housing (*sociale huur*). For private sector rentals (*vrije sector*), the contract usually dictates increases, but unreasonable clauses can be challenged.", "keywords": ["rent increase", "huurverhoging", "social housing", "private sector rental", "rent control"]},
            {"heading": "Maintenance and Repairs", "content": "The landlord is generally responsible for major maintenance (e.g., roof, structure), while the tenant is responsible for minor repairs and daily upkeep. Disputes can be taken to the Rent Tribunal (*Huurcommissie*) for social housing.", "keywords": ["maintenance", "repairs", "onderhoud", "landlord responsibility", "tenant responsibility", "Huurcommissie"]}
        ]
    }
    # Add more topics (Family Law, Administrative Law, etc.) here
}

class KnowledgeHub:
    """Manages access and search for the legal knowledge base."""

    def __init__(self):
        # In a real scenario, load data from DB/files
        self.topics = KNOWLEDGE_BASE

    def get_topic_list(self):
        """Returns a list of available topic titles and summaries."""
        return [{'id': topic_id, 'title': data['title'], 'summary': data['summary']} 
                for topic_id, data in self.topics.items()]

    def get_topic_details(self, topic_id):
        """Returns the full details for a specific topic."""
        return self.topics.get(topic_id)

    def search(self, query):
        """Searches the knowledge base for relevant sections based on keywords."""
        results = []
        query_lower = query.lower()
        # Simple keyword matching - could be enhanced with NLP/embeddings
        for topic_id, data in self.topics.items():
            for section in data.get('sections', []):
                # Check keywords and content for matches
                match_keywords = any(keyword in query_lower for keyword in section.get('keywords', []))
                match_content = query_lower in section.get('content', '').lower()
                match_heading = query_lower in section.get('heading', '').lower()
                
                if match_keywords or match_content or match_heading:
                    results.append({
                        'topic_id': topic_id,
                        'topic_title': data['title'],
                        'section_heading': section.get('heading'),
                        'content_snippet': section.get('content', '')[:200] + '...' # Provide a snippet
                    })
        return results

# Example Usage (for testing)
if __name__ == '__main__':
    hub = KnowledgeHub()
    print("Available Topics:")
    print(hub.get_topic_list())
    print("\nDetails for 'consumer_rights':")
    print(hub.get_topic_details('consumer_rights'))
    print("\nSearch results for 'refund':")
    print(hub.search('refund'))
    print("\nSearch results for 'ontslag':")
    print(hub.search('ontslag'))

