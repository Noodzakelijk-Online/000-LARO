# Document Aggregation System for Legal AI Platform

import os
import base64
import email
import json
import datetime
from collections import Counter
from typing import List, Dict, Any, Optional, Tuple

from document_intelligence import DocumentIntelligenceEngine

# Third-party imports (would need to be installed)
# pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib
# pip install python-docx PyPDF2 exchangelib

class DocumentAggregator:
    """
    System for aggregating documents from various sources including:
    - Email (Gmail, Outlook)
    - Cloud storage (Google Drive, OneDrive)
    - Manual uploads
    
    The system organizes documents, extracts content, and creates a structured
    evidence trail for legal cases.
    """
    
    def __init__(self, case_id: int, user_id: int):
        """Initialize the document aggregator for a specific case."""
        self.case_id = case_id
        self.user_id = user_id
        self.documents = []
        self.summary = ""
        self.red_line_thread = ""
        self.intelligence = DocumentIntelligenceEngine()

    def _add_document(self, document: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze and store a document in the case evidence list."""
        enriched = self.intelligence.enrich_document(
            document,
            case_context={'case_id': self.case_id, 'user_id': self.user_id}
        )
        self.documents.append(enriched)
        return enriched
    
    def connect_gmail(self, credentials_json: str) -> bool:
        """
        Connect to Gmail using OAuth credentials.
        
        Args:
            credentials_json: JSON string containing OAuth credentials
            
        Returns:
            bool: True if connection successful, False otherwise
        """
        try:
            # In a real implementation, we would use the Gmail API
            # For demonstration purposes, we'll simulate the connection
            print(f"Connected to Gmail for user_id: {self.user_id}")
            return True
        except Exception as e:
            print(f"Failed to connect to Gmail: {str(e)}")
            return False
    
    def connect_outlook(self, email: str, password: str) -> bool:
        """
        Connect to Outlook using credentials.
        
        Args:
            email: User's email address
            password: User's password or app password
            
        Returns:
            bool: True if connection successful, False otherwise
        """
        try:
            # In a real implementation, we would use the Microsoft Graph API or exchangelib
            # For demonstration purposes, we'll simulate the connection
            print(f"Connected to Outlook for user_id: {self.user_id}")
            return True
        except Exception as e:
            print(f"Failed to connect to Outlook: {str(e)}")
            return False
    
    def connect_google_drive(self, credentials_json: str) -> bool:
        """
        Connect to Google Drive using OAuth credentials.
        
        Args:
            credentials_json: JSON string containing OAuth credentials
            
        Returns:
            bool: True if connection successful, False otherwise
        """
        try:
            # In a real implementation, we would use the Google Drive API
            # For demonstration purposes, we'll simulate the connection
            print(f"Connected to Google Drive for user_id: {self.user_id}")
            return True
        except Exception as e:
            print(f"Failed to connect to Google Drive: {str(e)}")
            return False
    
    def connect_onedrive(self, email: str, password: str) -> bool:
        """
        Connect to OneDrive using credentials.
        
        Args:
            email: User's email address
            password: User's password or app password
            
        Returns:
            bool: True if connection successful, False otherwise
        """
        try:
            # In a real implementation, we would use the Microsoft Graph API
            # For demonstration purposes, we'll simulate the connection
            print(f"Connected to OneDrive for user_id: {self.user_id}")
            return True
        except Exception as e:
            print(f"Failed to connect to OneDrive: {str(e)}")
            return False
    
    def fetch_emails(self, source: str, query: str, max_emails: int = 100) -> List[Dict[str, Any]]:
        """
        Fetch emails from Gmail or Outlook based on search query.
        
        Args:
            source: 'gmail' or 'outlook'
            query: Search query (e.g., 'subject:legal OR from:lawyer')
            max_emails: Maximum number of emails to fetch
            
        Returns:
            List of email dictionaries
        """
        print(f"No live {source} email connector is configured for user_id: {self.user_id}")
        return []
    
    def fetch_cloud_files(self, source: str, folder_path: str = None) -> List[Dict[str, Any]]:
        """
        Fetch files from Google Drive or OneDrive.
        
        Args:
            source: 'gdrive' or 'onedrive'
            folder_path: Optional path to specific folder
            
        Returns:
            List of file dictionaries
        """
        print(f"No live {source} file connector is configured for user_id: {self.user_id}")
        return []
    
    def process_manual_upload(self, file_path: str, document_name: str = None) -> Dict[str, Any]:
        """
        Process a manually uploaded file.
        
        Args:
            file_path: Path to the uploaded file
            document_name: Optional custom name for the document
            
        Returns:
            Document dictionary
        """
        if document_name is None:
            document_name = os.path.basename(file_path)
        
        file_extension = os.path.splitext(file_path)[1].lower().replace('.', '')
        extracted_content = self.intelligence.extract_text_from_file(file_path)
        if not extracted_content:
            extracted_content = f"No readable text could be extracted from {document_name}"
        
        document = {
            'document_id': f"doc_manual_{len(self.documents) + 1}",
            'case_id': self.case_id,
            'document_name': document_name,
            'document_type': file_extension,
            'file_path': file_path,
            'content': extracted_content,
            'source': 'manual',
            'source_url': f"#document-doc_manual_{len(self.documents) + 1}",
            'upload_date': datetime.datetime.now().isoformat(),
            'is_key_document': False
        }
        
        document = self._add_document(document)
        print(f"Processed manual upload: {document_name}")
        return document
    
    def extract_document_content(self, document_id: str) -> str:
        """
        Extract text content from a document.
        
        Args:
            document_id: ID of the document to extract content from
            
        Returns:
            Extracted text content
        """
        for doc in self.documents:
            if doc['document_id'] == document_id:
                return doc['content']
        
        return "Document not found"
    
    def analyze_document_relevance(self, document_id: str) -> float:
        """
        Analyze the relevance of a document to the case.
        
        Args:
            document_id: ID of the document to analyze
            
        Returns:
            Relevance score (0.0 to 1.0)
        """
        for doc in self.documents:
            if doc['document_id'] == document_id:
                return doc.get('legal_analysis', {}).get('evidence', {}).get('relevance_score', 0.0)
        return 0.0
    
    def mark_as_key_document(self, document_id: str) -> bool:
        """
        Mark a document as a key document for the case.
        
        Args:
            document_id: ID of the document to mark
            
        Returns:
            True if successful, False otherwise
        """
        for doc in self.documents:
            if doc['document_id'] == document_id:
                doc['is_key_document'] = True
                return True
        
        return False
    
    def generate_evidence_trail(self) -> List[Dict[str, Any]]:
        """
        Generate a chronologically ordered evidence trail from all documents.
        
        Returns:
            List of documents in chronological order with relevance scores
        """
        # Sort documents by date
        sorted_docs = sorted(
            self.documents, 
            key=lambda x: x.get('upload_date', '0')
        )
        
        # Add relevance scores
        for doc in sorted_docs:
            doc['relevance_score'] = self.analyze_document_relevance(doc['document_id'])
        
        return sorted_docs

    def generate_evidence_timeline(self) -> List[Dict[str, Any]]:
        """
        Generate a visual-timeline friendly list of evidence events.

        Each event includes a short summary and a direct source pointer that the
        UI can bind to the clickable '?' source marker.
        """
        return self.intelligence.build_evidence_timeline(self.documents)
    
    def generate_red_line_thread(self) -> str:
        """
        Generate a "red line" thread summarizing the case based on key documents.
        
        Returns:
            Summarized case narrative
        """
        # Get key documents
        key_docs = [doc for doc in self.documents if doc.get('is_key_document', False)]
        
        # Sort by date
        key_docs = sorted(key_docs, key=lambda x: x.get('upload_date', '0'))
        
        # Generate summary
        summary = "CASE SUMMARY (RED LINE THREAD):\n\n"
        
        for i, doc in enumerate(key_docs):
            summary += f"{i+1}. {doc['document_name']} ({doc['source']})\n"
            summary += f"   Date: {doc.get('upload_date', 'Unknown')}\n"
            summary += f"   Summary: {doc.get('content_summary', 'No summary available')}\n\n"
            legal_analysis = doc.get('legal_analysis', {})
            topics = [
                topic.get('topic')
                for topic in legal_analysis.get('topics', [])[:3]
                if topic.get('topic')
            ]
            if topics:
                summary += f"   Legal topics: {', '.join(topics)}\n"
            key_sentences = legal_analysis.get('key_sentences', [])[:2]
            for sentence in key_sentences:
                summary += f"   Key fact: {sentence}\n"
            if topics or key_sentences:
                summary += "\n"
        
        # Add overall case narrative
        summary += "CASE NARRATIVE:\n"
        all_topics = []
        for doc in key_docs:
            for topic in doc.get('legal_analysis', {}).get('topics', []):
                if topic.get('topic'):
                    all_topics.append(topic['topic'])

        if all_topics:
            most_common_topics = [topic for topic, _ in Counter(all_topics).most_common(3)]
            summary += f"The strongest detected legal themes are: {', '.join(most_common_topics)}. "
        summary += "The chronology and key facts above should be reviewed by the user before lawyer outreach. "
        summary += "Documents marked as key contain concrete legal signals such as dates, obligations, deadlines, references, or risk indicators."
        
        self.red_line_thread = summary
        return summary
    
    def calculate_resource_usage(self) -> Dict[str, Any]:
        """
        Calculate resource usage for the document aggregation process.
        
        Returns:
            Dictionary with resource usage metrics
        """
        total_documents = len(self.documents)
        total_size_bytes = sum(len(str(doc.get('content', '')).encode('utf-8')) for doc in self.documents)
        processing_time_ms = total_documents * 500
        
        usage = {
            'case_id': self.case_id,
            'document_count': total_documents,
            'total_size_bytes': total_size_bytes,
            'processing_time_ms': processing_time_ms,
            'estimated_cost': (total_size_bytes / 1000000) * 0.01 + (processing_time_ms / 1000) * 0.05,
            'timestamp': datetime.datetime.now().isoformat()
        }
        
        return usage
    
    def get_all_documents(self) -> List[Dict[str, Any]]:
        """
        Get all documents collected for the case.
        
        Returns:
            List of all documents
        """
        return self.documents
    
    def get_document_by_id(self, document_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific document by ID.
        
        Args:
            document_id: ID of the document to retrieve
            
        Returns:
            Document dictionary or None if not found
        """
        for doc in self.documents:
            if doc['document_id'] == document_id:
                return doc
        
        return None
    
    def export_case_data(self, export_format: str = 'json') -> str:
        """
        Export all case data in the specified format.
        
        Args:
            export_format: 'json' or 'text'
            
        Returns:
            Exported data as string
        """
        if export_format == 'json':
            case_data = {
                'case_id': self.case_id,
                'user_id': self.user_id,
                'documents': self.documents,
                'evidence_trail': self.generate_evidence_trail(),
                'red_line_thread': self.red_line_thread or self.generate_red_line_thread(),
                'resource_usage': self.calculate_resource_usage(),
                'export_date': datetime.datetime.now().isoformat()
            }
            return json.dumps(case_data, indent=2)
        
        elif export_format == 'text':
            text_export = f"CASE ID: {self.case_id}\n"
            text_export += f"USER ID: {self.user_id}\n\n"
            text_export += f"DOCUMENT COUNT: {len(self.documents)}\n\n"
            text_export += "DOCUMENTS:\n"
            
            for i, doc in enumerate(self.documents):
                text_export += f"{i+1}. {doc['document_name']} ({doc['source']})\n"
                text_export += f"   Type: {doc['document_type']}\n"
                text_export += f"   Date: {doc.get('upload_date', 'Unknown')}\n"
                text_export += f"   Key Document: {'Yes' if doc.get('is_key_document', False) else 'No'}\n\n"
            
            text_export += "\n" + (self.red_line_thread or self.generate_red_line_thread())
            
            return text_export
        
        else:
            raise ValueError(f"Unsupported export format: {export_format}")

