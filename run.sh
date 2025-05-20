#!/bin/bash

# Create a directory for the project files
mkdir -p /home/ubuntu/legal_ai_platform/frontend/css
mkdir -p /home/ubuntu/legal_ai_platform/frontend/js
mkdir -p /home/ubuntu/legal_ai_platform/frontend/img

# Install required Python packages
pip3 install flask flask-cors gunicorn nltk pandas numpy scikit-learn werkzeug

# Download NLTK resources
python3 -c "import nltk; nltk.download('punkt'); nltk.download('stopwords'); nltk.download('wordnet')"

# Set up environment variables
export FLASK_APP=app.py
export FLASK_ENV=development
export SECRET_KEY="legal-ai-platform-secret-key"

# Start the Flask application
echo "Starting the Legal AI Reach Out Platform..."
cd /home/ubuntu/legal_ai_platform
python3 app.py
