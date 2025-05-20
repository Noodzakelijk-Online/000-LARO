"""
Updated app.py with integrated serverless architecture for Legal AI Platform

This file integrates the serverless architecture components with the main Flask application.
"""

import os
import sys
import logging
from flask import Flask, request, jsonify, render_template, send_from_directory, session
from werkzeug.middleware.proxy_fix import ProxyFix

# Import custom modules
from authentication import EmailAuthenticationSystem
from case_matching import LegalCaseMatcher
from document_aggregation import DocumentAggregator
from lawyer_outreach import LawyerOutreachSystem
from dashboard_backend import BusinessMetricsDashboard
from graphql_bridge import init_app as init_graphql
from db_integration import init_app as init_db
from db_optimization import db_manager
from timeseries_manager import timeseries_manager
from serverless_architecture import init_app as init_serverless, publish_event
from serverless_functions import init_serverless_functions

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('legal_ai_platform')

# Initialize Flask app
app = Flask(__name__, static_folder='frontend', template_folder='frontend')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', os.urandom(24).hex())
app.wsgi_app = ProxyFix(app.wsgi_app)

# Initialize components
auth_system = EmailAuthenticationSystem(app)
case_matcher = LegalCaseMatcher()
dashboard = BusinessMetricsDashboard()

# Initialize GraphQL
init_graphql(app)

# Initialize database integration
init_db(app)

# Initialize serverless architecture
init_serverless(app)
init_serverless_functions()

# In-memory storage for demo purposes
# In a production environment, this would be a database
cases = {}
documents = {}
outreach_campaigns = {}
users = {}

