#!/bin/bash
# Run all tests for Legal AI Platform with coverage reporting

echo "Ensuring all dependencies are installed for testing (user space)..."
python3.11 -m pip install --user --no-cache-dir --force-reinstall -r /home/ubuntu/legal_ai_platform/requirements.txt

# Add user's local bin to PATH if not already present, to find nltk etc. if installed via --user
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
  export PATH="$HOME/.local/bin:$PATH"
fi

# Download NLTK resources if nltk is in requirements.txt
if grep -q "nltk" /home/ubuntu/legal_ai_platform/requirements.txt; then
    echo "Downloading NLTK resources for testing..."
    python3.11 -c "import nltk; nltk.download('punkt', quiet=True); nltk.download('stopwords', quiet=True); nltk.download('wordnet', quiet=True)"
fi

echo "Running all tests with coverage for Legal AI Platform..."

# Run tests with coverage
# The `coverage run` command will execute the tests and collect data.
# We specify the source directory to ensure coverage is calculated for our project files.
# The -m unittest discover command remains the same for test discovery.
coverage run --source=. -m unittest discover -s /home/ubuntu/legal_ai_platform -p "test_*.py"

# Check if tests passed before generating reports
TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "All tests passed successfully! Generating coverage reports..."
    # Generate a text report to the console
    coverage report -m
    # Generate an HTML report in the 'htmlcov' directory
    coverage html
    echo "Coverage reports generated. HTML report is in 'htmlcov/index.html'."
    exit 0
else
    echo "Some tests failed. Please check the output above for details. Coverage reports will not be generated."
    exit 1
fi

