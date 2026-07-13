# Email Integration Architecture for Lawyer Outreach

## 1. Overview

This document outlines the architecture for integrating user email accounts (e.g., Gmail, Outlook) into the Legal AI Platform. This integration will power the "Lawyer Outreach" feature, enabling the platform to send emails to lawyers on behalf of the user, streamlining the process of connecting users with legal professionals.

## 2. Goals

*   Allow users to securely connect their existing email accounts (initially Gmail and Outlook, with potential for others).
*   Enable the platform to compose and send outreach emails to selected lawyers using the user's connected email account.
*   Maintain user privacy and data security throughout the process.
*   Provide a seamless and intuitive user experience for managing connected accounts and initiating outreach.
*   Incorporate a directory or search functionality for finding lawyers, potentially using the source provided by the user.

## 3. User Flow

1.  **Connect Account**: User navigates to the "Lawyer Outreach" or "Settings" section and chooses to connect an email account.
2.  **OAuth Authentication**: User is redirected to their email provider (e.g., Google, Microsoft) for OAuth 2.0 authentication and authorization, granting necessary permissions (e.g., `send email`).
3.  **Token Storage**: The platform securely stores the obtained access and refresh tokens.
4.  **Lawyer Selection**: User identifies lawyers to contact. This could be through:
    *   A search interface querying an internal database of lawyers (potentially populated from the user-provided source and other public directories).
    *   Manual entry of lawyer contact details.
5.  **Compose Email**: User composes an email, possibly using predefined templates with customization options. The platform may pre-fill recipient details.
6.  **Send Email**: User confirms, and the platform uses the stored tokens to send the email via the user's connected account through the respective email provider's API.
7.  **Outreach History**: (Future Enhancement) Track sent emails and potentially replies.

## 4. Authentication & Authorization

*   **OAuth 2.0**: This is the standard protocol for delegated authorization and will be used for Gmail and Outlook.
    *   **Scopes**: Request minimal necessary scopes (e.g., `gmail.send` for Google, `Mail.Send` for Microsoft Graph).
    *   **Redirect URIs**: Must be registered with the respective providers.
*   **Token Management**:
    *   **Access Tokens**: Short-lived, used to make API calls.
    *   **Refresh Tokens**: Long-lived, used to obtain new access tokens without requiring user re-authentication. Must be stored encrypted at rest (e.g., using AES-256 encryption with a securely managed key).
    *   Secure storage for client IDs and secrets for each email provider.

## 5. Email Provider Specifics

### 5.1. Gmail API

*   **Endpoint**: Google Gmail API.
*   **Authentication**: OAuth 2.0.
*   **Key Scopes**: `https://www.googleapis.com/auth/gmail.send`.
*   **Libraries**: Google API Client Library for Python.

### 5.2. Microsoft Graph API (Outlook)

*   **Endpoint**: Microsoft Graph API.
*   **Authentication**: OAuth 2.0.
*   **Key Scopes**: `Mail.Send`.
*   **Libraries**: Microsoft Graph SDK for Python.

### 5.3. Other CRMs/Email Tools (Future Consideration)

*   For broader compatibility, generic SMTP/IMAP integration could be considered in the future, though this presents greater security challenges and complexity compared to OAuth with major providers.

## 6. Lawyer Directory and Selection

*   **Data Source**: The user provided a URL for finding lawyers. This source, and potentially others, will be investigated for:
    *   Feasibility of scraping or API access to build a searchable lawyer directory within the platform.
    *   Data points available (name, specialization, contact info, location).
*   **Internal Database**: A dedicated table/collection to store lawyer profiles.
*   **Search Interface**: Users should be able to search and filter this directory to find relevant lawyers.
*   **Manual Entry**: Allow users to manually input lawyer email addresses if not found in the directory.

## 7. Email Composition and Sending

*   **Email Templates**: Provide pre-defined, customizable email templates for common outreach scenarios.
*   **Dynamic Fields**: Allow insertion of dynamic data (e.g., user name, case details if applicable and consented to).
*   **Sending Logic**: Backend service to construct the email (MIME message) and use the appropriate API (Gmail or Graph) with the user's stored credentials to send the email.
*   **Error Handling**: Gracefully handle API errors, authentication failures, and provide feedback to the user.