# Static routes
@app.route('/')
def index():
    return send_from_directory('frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('frontend', path)

# API routes for case matching
@app.route('/api/case/analyze', methods=['POST'])
@auth_system._require_auth
def analyze_case():
    data = request.json
    
    if 'case_description' not in data:
        return jsonify({'error': 'Case description is required'}), 400
    
    case_description = data['case_description']
    
    # Analyze case with AI
    matched_fields = case_matcher.match_legal_fields(case_description)
    complexity = case_matcher.analyze_case_complexity(case_description)
    summary = case_matcher.generate_case_summary(case_description)
    
    # Store case data
    case_id = len(cases) + 1
    user_id = session.get('user_id', 0)
    
    cases[case_id] = {
        'case_id': case_id,
        'user_id': user_id,
        'case_description': case_description,
        'matched_fields': matched_fields,
        'complexity': complexity,
        'summary': summary,
        'status': 'pending'
    }
    
    # Publish case created event for serverless processing
    publish_event('case.created', {
        'case_id': case_id,
        'case_data': {
            'description': case_description,
            'user_id': user_id,
            'legal_fields': matched_fields
        }
    })
    
    # Record case creation event in time-series database
    timeseries_manager.record_case_event(
        case_id=str(case_id),
        event_type='created',
        category=matched_fields[0] if matched_fields else 'UNKNOWN',
        user_id=str(user_id),
        details={
            'complexity': complexity,
            'field_count': len(matched_fields)
        }
    )
    
    # Invalidate cache for cases
    db_manager.invalidate_cache('cases')
    
    return jsonify({
        'case_id': case_id,
        'matched_fields': matched_fields,
        'complexity': complexity,
        'summary': summary
    }), 201

# API routes for document aggregation
@app.route('/api/documents/aggregate', methods=['POST'])
@auth_system._require_auth
def aggregate_documents():
    data = request.json
    
    if 'case_id' not in data:
        return jsonify({'error': 'Case ID is required'}), 400
    
    case_id = data['case_id']
    user_id = session.get('user_id', 0)
    
    # Check if case exists
    if case_id not in cases:
        return jsonify({'error': 'Case not found'}), 404
    
    # Create document aggregator
    aggregator = DocumentAggregator(case_id=case_id, user_id=user_id)
    
    # Process documents based on source
    if data.get('source') == 'gmail':
        emails = aggregator.fetch_emails('gmail', data.get('query', ''))
    elif data.get('source') == 'outlook':
        emails = aggregator.fetch_emails('outlook', data.get('query', ''))
    elif data.get('source') == 'gdrive':
        files = aggregator.fetch_cloud_files('gdrive', data.get('folder_path'))
    elif data.get('source') == 'onedrive':
        files = aggregator.fetch_cloud_files('onedrive', data.get('folder_path'))
    elif data.get('source') == 'manual' and 'file_path' in data:
        document = aggregator.process_manual_upload(data['file_path'], data.get('document_name'))
    
    # Generate evidence trail
    evidence_trail = aggregator.generate_evidence_trail()
    
    # Generate red line thread
    red_line_thread = aggregator.generate_red_line_thread()
    
    # Calculate resource usage
    resource_usage = aggregator.calculate_resource_usage()
    
    # Store documents
    documents[case_id] = aggregator.get_all_documents()
    
    # Process each document with serverless function
    for doc in aggregator.get_all_documents():
        # Publish document for serverless processing
        publish_event('document.uploaded', {
            'document_id': doc['id'],
            'document_data': {
                'case_id': case_id,
                'content': doc.get('content', ''),
                'type': doc.get('type', 'UNKNOWN')
            }
        })
    
    # Record document aggregation event in time-series database
    timeseries_manager.record_case_event(
        case_id=str(case_id),
        event_type='documents_aggregated',
        category=cases[case_id]['matched_fields'][0] if cases[case_id]['matched_fields'] else 'UNKNOWN',
        user_id=str(user_id),
        details={
            'document_count': len(aggregator.get_all_documents()),
            'source': data.get('source', 'unknown'),
            'processing_time_ms': resource_usage.get('processing_time_ms', 0)
        }
    )
    
    # Invalidate cache for documents
    db_manager.invalidate_cache('documents')
    
    return jsonify({
        'case_id': case_id,
        'document_count': len(aggregator.get_all_documents()),
        'evidence_trail': evidence_trail,
        'red_line_thread': red_line_thread,
        'resource_usage': resource_usage
    }), 200

@app.route('/api/documents/<int:case_id>', methods=['GET'])
@auth_system._require_auth
def get_documents(case_id):
    if case_id not in documents:
        return jsonify({'error': 'No documents found for this case'}), 404
    
    # Use cached query for document retrieval
    @db_manager.cached_query(ttl=60)
    def get_cached_documents(case_id):
        return documents[case_id]
    
    # Record document view event in time-series database
    user_id = session.get('user_id', 0)
    timeseries_manager.record_user_activity(
        user_id=str(user_id),
        activity_type='view',
        resource='documents',
        details={
            'case_id': case_id,
            'document_count': len(documents[case_id])
        }
    )
    
    return jsonify({
        'case_id': case_id,
        'documents': get_cached_documents(case_id)
    }), 200

# API routes for lawyer outreach
@app.route('/api/outreach/start', methods=['POST'])
@auth_system._require_auth
def start_outreach():
    data = request.json
    
    if 'case_id' not in data or 'legal_field' not in data:
        return jsonify({'error': 'Case ID and legal field are required'}), 400
    
    case_id = data['case_id']
    legal_field = data['legal_field']
    user_id = session.get('user_id', 0)
    
    # Check if case exists
    if case_id not in cases:
        return jsonify({'error': 'Case not found'}), 404
    
    # Get case summary
    case_summary = cases[case_id]['summary']
    
    # Create outreach system
    outreach_system = LawyerOutreachSystem(case_id=case_id, user_id=user_id)
    
    # Match lawyers using serverless function
    from serverless_functions import match_lawyers
    lawyer_matching_result = match_lawyers({
        'case_id': case_id,
        'case_data': {
            'legal_fields': [legal_field],
            'summary': case_summary,
            'complexity': cases[case_id]['complexity']
        }
    }, {})
    
    # Get matched lawyers from result
    matched_lawyers = []
    if lawyer_matching_result.get('statusCode') == 200:
        matched_lawyers = lawyer_matching_result.get('body', {}).get('matched_lawyers', [])
    
    # Send initial outreach
    outreach_records = outreach_system.send_initial_outreach(
        case_summary=case_summary,
        legal_field=legal_field,
        max_lawyers=data.get('max_lawyers', 30),
        preferred_lawyers=[lawyer['id'] for lawyer in matched_lawyers[:data.get('max_lawyers', 30)]]
    )
    
    # Store outreach campaign
    outreach_campaigns[case_id] = outreach_system
    
    # Record outreach event in time-series database
    timeseries_manager.record_case_event(
        case_id=str(case_id),
        event_type='outreach_started',
        category=legal_field,
        user_id=str(user_id),
        details={
            'lawyer_count': len(outreach_records),
            'max_lawyers': data.get('max_lawyers', 30)
        }
    )
    
    return jsonify({
        'case_id': case_id,
        'outreach_count': len(outreach_records),
        'legal_field': legal_field
    }), 200

@app.route('/api/outreach/<int:case_id>/status', methods=['GET'])
@auth_system._require_auth
def get_outreach_status(case_id):
    if case_id not in outreach_campaigns:
        return jsonify({'error': 'No outreach campaign found for this case'}), 404
    
    outreach_system = outreach_campaigns[case_id]
    
    # Check for responses
    responses = outreach_system.check_for_responses()
    
    # Get statistics
    stats = outreach_system.get_outreach_statistics()
    
    # Get accepted cases
    accepted = outreach_system.get_accepted_cases()
    
    # Record outreach check event in time-series database
    user_id = session.get('user_id', 0)
    timeseries_manager.record_user_activity(
        user_id=str(user_id),
        activity_type='check_outreach',
        resource='outreach',
        details={
            'case_id': case_id,
            'response_count': len(responses),
            'accepted_count': len(accepted)
        }
    )
    
    return jsonify({
        'case_id': case_id,
        'statistics': stats,
        'responses': outreach_system.responses,
        'accepted_cases': accepted
    }), 200

@app.route('/api/outreach/<int:case_id>/follow-up', methods=['POST'])
@auth_system._require_auth
def send_follow_ups(case_id):
    if case_id not in outreach_campaigns:
        return jsonify({'error': 'No outreach campaign found for this case'}), 404
    
    outreach_system = outreach_campaigns[case_id]
    
    # Get case summary
    case_summary = cases[case_id]['summary']
    
    # Send follow-ups
    follow_ups = outreach_system.send_follow_ups(case_summary)
    
    # Record follow-up event in time-series database
    user_id = session.get('user_id', 0)
    timeseries_manager.record_case_event(
        case_id=str(case_id),
        event_type='follow_up_sent',
        category=cases[case_id]['matched_fields'][0] if cases[case_id]['matched_fields'] else 'UNKNOWN',
        user_id=str(user_id),
        details={
            'follow_up_count': len(follow_ups)
        }
    )
    
    return jsonify({
        'case_id': case_id,
        'follow_ups_sent': len(follow_ups)
    }), 200

# API routes for user cases
@app.route('/api/user/cases', methods=['GET'])
@auth_system._require_auth
def get_user_cases():
    user_id = session.get('user_id', 0)
    
    # Use cached query for user cases
    @db_manager.cached_query(ttl=30)
    def get_cached_user_cases(user_id):
        # Filter cases by user ID
        return [case for case_id, case in cases.items() if case['user_id'] == user_id]
    
    # Record user activity in time-series database
    timeseries_manager.record_user_activity(
        user_id=str(user_id),
        activity_type='list',
        resource='cases'
    )
    
    return jsonify({
        'user_id': user_id,
        'cases': get_cached_user_cases(user_id)
    }), 200

@app.route('/api/case/<int:case_id>', methods=['GET'])
@auth_system._require_auth
def get_case(case_id):
    if case_id not in cases:
        return jsonify({'error': 'Case not found'}), 404
    
    # Use cached query for case retrieval
    @db_manager.cached_query(ttl=60)
    def get_cached_case(case_id):
        return cases[case_id]
    
    # Record case view event in time-series database
    user_id = session.get('user_id', 0)
    timeseries_manager.record_user_activity(
        user_id=str(user_id),
        activity_type='view',
        resource='case',
        details={
            'case_id': case_id,
            'category': cases[case_id]['matched_fields'][0] if cases[case_id]['matched_fields'] else 'UNKNOWN'
        }
    )
    
    return jsonify(get_cached_case(case_id)), 200

# API routes for resource usage and billing
@app.route('/api/billing/<int:case_id>', methods=['GET'])
@auth_system._require_auth
def get_billing(case_id):
    if case_id not in cases:
        return jsonify({'error': 'Case not found'}), 404
    
    # Calculate resource usage
    resource_usage = {
        'ai_processing_time_ms': 0,
        'storage_bytes_used': 0,
        'email_count': 0,
        'follow_up_count': 0,
        'total_resource_cost': 0,
        'user_charge': 0
    }
    
    # Add document aggregation resource usage
    if case_id in documents:
        doc_aggregator = DocumentAggregator(case_id=case_id, user_id=0)
        doc_usage = doc_aggregator.calculate_resource_usage()
        resource_usage['ai_processing_time_ms'] += doc_usage.get('processing_time_ms', 0)
        resource_usage['storage_bytes_used'] += doc_usage.get('total_size_bytes', 0)
        resource_usage['total_resource_cost'] += doc_usage.get('estimated_cost', 0)
    
    # Add outreach resource usage
    if case_id in outreach_campaigns:
        outreach_system = outreach_campaigns[case_id]
        outreach_usage = outreach_system.calculate_resource_usage()
        resource_usage['email_count'] += outreach_usage.get('email_count', 0)
        resource_usage['follow_up_count'] += outreach_usage.get('follow_up_count', 0)
        resource_usage['total_resource_cost'] += outreach_usage.get('estimated_cost', 0)
    
    # Calculate user charge (resource cost × 2)
    resource_usage['user_charge'] = resource_usage['total_resource_cost'] * 2
    
    # Record billing check event in time-series database
    user_id = session.get('user_id', 0)
    timeseries_manager.record_user_activity(
        user_id=str(user_id),
        activity_type='check_billing',
        resource='billing',
        details={
            'case_id': case_id,
            'total_cost': resource_usage['user_charge']
        }
    )
    
    return jsonify({
        'case_id': case_id,
        'resource_usage': resource_usage
    }), 200

# API route for metrics dashboard
@app.route('/api/metrics', methods=['GET'])
@auth_system._require_auth
def get_metrics():
    # Get query parameters
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    category = request.args.get('category')
    
    # Convert string dates to datetime objects if provided
    from datetime import datetime
    start_time = datetime.fromisoformat(start_date) if start_date else None
    end_time = datetime.fromisoformat(end_date) if end_date else None
    
    # Get metrics from time-series database
    case_metrics = timeseries_manager.get_case_metrics(
        start_time=start_time,
        end_time=end_time,
        category=category
    )
    
    # Record metrics view event in time-series database
    user_id = session.get('user_id', 0)
    timeseries_manager.record_user_activity(
        user_id=str(user_id),
        activity_type='view',
        resource='metrics',
        details={
            'start_date': start_date,
            'end_date': end_date,
            'category': category
        }
    )
    
    return jsonify(case_metrics), 200

# API route for system metrics
@app.route('/api/system/metrics', methods=['GET'])
@auth_system._require_auth
def get_system_metrics():
    # Get query parameters
    metric_type = request.args.get('type', 'cpu_usage')
    
    # Get system metrics from time-series database
    system_metrics = timeseries_manager.get_system_metrics(
        metric_type=metric_type
    )
    
    # Record system metrics view event in time-series database
    user_id = session.get('user_id', 0)
    timeseries_manager.record_user_activity(
        user_id=str(user_id),
        activity_type='view',
        resource='system_metrics',
        details={
            'metric_type': metric_type
        }
    )
    
    return jsonify(system_metrics), 200

# API route for serverless functions
@app.route('/api/serverless/functions', methods=['GET'])
@auth_system._require_auth
def get_serverless_functions():
    # Get serverless functions from serverless manager
    serverless_manager = app.config.get('serverless_manager')
    if not serverless_manager:
        return jsonify({'error': 'Serverless manager not initialized'}), 500
    
    functions = serverless_manager.list_functions()
    
    return jsonify({
        'functions': functions
    }), 200

# API route for event history
@app.route('/api/serverless/events', methods=['GET'])
@auth_system._require_auth
def get_event_history():
    # Get event type filter
    event_type = request.args.get('type')
    
    # Get event bus from app config
    event_bus = app.config.get('event_bus')
    if not event_bus:
        return jsonify({'error': 'Event bus not initialized'}), 500
    
    # Get event history
    events = event_bus.get_event_history(event_type)
    
    return jsonify({
        'events': events
    }), 200

# User login handler
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    
    if 'email' not in data:
        return jsonify({'error': 'Email is required'}), 400
    
    email = data['email']
    
    # Authenticate user (simplified for demo)
    user_id = hash(email) % 1000  # Generate a deterministic user ID
    
    # Set user ID in session
    session['user_id'] = user_id
    
    # Publish user login event for serverless processing
    from serverless_functions import publish_user_login_event
    publish_user_login_event(
        user_id=user_id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent', '')
    )
    
    return jsonify({
        'user_id': user_id,
        'email': email
    }), 200

# User search handler
@app.route('/api/search', methods=['GET'])
@auth_system._require_auth
def search():
    query = request.args.get('q')
    if not query:
        return jsonify({'error': 'Query is required'}), 400
    
    user_id = session.get('user_id', 0)
    
    # Publish user search event for serverless processing
    from serverless_functions import publish_user_search_event
    publish_user_search_event(
        user_id=user_id,
        query=query,
        filters=request.args.to_dict()
    )
    
    # Perform search (simplified for demo)
    results = []
    for case_id, case in cases.items():
        if query.lower() in case.get('case_description', '').lower():
            results.append(case)
    
    return jsonify({
        'query': query,
        'results': results
    }), 200

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def server_error(error):
    logger.error(f"Server error: {error}")
    
    # Record error event in time-series database
    timeseries_manager.record_system_metric(
        metric_type='error',
        value=1.0,
        component='api_server',
        details={
            'error_type': '500',
            'error_message': str(error)
        }
    )
    
    return jsonify({'error': 'Internal server error'}), 500

# Main entry point
if __name__ == '__main__':
    # Record application start event
    timeseries_manager.record_system_metric(
        metric_type='application_start',
        value=1.0,
        component='main',
        details={
            'version': '1.0.0',
            'environment': os.environ.get('FLASK_ENV', 'development')
        }
    )
    
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
