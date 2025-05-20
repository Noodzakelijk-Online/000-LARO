"""
Time-Series Database Integration for Legal AI Platform

This module provides specialized functions for working with time-series data
for metrics, analytics, and monitoring.
"""

import logging
import time
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

from db_optimization import db_manager

# Configure logging
logger = logging.getLogger('legal_ai_platform.timeseries')

class TimeSeriesManager:
    """
    Manager class for time-series database operations including
    metrics recording, querying, and aggregation.
    """
    
    def __init__(self):
        self.initialized = False
        self.retention_policy = "30d"  # Default retention policy
        
        # Initialize time-series database
        self._initialize()
    
    def _initialize(self):
        """Initialize the time-series database connection"""
        try:
            # Get time-series database connection
            self.ts_conn = db_manager.get_timeseries_connection()
            
            # Set retention policy from config
            config = db_manager.config.get('timeSeries', {})
            self.retention_policy = config.get('retentionPolicy', self.retention_policy)
            
            self.initialized = True
            logger.info("Time-series database initialized")
        except Exception as e:
            logger.error(f"Failed to initialize time-series database: {e}")
    
    def record_case_event(self, case_id: str, event_type: str, category: str, 
                         user_id: Optional[str] = None, details: Optional[Dict] = None):
        """
        Record a case event in the time-series database
        
        Args:
            case_id: ID of the case
            event_type: Type of event (created, updated, resolved, etc.)
            category: Legal category of the case
            user_id: ID of the user who triggered the event
            details: Additional details about the event
        """
        if not self.initialized:
            logger.warning("Time-series database not initialized, skipping event recording")
            return
        
        # Prepare tags and fields
        tags = {
            'event': event_type,
            'category': category
        }
        
        if user_id:
            tags['user_id'] = user_id
        
        fields = {
            'case_id': case_id,
            'count': 1
        }
        
        if details:
            # Add details as fields
            for key, value in details.items():
                # Convert non-numeric values to strings
                if not isinstance(value, (int, float, bool)):
                    value = str(value)
                fields[key] = value
        
        # Record the event
        db_manager.record_metric(
            measurement='case_events',
            tags=tags,
            fields=fields,
            timestamp=datetime.utcnow()
        )
        
        logger.debug(f"Recorded case event: {event_type} for case {case_id}")
    
    def record_user_activity(self, user_id: str, activity_type: str, 
                            resource: Optional[str] = None, details: Optional[Dict] = None):
        """
        Record a user activity in the time-series database
        
        Args:
            user_id: ID of the user
            activity_type: Type of activity (login, search, view, etc.)
            resource: Resource being accessed (case, document, etc.)
            details: Additional details about the activity
        """
        if not self.initialized:
            logger.warning("Time-series database not initialized, skipping activity recording")
            return
        
        # Prepare tags and fields
        tags = {
            'user_id': user_id,
            'activity': activity_type
        }
        
        if resource:
            tags['resource'] = resource
        
        fields = {
            'count': 1,
            'timestamp': int(time.time())
        }
        
        if details:
            # Add details as fields
            for key, value in details.items():
                # Convert non-numeric values to strings
                if not isinstance(value, (int, float, bool)):
                    value = str(value)
                fields[key] = value
        
        # Record the activity
        db_manager.record_metric(
            measurement='user_activities',
            tags=tags,
            fields=fields,
            timestamp=datetime.utcnow()
        )
        
        logger.debug(f"Recorded user activity: {activity_type} for user {user_id}")
    
    def record_system_metric(self, metric_type: str, value: float, 
                            component: Optional[str] = None, details: Optional[Dict] = None):
        """
        Record a system metric in the time-series database
        
        Args:
            metric_type: Type of metric (cpu, memory, requests, etc.)
            value: Numeric value of the metric
            component: System component being measured
            details: Additional details about the metric
        """
        if not self.initialized:
            logger.warning("Time-series database not initialized, skipping metric recording")
            return
        
        # Prepare tags and fields
        tags = {
            'metric': metric_type
        }
        
        if component:
            tags['component'] = component
        
        fields = {
            'value': value
        }
        
        if details:
            # Add details as fields
            for key, value in details.items():
                # Convert non-numeric values to strings
                if not isinstance(value, (int, float, bool)):
                    value = str(value)
                fields[key] = value
        
        # Record the metric
        db_manager.record_metric(
            measurement='system_metrics',
            tags=tags,
            fields=fields,
            timestamp=datetime.utcnow()
        )
        
        logger.debug(f"Recorded system metric: {metric_type} = {value}")
    
    def get_case_metrics(self, start_time: Optional[datetime] = None, 
                        end_time: Optional[datetime] = None, 
                        category: Optional[str] = None) -> Dict:
        """
        Get case metrics for a time period
        
        Args:
            start_time: Start time for the query (defaults to 30 days ago)
            end_time: End time for the query (defaults to now)
            category: Filter by legal category
        
        Returns:
            Dictionary with case metrics
        """
        if not self.initialized:
            logger.warning("Time-series database not initialized, skipping metric query")
            return {}
        
        # Set default time range if not provided
        if not start_time:
            start_time = datetime.utcnow() - timedelta(days=30)
        
        if not end_time:
            end_time = datetime.utcnow()
        
        # Format times for query
        start_str = start_time.isoformat() + 'Z'
        end_str = end_time.isoformat() + 'Z'
        
        # Build query
        query = f"""
            SELECT 
                COUNT("case_id") AS total_cases,
                COUNT("case_id") WHERE "event" = 'resolved' AS resolved_cases,
                MEAN("resolution_time") AS avg_resolution_time
            FROM case_events
            WHERE time >= '{start_str}' AND time <= '{end_str}'
        """
        
        if category:
            query += f" AND \"category\" = '{category}'"
        
        # Execute query
        result = db_manager.query_metrics(query)
        
        # Process result
        metrics = {
            'total_cases': 0,
            'resolved_cases': 0,
            'avg_resolution_time': 0,
            'categories': [],
            'monthly_trends': []
        }
        
        if result and 'series' in result and result['series']:
            # Extract metrics from result
            series = result['series'][0]
            if 'values' in series:
                metrics['total_cases'] = series['values'][0]
                metrics['resolved_cases'] = series['values'][1]
                metrics['avg_resolution_time'] = series['values'][2]
        
        # Get category breakdown
        category_query = f"""
            SELECT 
                "category",
                COUNT("case_id") AS count
            FROM case_events
            WHERE time >= '{start_str}' AND time <= '{end_str}'
            GROUP BY "category"
        """
        
        category_result = db_manager.query_metrics(category_query)
        
        if category_result and 'series' in category_result and category_result['series']:
            # Extract categories from result
            for series in category_result['series']:
                category_name = series.get('tags', {}).get('category', 'Unknown')
                count = series.get('values', [0])[0]
                
                metrics['categories'].append({
                    'category': category_name,
                    'count': count
                })
        
        # Get monthly trends
        monthly_query = f"""
            SELECT 
                COUNT("case_id") WHERE "event" = 'created' AS new_cases,
                COUNT("case_id") WHERE "event" = 'resolved' AS resolved_cases,
                MEAN("resolution_time") AS avg_resolution_time
            FROM case_events
            WHERE time >= '{start_str}' AND time <= '{end_str}'
            GROUP BY time(30d)
        """
        
        monthly_result = db_manager.query_metrics(monthly_query)
        
        if monthly_result and 'series' in monthly_result and monthly_result['series']:
            # Extract monthly trends from result
            series = monthly_result['series'][0]
            if 'values' in series:
                for i, value in enumerate(series['values']):
                    month_date = start_time + timedelta(days=i*30)
                    month_str = month_date.strftime('%Y-%m')
                    
                    metrics['monthly_trends'].append({
                        'month': month_str,
                        'new_cases': value if isinstance(value, int) else value[0] if isinstance(value, (list, tuple)) and len(value) > 0 else 0,
                        'resolved_cases': value[1] if isinstance(value, (list, tuple)) and len(value) > 1 else 0,
                        'avg_resolution_time': value[2] if isinstance(value, (list, tuple)) and len(value) > 2 else 0
                    })
        
        return metrics
    
    def get_user_activity_metrics(self, start_time: Optional[datetime] = None, 
                                end_time: Optional[datetime] = None, 
                                user_id: Optional[str] = None) -> Dict:
        """
        Get user activity metrics for a time period
        
        Args:
            start_time: Start time for the query (defaults to 30 days ago)
            end_time: End time for the query (defaults to now)
            user_id: Filter by user ID
        
        Returns:
            Dictionary with user activity metrics
        """
        if not self.initialized:
            logger.warning("Time-series database not initialized, skipping metric query")
            return {}
        
        # Set default time range if not provided
        if not start_time:
            start_time = datetime.utcnow() - timedelta(days=30)
        
        if not end_time:
            end_time = datetime.utcnow()
        
        # Format times for query
        start_str = start_time.isoformat() + 'Z'
        end_str = end_time.isoformat() + 'Z'
        
        # Build query
        query = f"""
            SELECT 
                COUNT("count") AS total_activities,
                COUNT("count") WHERE "activity" = 'login' AS logins,
                COUNT("count") WHERE "activity" = 'search' AS searches,
                COUNT("count") WHERE "activity" = 'view' AS views
            FROM user_activities
            WHERE time >= '{start_str}' AND time <= '{end_str}'
        """
        
        if user_id:
            query += f" AND \"user_id\" = '{user_id}'"
        
        # Execute query
        result = db_manager.query_metrics(query)
        
        # Process result
        metrics = {
            'total_activities': 0,
            'logins': 0,
            'searches': 0,
            'views': 0,
            'activity_by_day': [],
            'top_resources': []
        }
        
        if result and 'series' in result and result['series']:
            # Extract metrics from result
            series = result['series'][0]
            if 'values' in series and series['values']:
                values = series['values']
                metrics['total_activities'] = values[0] if len(values) > 0 else 0
                metrics['logins'] = values[1] if len(values) > 1 else 0
                metrics['searches'] = values[2] if len(values) > 2 else 0
                metrics['views'] = values[3] if len(values) > 3 else 0
        
        # Get activity by day
        daily_query = f"""
            SELECT 
                COUNT("count") AS activities
            FROM user_activities
            WHERE time >= '{start_str}' AND time <= '{end_str}'
            GROUP BY time(1d)
        """
        
        if user_id:
            daily_query += f" AND \"user_id\" = '{user_id}'"
        
        daily_result = db_manager.query_metrics(daily_query)
        
        if daily_result and 'series' in daily_result and daily_result['series']:
            # Extract daily activities from result
            series = daily_result['series'][0]
            if 'values' in series:
                for i, value in enumerate(series['values']):
                    day_date = start_time + timedelta(days=i)
                    day_str = day_date.strftime('%Y-%m-%d')
                    
                    metrics['activity_by_day'].append({
                        'date': day_str,
                        'activities': value if isinstance(value, int) else value[0] if isinstance(value, (list, tuple)) and len(value) > 0 else 0
                    })
        
        # Get top resources
        resource_query = f"""
            SELECT 
                "resource",
                COUNT("count") AS count
            FROM user_activities
            WHERE time >= '{start_str}' AND time <= '{end_str}'
            GROUP BY "resource"
            ORDER BY count DESC
            LIMIT 10
        """
        
        if user_id:
            resource_query += f" AND \"user_id\" = '{user_id}'"
        
        resource_result = db_manager.query_metrics(resource_query)
        
        if resource_result and 'series' in resource_result and resource_result['series']:
            # Extract top resources from result
            for series in resource_result['series']:
                resource_name = series.get('tags', {}).get('resource', 'Unknown')
                count = series.get('values', [0])[0]
                
                metrics['top_resources'].append({
                    'resource': resource_name,
                    'count': count
                })
        
        return metrics
    
    def get_system_metrics(self, start_time: Optional[datetime] = None, 
                          end_time: Optional[datetime] = None, 
                          metric_type: Optional[str] = None) -> Dict:
        """
        Get system metrics for a time period
        
        Args:
            start_time: Start time for the query (defaults to 24 hours ago)
            end_time: End time for the query (defaults to now)
            metric_type: Filter by metric type
        
        Returns:
            Dictionary with system metrics
        """
        if not self.initialized:
            logger.warning("Time-series database not initialized, skipping metric query")
            return {}
        
        # Set default time range if not provided
        if not start_time:
            start_time = datetime.utcnow() - timedelta(hours=24)
        
        if not end_time:
            end_time = datetime.utcnow()
        
        # Format times for query
        start_str = start_time.isoformat() + 'Z'
        end_str = end_time.isoformat() + 'Z'
        
        # Build query
        query = f"""
            SELECT 
                MEAN("value") AS avg_value,
                MIN("value") AS min_value,
                MAX("value") AS max_value
            FROM system_metrics
            WHERE time >= '{start_str}' AND time <= '{end_str}'
        """
        
        if metric_type:
            query += f" AND \"metric\" = '{metric_type}'"
        
        # Execute query
        result = db_manager.query_metrics(query)
        
        # Process result
        metrics = {
            'avg_value': 0,
            'min_value': 0,
            'max_value': 0,
            'values_by_time': [],
            'components': []
        }
        
        if result and 'series' in result and result['series']:
            # Extract metrics from result
            series = result['series'][0]
            if 'values' in series:
                metrics['avg_value'] = series['values'][0]
                metrics['min_value'] = series['values'][1]
                metrics['max_value'] = series['values'][2]
        
        # Get values by time
        time_query = f"""
            SELECT 
                MEAN("value") AS value
            FROM system_metrics
            WHERE time >= '{start_str}' AND time <= '{end_str}'
            GROUP BY time(5m)
        """
        
        if metric_type:
            time_query += f" AND \"metric\" = '{metric_type}'"
        
        time_result = db_manager.query_metrics(time_query)
        
        if time_result and 'series' in time_result and time_result['series']:
            # Extract values by time from result
            series = time_result['series'][0]
            if 'values' in series:
                for i, value in enumerate(series['values']):
                    time_point = start_time + timedelta(minutes=i*5)
                    time_str = time_point.strftime('%Y-%m-%d %H:%M:%S')
                    
                    metrics['values_by_time'].append({
                        'time': time_str,
                        'value': value[0]
                    })
        
        # Get component breakdown
        component_query = f"""
            SELECT 
                "component",
                MEAN("value") AS avg_value
            FROM system_metrics
            WHERE time >= '{start_str}' AND time <= '{end_str}'
            GROUP BY "component"
        """
        
        if metric_type:
            component_query += f" AND \"metric\" = '{metric_type}'"
        
        component_result = db_manager.query_metrics(component_query)
        
        if component_result and 'series' in component_result and component_result['series']:
            # Extract components from result
            for series in component_result['series']:
                component_name = series.get('tags', {}).get('component', 'Unknown')
                avg_value = series.get('values', [0])[0]
                
                metrics['components'].append({
                    'component': component_name,
                    'avg_value': avg_value
                })
        
        return metrics

# Create a global instance
timeseries_manager = TimeSeriesManager()

# Example usage:
# # Record a case event
# timeseries_manager.record_case_event(
#     case_id='123',
#     event_type='created',
#     category='FAMILY_LAW',
#     user_id='456',
#     details={'complexity': 'high', 'priority': 'medium'}
# )
#
# # Record a user activity
# timeseries_manager.record_user_activity(
#     user_id='456',
#     activity_type='search',
#     resource='cases',
#     details={'query': 'divorce', 'results': 5}
# )
#
# # Record a system metric
# timeseries_manager.record_system_metric(
#     metric_type='cpu_usage',
#     value=45.2,
#     component='api_server',
#     details={'host': 'server1', 'process': 'web'}
# )
#
# # Get case metrics
# case_metrics = timeseries_manager.get_case_metrics(
#     start_time=datetime.utcnow() - timedelta(days=30),
#     category='FAMILY_LAW'
# )
#
# # Get user activity metrics
# user_metrics = timeseries_manager.get_user_activity_metrics(
#     user_id='456'
# )
#
# # Get system metrics
# system_metrics = timeseries_manager.get_system_metrics(
#     metric_type='cpu_usage'
# )
