#!/bin/bash

# Create a directory for the project files
mkdir -p /home/ubuntu/legal_ai_platform/frontend/css
mkdir -p /home/ubuntu/legal_ai_platform/frontend/js
mkdir -p /home/ubuntu/legal_ai_platform/frontend/img

# Install required Python packages from requirements.txt
echo "Installing Python dependencies from requirements.txt..."
python3.11 -m pip install --no-cache-dir --force-reinstall -r /home/ubuntu/legal_ai_platform/requirements.txt

# Download NLTK resources if nltk is in requirements.txt
if grep -q "nltk" /home/ubuntu/legal_ai_platform/requirements.txt; then
    echo "Downloading NLTK resources..."
    python3.11 -c "import nltk; nltk.download(	'punkt	', quiet=True); nltk.download(	'stopwords	', quiet=True); nltk.download(	'wordnet	', quiet=True)"
fi

# Function to run linters and formatters
run_code_quality_checks() {
    echo "Running Black code formatter..."
    black /home/ubuntu/legal_ai_platform --check
    echo "Running Flake8 linter..."
    flake8 /home/ubuntu/legal_ai_platform
}

format_code() {
    echo "Applying Black code formatter..."
    black /home/ubuntu/legal_ai_platform
}

# Check for arguments
if [ "$1" == "lint" ]; then
    run_code_quality_checks
    exit 0
fi

if [ "$1" == "format" ]; then
    format_code
    exit 0
fi

# Set up environment variables (will be loaded from .env by app.py)
# export FLASK_APP=app.py
# export FLASK_ENV=development
# export SECRET_KEY="legal-ai-platform-secret-key"

# Start the Flask application
echo "Starting the Legal AI Reach Out Platform..."
cd /home/ubuntu/legal_ai_platform
python3.11 app.py

