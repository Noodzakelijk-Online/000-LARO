"""
GraphQL Bridge for Legal AI Platform

This module serves as a bridge between the Flask backend and the GraphQL implementation.
It provides a GraphQL endpoint for the Flask application and handles the execution of GraphQL queries.
"""

import json
import os
import subprocess
import threading
import time
from flask import Blueprint, request, jsonify, current_app
from werkzeug.local import LocalProxy

# Create a blueprint for GraphQL endpoints
graphql_bp = Blueprint('graphql', __name__)

# Path to the Node.js GraphQL server script
GRAPHQL_SERVER_PATH = os.path.join(os.path.dirname(__file__), 'graphql_server.js')

# GraphQL server process
graphql_server_process = None

# GraphQL server URL
GRAPHQL_SERVER_URL = 'http://localhost:4000/graphql'

def start_graphql_server():
    """Start the Node.js GraphQL server as a subprocess."""
    global graphql_server_process
    
    if graphql_server_process is None or graphql_server_process.poll() is not None:
        current_app.logger.info("Starting GraphQL server...")
        
        # Start the Node.js GraphQL server
        graphql_server_process = subprocess.Popen(
            ['node', GRAPHQL_SERVER_PATH],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=os.path.dirname(__file__)
        )
        
        # Wait for the server to start
        time.sleep(2)
        
        if graphql_server_process.poll() is None:
            current_app.logger.info("GraphQL server started successfully")
        else:
            stdout, stderr = graphql_server_process.communicate()
            current_app.logger.error(f"Failed to start GraphQL server: {stderr.decode('utf-8')}")
            graphql_server_process = None
            raise RuntimeError("Failed to start GraphQL server")

def stop_graphql_server():
    """Stop the Node.js GraphQL server."""
    global graphql_server_process
    
    if graphql_server_process is not None and graphql_server_process.poll() is None:
        current_app.logger.info("Stopping GraphQL server...")
        graphql_server_process.terminate()
        graphql_server_process.wait()
        graphql_server_process = None
        current_app.logger.info("GraphQL server stopped")

@graphql_bp.route('/graphql', methods=['POST'])
def graphql_endpoint():
    """GraphQL endpoint for the Flask application."""
    # Ensure GraphQL server is running
    start_graphql_server()
    
    # Get the GraphQL query from the request
    data = request.json
    
    if not data or 'query' not in data:
        return jsonify({'errors': [{'message': 'No GraphQL query provided'}]}), 400
    
    # Forward the request to the GraphQL server
    import requests
    
    try:
        response = requests.post(
            GRAPHQL_SERVER_URL,
            json=data,
            headers={'Content-Type': 'application/json'}
        )
        
        return jsonify(response.json()), response.status_code
    
    except requests.RequestException as e:
        current_app.logger.error(f"Error forwarding request to GraphQL server: {str(e)}")
        return jsonify({'errors': [{'message': f'GraphQL server error: {str(e)}'}]}), 500

@graphql_bp.route('/graphql/persisted', methods=['POST'])
def graphql_persisted_endpoint():
    """Endpoint for persisted GraphQL queries."""
    # Ensure GraphQL server is running
    start_graphql_server()
    
    # Get the persisted query ID and variables from the request
    data = request.json
    
    if not data or 'id' not in data:
        return jsonify({'errors': [{'message': 'No persisted query ID provided'}]}), 400
    
    # Forward the request to the GraphQL server's persisted query endpoint
    import requests
    
    try:
        response = requests.post(
            f"{GRAPHQL_SERVER_URL}/persisted",
            json=data,
            headers={'Content-Type': 'application/json'}
        )
        
        return jsonify(response.json()), response.status_code
    
    except requests.RequestException as e:
        current_app.logger.error(f"Error forwarding request to GraphQL server: {str(e)}")
        return jsonify({'errors': [{'message': f'GraphQL server error: {str(e)}'}]}), 500

def init_app(app):
    """Initialize the GraphQL bridge with the Flask application."""
    app.register_blueprint(graphql_bp)
    
    # Start GraphQL server when the application starts
    # Flask 2.0+ removed before_first_request, using with_app_context instead
    with app.app_context():
        start_graphql_server()
    
    # Stop GraphQL server when the application stops
    @app.teardown_appcontext
    def teardown_appcontext(exception=None):
        stop_graphql_server()
