#!/bin/bash
# Run tests for Legal AI Platform performance optimizations

echo "Running tests for Legal AI Platform performance optimizations..."
python3 test_optimizations.py

# Check if tests passed
if [ $? -eq 0 ]; then
    echo "All tests passed successfully!"
    exit 0
else
    echo "Some tests failed. Please check the output above for details."
    exit 1
fi
