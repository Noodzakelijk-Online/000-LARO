"""
Database Integration Module for Legal AI Platform

This module integrates the DatabaseOptimizationManager with the Flask application
and provides database access functions for the application.
"""

import logging
from functools import wraps
from flask import current_app, g

from db_optimization import db_manager

# Configure logging
logger = logging.getLogger('legal_ai_platform.db_integration')

def get_db():
    """Get database connection from the current Flask application context"""
    if 'db' not in g:
        g.db = {
            'primary': db_manager.get_primary_connection(),
            'replica': db_manager.get_replica_connection(),
            'timeseries': db_manager.get_timeseries_connection(),
            'cache': db_manager.get_cache_connection()
        }
    return g.db

def close_db(e=None):
    """Close database connections when the Flask application context ends"""
    db = g.pop('db', None)
    
    if db:
        # Close individual connections
        if 'primary' in db and db['primary']:
            db['primary'].disconnect()
        
        if 'replica' in db and db['replica']:
            db['replica'].disconnect()
        
        if 'timeseries' in db and db['timeseries']:
            db['timeseries'].disconnect()
        
        if 'cache' in db and db['cache']:
            db['cache'].disconnect()

def init_app(app):
    """Initialize the database integration with the Flask application"""
    # Register close_db function to be called when the application context ends
    app.teardown_appcontext(close_db)
    
    # Add database manager to app config for easy access
    app.config['db_manager'] = db_manager
    
    logger.info("Database integration initialized")

# Decorator for read operations (uses read replicas)
def read_operation(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get database connections
        db = get_db()
        
        # Use replica connection for read operations
        conn = db['replica']
        
        # Pass connection to the function
        return f(conn, *args, **kwargs)
    
    return decorated_function

# Decorator for write operations (uses primary connection)
def write_operation(collection=None):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get database connections
            db = get_db()
            
            # Use primary connection for write operations
            conn = db['primary']
            
            # Execute the function
            result = f(conn, *args, **kwargs)
            
            # Invalidate cache if collection is specified
            if collection:
                db_manager.invalidate_cache(collection)
            
            return result
        
        return decorated_function
    
    return decorator

# Decorator for sharded operations
def sharded_operation(collection, shard_key_func):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get shard key value from the function
            shard_key_value = shard_key_func(*args, **kwargs)
            
            # Get connection to the appropriate shard
            conn = db_manager.get_shard_connection(collection, shard_key_value)
            
            # Pass connection to the function
            return f(conn, *args, **kwargs)
        
        return decorated_function
    
    return decorator

# Decorator for cached operations
def cached_operation(ttl=None):
    def decorator(f):
        # Use the cached_query decorator from db_manager
        @db_manager.cached_query(ttl=ttl)
        @wraps(f)
        def decorated_function(*args, **kwargs):
            return f(*args, **kwargs)
        
        return decorated_function
    
    return decorator

# Decorator for metric recording
def record_metric(measurement, tags_func=None, fields_func=None):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Execute the function
            result = f(*args, **kwargs)
            
            # Record metric
            tags = tags_func(*args, **kwargs) if tags_func else {}
            fields = fields_func(*args, **kwargs) if fields_func else {}
            
            db_manager.record_metric(
                measurement=measurement,
                tags=tags,
                fields=fields
            )
            
            return result
        
        return decorated_function
    
    return decorator

# Example usage:
# @read_operation
# def get_user(conn, user_id):
#     return conn.execute("SELECT * FROM users WHERE id = %s", [user_id])
#
# @write_operation(collection='users')
# def create_user(conn, user_data):
#     return conn.execute("INSERT INTO users (name, email) VALUES (%s, %s)", 
#                        [user_data['name'], user_data['email']])
#
# @sharded_operation('documents', lambda case_id: {'caseId': case_id})
# def get_case_documents(conn, case_id):
#     return conn.execute("SELECT * FROM documents WHERE case_id = %s", [case_id])
#
# @cached_operation(ttl=60)
# def get_cached_user(user_id):
#     conn = db_manager.get_replica_connection()
#     return conn.execute("SELECT * FROM users WHERE id = %s", [user_id])
#
# @record_metric('case_events', 
#               lambda case_id, category: {'event': 'created', 'category': category},
#               lambda case_id, category: {'case_id': case_id, 'count': 1})
# def create_case(case_data):
#     conn = db_manager.get_primary_connection()
#     result = conn.execute("INSERT INTO cases (title, category) VALUES (%s, %s)",
#                          [case_data['title'], case_data['category']])
#     db_manager.invalidate_cache('cases')
#     return result
