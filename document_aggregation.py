# Document Aggregation System for Legal AI Platform

import os
import base64
import email
import json
import datetime
import mimetypes
from typing import List, Dict, Any, Optional, Tuple

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
        # In a real implementation, we would fetch actual emails
        # For demonstration purposes, we'll create sample data
        
        sample_emails = []
        
        for i in range(1, min(10, max_emails + 1)):
            email_data = {
                'id': f"email_{source}_{i}",
                'subject': f"Legal Matter - Document {i}",
                'from': "lawyer@example.com" if i % 3 == 0 else "client@example.com",
                'to': "client@example.com" if i % 3 == 0 else "lawyer@example.com",
                'date': (datetime.datetime.now() - datetime.timedelta(days=i)).isoformat(),
                'body': f"This is sample email content for document {i}. It contains information relevant to the legal case.",
                'has_attachments': i % 2 == 0,
                'source': source
            }
            sample_emails.append(email_data)
            
            # Add to documents list
            self.documents.append({
                'document_id': f"doc_email_{i}",
                'case_id': self.case_id,
                'document_name': f"Email: {email_data['subject']}",
                'document_type': 'email',
                'content': email_data['body'],
                'content_summary': f"Email communication about document {i}",
                'source': source,
                'upload_date': email_data['date'],
                'is_key_document': i % 3 == 0  # Every third document is key
            })
        
        print(f"Fetched {len(sample_emails)} emails from {source}")
        return sample_emails
    
    def fetch_cloud_files(self, source: str, folder_path: str = None) -> List[Dict[str, Any]]:
        """
        Fetch files from Google Drive or OneDrive.
        
        Args:
            source: 'gdrive' or 'onedrive'
            folder_path: Optional path to specific folder
            
        Returns:
            List of file dictionaries
        """
        # In a real implementation, we would fetch actual files
        # For demonstration purposes, we'll create sample data
        
        sample_files = []
        file_types = ['pdf', 'docx', 'xlsx', 'jpg', 'txt']
        
        for i in range(1, 8):
            file_type = file_types[i % len(file_types)]
            file_data = {
                'id': f"file_{source}_{i}",
                'name': f"Legal_Document_{i}.{file_type}",
                'mime_type': mimetypes.guess_type(f"file.{file_type}")[0],
                'created_time': (datetime.datetime.now() - datetime.timedelta(days=i*2)).isoformat(),
                'modified_time': (datetime.datetime.now() - datetime.timedelta(days=i)).isoformat(),
                'size': i * 100000,  # Sample size in bytes
                'web_view_link': f"https://example.com/{source}/file_{i}",
                'source': source
            }
            sample_files.append(file_data)
            
            # Add to documents list
            self.documents.append({
                'document_id': f"doc_file_{i}",
                'case_id': self.case_id,
                'document_name': file_data['name'],
                'document_type': file_type,
                'content': f"This is sample content for {file_data['name']}",
                'content_summary': f"Legal document {i} containing case information",
                'source': source,
                'upload_date': file_data['modified_time'],
                'is_key_document': i % 4 == 0  # Every fourth document is key
            })
        
        print(f"Fetched {len(sample_files)} files from {source}")
        return sample_files
    
    def process_manual_upload(self, file_path: str, document_name: str = None) -> Dict[str, Any]:
        """
        Process a manually uploaded file.
        
        Args:
            file_path: Path to the uploaded file
            document_name: Optional custom name for the document
            
        Returns:
            Document dictionary
        """
        # In a real implementation, we would process the actual file
        # For demonstration purposes, we'll create sample data
        
        if document_name is None:
            document_name = os.path.basename(file_path)
        
        file_extension = os.path.splitext(file_path)[1].lower().replace('.', '')
        
        document = {
            'document_id': f"doc_manual_{len(self.documents) + 1}",
            'case_id': self.case_id,
            'document_name': document_name,
            'document_type': file_extension,
            'content': f"This is sample content for manually uploaded file {document_name}",
            'content_summary': f"Manually uploaded document containing case information",
            'source': 'manual',
            'upload_date': datetime.datetime.now().isoformat(),
            'is_key_document': False
        }
        
        self.documents.append(document)
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
        # In a real implementation, we would use libraries like PyPDF2, python-docx, etc.
        # For demonstration purposes, we'll return sample content
        
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
        # In a real implementation, we would use NLP techniques
        # For demonstration purposes, we'll return a random score
        
        import random
        return random.uniform(0.5, 1.0)
    
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
        
        # Add overall case narrative
        summary += "CASE NARRATIVE:\n"
        summary += "Based on the key documents, this case involves a legal matter that requires professional assistance. "
        summary += "The chronology of events suggests a progression of the legal situation as documented in the evidence trail. "
        summary += "The most significant aspects of the case are highlighted in the key documents listed above."
        
        self.red_line_thread = summary
        return summary
    
    def calculate_resource_usage(self) -> Dict[str, Any]:
        """
        Calculate resource usage for the document aggregation process.
        
        Returns:
            Dictionary with resource usage metrics
        """
        # In a real implementation, we would track actual resource usage
        # For demonstration purposes, we'll create sample metrics
        
        total_documents = len(self.documents)
        total_size_bytes = sum(100000 for _ in self.documents)  # Assume 100KB per document
        processing_time_ms = total_documents * 500  # Assume 500ms per document
        
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

# Example usage
if __name__ == "__main__":
    # Create a document aggregator for a sample case
    aggregator = DocumentAggregator(case_id=123, user_id=456)
    
    # Fetch emails from Gmail and Outlook
    gmail_emails = aggregator.fetch_emails('gmail', 'subject:legal')
    outlook_emails = aggregator.fetch_emails('outlook', 'from:lawyer')
    
    # Fetch files from Google Drive and OneDrive
    gdrive_files = aggregator.fetch_cloud_files('gdrive')
    onedrive_files = aggregator.fetch_cloud_files('onedrive')
    
    # Process a manual upload
    manual_doc = aggregator.process_manual_upload('/path/to/sample.pdf', 'Important Contract.pdf')
    
    # Mark some documents as key documents
    aggregator.mark_as_key_document('doc_email_3')
    aggregator.mark_as_key_document('doc_file_4')
    aggregator.mark_as_key_document(manual_doc['document_id'])
    
    # Generate evidence trail
    evidence_trail = aggregator.generate_evidence_trail()
    print(f"Generated evidence trail with {len(evidence_trail)} documents")
    
    # Generate red line thread
    red_line = aggregator.generate_red_line_thread()
    print(f"Generated red line thread with {len(red_line)} characters")
    
    # Calculate resource usage
    usage = aggregator.calculate_resource_usage()
    print(f"Resource usage: {usage['estimated_cost']:.2f} cost units")
    
    # Export case data
    json_export = aggregator.export_case_data('json')
    print(f"Exported JSON data with {len(json_export)} characters")
    
    text_export = aggregator.export_case_data('text')
    print(f"Exported text data with {len(text_export)} characters")
