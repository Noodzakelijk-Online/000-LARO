## Deployment Guide

The Legal AI Reach Out platform requires a specific environment setup for both its backend (Python/Flask) and frontend components, including the Node.js GraphQL server. This guide outlines the steps to deploy and run the platform.

### 1. Prerequisites

Ensure the following software is installed on your deployment server:

*   **Python**: Version 3.11 or higher.
*   **pip**: Python package installer (usually comes with Python).
*   **Node.js**: Version 20.18.0 or higher (for the GraphQL server and potential frontend build steps).
*   **npm**: Node.js package manager (usually comes with Node.js).
*   **Git**: For cloning the project repository.
*   **Virtual Environment Tool**: Python's `venv` module (standard library).

### 2. Obtaining the Code

Clone the project repository from your version control system or unpack the provided project archive:

```bash
# Example if using Git
git clone <repository_url>
cd legal_ai_platform
```

### 3. Backend Setup (Python/Flask)

#### 3.1. Create and Activate Virtual Environment

It is highly recommended to use a virtual environment to manage Python dependencies:

```bash
python3.11 -m venv venv
source venv/bin/activate
```

#### 3.2. Install Python Dependencies

Install all required Python packages listed in `requirements.txt`:

```bash
pip3 install -r requirements.txt
```

This will install Flask, NLTK, spaCy, scikit-learn, Google API clients, Microsoft Graph client, and other necessary libraries for document processing, AI functionalities, and backend operations. You might also need to download specific NLTK data or spaCy models if not handled by the application's initial setup routines:

```python
# Example for spaCy model download (if needed)
# python -m spacy download en_core_web_sm
# python -m spacy download nl_core_news_sm
```

### 4. GraphQL Server Setup (Node.js)

If the GraphQL server (`graphql_server.js`) is part of the deployment:

#### 4.1. Install Node.js Dependencies

Navigate to the directory containing `package.json` for the GraphQL server (assumed to be the project root or a subdirectory like `graphql_server`) and install dependencies:

```bash
# If package.json is in the project root
npm install

# Or if in a subdirectory, e.g., graphql_server/
# cd graphql_server
# npm install
# cd ..
```

### 5. Database Setup

*   **Schema**: The platform utilizes a database (e.g., PostgreSQL, MySQL, SQLite) for storing user data, case information, lawyer interactions, etc. Ensure the database server is running and accessible.
*   **Configuration**: Database connection details (host, port, username, password, database name) must be configured, typically through environment variables or a configuration file read by `app.py` and `db_integration.py`.
*   **Initialization/Migrations**: If the platform uses a migration tool (like Flask-Migrate) or has initialization scripts for creating tables, run those as per their specific instructions. The current schema includes tables for users, cases, documents, timeline events (`CaseTimelineEvents`), user progress (`UserProgress`), AI suggestions (`TimelineSuggestions`, `DetectedDiscrepancies`, `ProactiveSuggestions`), and lawyer pre-assessments (`LawyerPreAssessment`).

### 6. Configuration

*   **Environment Variables**: Several aspects of the platform are configured via environment variables. These may include:
    *   `FLASK_APP=app.py`
    *   `FLASK_ENV=production` (or `development`)
    *   Database connection strings/credentials.
    *   API keys for Google services, Microsoft Graph, and any other third-party services.
    *   Secret key for Flask session management.
    *   Configuration for AI models (paths, endpoints).
*   **API Credentials**: Ensure all necessary API credentials (e.g., for Gmail, Outlook, Google Drive, OneDrive integrations) are correctly set up and securely stored.

### 7. Running the Application

The `run.sh` script provides a convenient way to start the necessary services. It typically performs the following actions:

1.  Activates the Python virtual environment.
2.  Installs/updates Python dependencies from `requirements.txt`.
3.  Installs/updates Node.js dependencies if `package.json` is present for the GraphQL server.
4.  Starts the Node.js GraphQL server (`graphql_server.js`) in the background (e.g., using `nohup node graphql_server.js &`). The GraphQL server usually runs on a separate port (e.g., 4000).
5.  Starts the Flask application (`app.py`). For development, this might be `flask run --host=0.0.0.0 --port=5000`. For production, a more robust WSGI server like Gunicorn or uWSGI is recommended:
    ```bash
    # Example with Gunicorn
    # gunicorn --bind 0.0.0.0:5000 app:app
    ```

Refer to the `run.sh` script for the exact commands and sequence.

### 8. Dependencies for New Modules

*   **`contradiction_detector.py`**: Relies on NLP libraries like NLTK and spaCy, which should be installed via `requirements.txt`. Ensure any required models (e.g., spaCy language models) are downloaded.
*   **`suggestion_engine.py`**: Also uses NLP libraries. Configuration for knowledge base access or indexing might be needed.
*   **AI Timeline Suggestions**: This feature in `case_timeline.py` uses NLP for date extraction and contextual analysis. Ensure relevant models are available and accessible by the application.

### 9. Conceptual Local Agent

*   The Local Agent, as outlined in `local_agent_architecture.md`, is a conceptual component designed for local file scanning. If this were to be fully developed:
    *   It would likely be a separate packaged executable (e.g., created with PyInstaller).
    *   Users would need to download and install this agent on their local machines.
    *   Clear instructions for installation, granting necessary permissions (e.g., file system access), and configuring its communication with the main platform would be required.
    *   Security considerations for this agent would be paramount, including secure local data handling and encrypted communication with the backend.

### 10. Accessing the Platform

Once all services are running:

*   The main web application (Flask frontend) will typically be accessible at `http://<your_server_ip>:5000` (or the port configured for Flask/Gunicorn).
*   The GraphQL API endpoint (if the GraphQL server is running) will be accessible at `http://<your_server_ip>:4000/graphql` (or the port configured for the Node.js server).

### 11. Production Considerations

*   **WSGI Server**: Use a production-grade WSGI server like Gunicorn or uWSGI for the Flask application instead of the development server.
*   **Reverse Proxy**: Set up a reverse proxy like Nginx or Apache in front of the application server(s) to handle SSL termination, static file serving, load balancing, and security headers.
*   **HTTPS**: Ensure HTTPS is configured for all communication.
*   **Logging**: Configure comprehensive logging for all components and direct logs to a centralized logging system.
*   **Monitoring**: Implement monitoring for application performance, server health, and error rates.
*   **Backups**: Regularly back up the database and critical application data.

This guide provides a general overview. Specific deployment details might vary based on the exact server environment and infrastructure choices.