## 8. Security Considerations

*   **Token Encryption**: All sensitive tokens (refresh tokens, API keys) must be encrypted at rest.
*   **HTTPS**: All communication must be over HTTPS.
*   **Input Validation**: Validate all user inputs to prevent injection attacks.
*   **Rate Limiting**: Implement rate limiting for sending emails to prevent abuse and stay within provider limits.
*   **Permissions**: Adhere to the principle of least privilege when requesting OAuth scopes.
*   **User Consent**: Clearly explain what permissions are being requested and how their email account will be used.
*   **Revoke Access**: Provide a clear way for users to disconnect their email accounts and revoke the platform's access.
*   **Secure API Key Management**: Client secrets for OAuth applications must be stored securely on the backend, not exposed in frontend code.

## 9. API Interaction (High-Level)

*   **OAuth Flow**: Handle redirects to and from email providers.
*   **Token Exchange**: Exchange authorization code for access/refresh tokens.
*   **Token Refresh**: Logic to refresh access tokens using refresh tokens.
*   **Send Mail API Calls**: Construct and send requests to `POST /gmail/v1/users/me/messages/send` (Gmail) or `POST /me/sendMail` (Graph API).

## 10. Data Model (Illustrative)

*   **UserEmailAccounts**:
    *   `user_id` (FK)
    *   `provider` (e.g., 'gmail', 'outlook')
    *   `email_address`
    *   `encrypted_refresh_token`
    *   `access_token` (can be stored temporarily or fetched as needed)
    *   `token_expiry`
    *   `scopes_granted`
    *   `status` (e.g., 'active', 'revoked')
*   **LawyerProfiles**:
    *   `lawyer_id` (PK)
    *   `name`
    *   `email`
    *   `specialization`
    *   `location`
    *   `source_url` (from where the profile was obtained)
*   **OutreachEmails** (Future Enhancement):
    *   `outreach_id` (PK)
    *   `user_id` (FK)
    *   `lawyer_id` (FK)
    *   `sent_datetime`
    *   `subject`
    *   `status` (e.g., 'sent', 'failed', 'replied')

## 11. UI/UX Considerations

*   **Lawyer Outreach Tab**: Dedicated section in the UI.
*   **Account Management**: Clear interface for connecting, viewing status, and disconnecting email accounts.
*   **Lawyer Search/Selection**: Intuitive way to find and select lawyers.
*   **Email Composer**: User-friendly editor, possibly with rich text capabilities and template selection.
*   **Notifications**: Feedback on successful sending or errors.

## 12. Workflow Diagram

```mermaid
graph TD
    A[User navigates to Outreach/Settings] --> B{Connect Email Account?};
    B -- Yes --> C[Select Provider: Gmail/Outlook];
    C --> D[Redirect to Provider OAuth];
    D --> E[User Authenticates & Authorizes];
    E --> F[Provider Redirects to Platform with Auth Code];
    F --> G[Platform Exchanges Code for Tokens];
    G --> H[Securely Store Refresh Token, Encrypt];
    H --> I[Account Connected Successfully];

    J[User selects Lawyer(s)] --> K[User Composes Email (uses template?)];
    K --> L{Send Email?};
    L -- Yes --> M[Backend retrieves User's Access Token (refresh if needed)];
    M --> N[Backend constructs MIME message];
    N --> O[Backend calls Provider API to Send Email];
    O -- Success --> P[Notify User: Email Sent];
    O -- Failure --> Q[Notify User: Error Sending];

    R[User-provided Lawyer Source] --> S{Process Lawyer Data};
    S --> T[Populate Lawyer Directory Database];
    T --> J;
```

## 13. Next Steps

*   Set up OAuth 2.0 client applications with Google Cloud Platform and Microsoft Azure Portal to get client IDs and secrets.
*   Develop the backend modules for OAuth flow and secure token management.
*   Implement API clients for Gmail and Microsoft Graph.
*   Design and implement the UI for account connection and email composition.
*   Investigate and implement a solution for populating and searching the lawyer directory.

