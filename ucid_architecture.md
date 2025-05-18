# Universal Case ID (UCID) System - Architecture Design

## 1. Overview

This document outlines the architecture for the Universal Case ID (UCID) system. The primary goal of this system is to provide a unique, internal identifier (UCID) for each legal case managed by the platform. This UCID will then serve as a central point to link multiple external case identifiers (Sub-Case IDs or SuCIDs) that may be used by various parties involved in the case (e.g., courts, opposing counsel, internal legacy systems).

The system must be automated, scalable, and flexible, minimizing manual user effort while providing a clear overview of all associated case identifiers.

## 2. Core Components

### 2.1. UCID Entity

*   **`ucid`**: (String, Primary Key) A system-generated unique identifier. A UUID (Universally Unique Identifier) v4 is recommended for its global uniqueness and scalability. Example: `f47ac10b-58cc-4372-a567-0e02b2c3d479`.
*   **`case_title`**: (String, Optional) A human-readable title or short description for the case, which can be automatically extracted or manually entered if needed.
*   **`creation_date`**: (Timestamp) The date and time when the UCID was created.
*   **`last_updated_date`**: (Timestamp) The date and time when the UCID or its associated information was last updated.

### 2.2. Sub-Case ID (SuCID) Entity

*   **`sucid_id`**: (String, Primary Key) A system-generated unique identifier for the SuCID entry itself (e.g., another UUID).
*   **`ucid`**: (String, Foreign Key) The UCID to which this SuCID is linked.
*   **`external_case_id`**: (String) The actual case identifier string used by the external party. This field should be flexible enough to store various formats and lengths.
*   **`source_party`**: (String, Optional) The name or description of the party/organization that uses this `external_case_id` (e.g., "District Court of Amsterdam", "Smith & Co. Law Firm", "Internal Archive System").
*   **`id_type`**: (String, Optional) A category or type for the `external_case_id` (e.g., "Court Docket Number", "Client Reference", "Police Report Number").
*   **`date_linked`**: (Timestamp) The date and time when this SuCID was linked to the UCID.
*   **`metadata`**: (JSON, Optional) Any other relevant metadata associated with this SuCID (e.g., specific URLs, contact persons related to this ID).

## 3. Key Functionalities

### 3.1. UCID Generation

*   When a new case is initiated within the platform (e.g., through the "Create New Case" feature or by processing a set of documents that cannot be linked to an existing UCID), the system will automatically generate a new, unique UCID.

### 3.2. SuCID Linking

*   **Automated Discovery**: The system will attempt to automatically discover potential SuCIDs when processing case documents (e.g., PDFs, emails, text files). This will involve Natural Language Processing (NLP) and pattern matching techniques to identify common case ID formats or keywords like "Case No.", "Docket #", "Ref:", etc.
*   **Manual Linking (Fallback)**: While automation is the priority, a simple interface might be provided for users to manually link an SuCID to a UCID if the automated system fails or for specific edge cases. This should be a secondary mechanism.
*   The system will store the `external_case_id` exactly as it appears from the source, along with any identified `source_party` or `id_type`.

### 3.3. Search and Retrieval

*   Users must be able to search for a case using its UCID.
*   Users must also be able to search for a case using any of its linked `external_case_id`s. The system will resolve the SuCID back to its parent UCID and display the relevant case.

### 3.4. Display

*   When viewing a case, the platform will clearly display its UCID.
*   All linked SuCIDs will also be displayed, along with their `source_party` and `id_type` (if available), providing a comprehensive overview of all identifiers associated with that case.

### 3.5. Retroactive Processing

*   When existing case files or archives are ingested into the system:
    *   The system will scan the documents for any potential case identifiers.
    *   It will attempt to match these identifiers with existing SuCIDs or UCIDs in the database.
    *   If a match is found, the document/information will be associated with the existing UCID.
    *   If multiple distinct but unlinked identifiers are found within a set of related documents, the system might prompt for confirmation or use heuristics to group them under a single new UCID or link them to an existing one.
    *   If no existing identifiers are found that can be confidently linked to a known UCID, a new UCID will be generated for the case represented by these documents.

## 4. Data Storage

*   A relational database (e.g., PostgreSQL) or a NoSQL document database (e.g., MongoDB) that supports efficient querying and relationships would be suitable.
    *   **Relational Approach**: Two main tables: `UniversalCases` (for UCID entities) and `SubCaseIdentifiers` (for SuCID entities) with a one-to-many relationship from `UniversalCases` to `SubCaseIdentifiers` (one UCID can have many SuCIDs).
    *   **NoSQL (Document) Approach**: Each UCID could be a document, containing an array of embedded SuCID sub-documents. This might simplify retrieval of a case and all its IDs but could make searching by SuCID more complex if not indexed properly.
*   Appropriate indexing will be crucial for efficient search performance, especially on `ucid`, `external_case_id`, and potentially `source_party`.

## 5. Scalability and Flexibility

*   Using UUIDs for UCIDs ensures global uniqueness and avoids collisions as the system scales.
*   The `external_case_id` field being a flexible string accommodates various ID formats from different sources.
*   The architecture allows for an indefinite number of SuCIDs to be linked to a single UCID.

## 6. Future Considerations

*   **Confidence Scoring**: For automated SuCID discovery, a confidence score could be assigned to indicate how certain the system is about an identified ID.
*   **Conflict Resolution**: Mechanisms for handling potential conflicts if, for example, two different sets of documents suggest the same external ID belongs to different UCIDs.
*   **Auditing**: Logging all changes to UCIDs and SuCID links for traceability.

This architecture provides a foundation for the Universal Case ID system, addressing the core requirements of automation, flexibility, scalability, and user clarity. Further detailed design of the data ingestion and NLP components for automated discovery will be covered in subsequent planning stages.
