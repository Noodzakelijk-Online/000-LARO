import os
import json
import datetime
import random
from flask import Flask, request, jsonify, render_template, send_from_directory
from authentication import EmailAuthenticationSystem

app = Flask(__name__, static_folder='frontend', template_folder='frontend')
auth_system = EmailAuthenticationSystem(app)

class BusinessMetricsDashboard:
    """
    Dashboard for business assumptions and metrics for the Legal AI Reach Out platform.
    Provides real-time data visualization and comparison against business plan assumptions.
    """
    
    def __init__(self):
        """Initialize the business metrics dashboard."""
        # In a real implementation, these would be fetched from a database
        # For demonstration purposes, we'll use in-memory storage
        self.metrics = {}
        self.assumptions = {}
        
        # Load sample data
        self._load_sample_data()
    
    def _load_sample_data(self):
        """Load sample metrics and assumptions data."""
        # Sample metrics
        self.metrics = {
            'response_rates': {
                'current': 42,
                'target': 30,
                'history': [32, 35, 38, 40, 42, 45],
                'months': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
            },
            'acceptance_rates': {
                'current': 1.8,
                'baseline': 0.7,
                'history': [0.8, 1.0, 1.2, 1.5, 1.7, 1.8],
                'months': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
            },
            'time_to_lawyer': {
                'current': 3.2,
                'target': 2.0,
                'history': [5.8, 5.2, 4.5, 3.8, 3.5, 3.2],
                'months': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
            },
            'profit_margin': {
                'current': 48,
                'target': 50,
                'history': [45, 46, 47, 48, 48, 48],
                'months': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
            },
            'resource_consumption': {
                'ai_processing': [12, 15, 18, 22, 25, 28],
                'storage': [5, 7, 9, 12, 15, 18],
                'email_outreach': [8, 10, 12, 15, 18, 20],
                'months': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
            },
            'revenue': {
                'revenue': [50, 65, 80, 95, 110, 125],
                'costs': [25, 32, 40, 48, 55, 65],
                'profit': [25, 33, 40, 47, 55, 60],
                'months': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
            },
            'projections': {
                'projected_revenue': [150, 250, 400, 600, 850, 1100],
                'actual_revenue': [160, 270, None, None, None, None],
                'quarters': ['Q1', 'Q2', 'Q3', 'Q4', 'Q1 Next', 'Q2 Next']
            },
            'user_growth': {
                'projected': [50, 100, 200, 350, 550, 800],
                'actual': [55, 120, 230, 380, 600, 850],
                'months': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
            },
            'case_volume': {
                'new_cases': [30, 45, 65, 85, 110, 140],
                'completed_cases': [10, 25, 40, 60, 85, 115],
                'months': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
            },
            'impact_goals': {
                'response_rate_improvement': {
                    'current': 42,
                    'target': 50,
                    'description': 'Increase response rates from lawyers by 50% within one year'
                },
                'time_reduction': {
                    'current': 85,
                    'target': 100,
                    'description': 'Reduce average time spent finding a lawyer from weeks to 2 hours tops'
                },
                'access_improvement': {
                    'current': 65,
                    'target': 100,
                    'description': 'Improve access to justice for underserved populations'
                }
            }
        }
        
        # Sample assumptions
        self.assumptions = {
            'market': [
                {
                    'name': 'Market Size',
                    'description': 'Total registered lawyers in the Netherlands',
                    'value': '18,500+'
                },
                {
                    'name': 'Lawyer Workload',
                    'description': 'Percentage of lawyers struggling with high workloads',
                    'value': 'Over 50%'
                },
                {
                    'name': 'Initial Response Rate',
                    'description': 'Percentage of lawyers responding to initial inquiries',
                    'value': '30%'
                },
                {
                    'name': 'Case Acceptance Rate',
                    'description': 'Percentage of lawyers ultimately agreeing to take on cases',
                    'value': '0.1% to 1.3%'
                }
            ],
            'business_model': [
                {
                    'name': 'Revenue Model',
                    'description': 'Pay-per-use based on resource consumption',
                    'value': 'Resource cost × 2'
                },
                {
                    'name': 'AI Processing Cost',
                    'description': 'Cost per minute of AI processing time',
                    'value': '€0.05 per minute'
                },
                {
                    'name': 'Storage Cost',
                    'description': 'Cost per GB of cloud storage',
                    'value': '€0.01 per GB'
                },
                {
                    'name': 'Email Outreach Cost',
                    'description': 'Cost per email sent (including follow-ups)',
                    'value': '€0.01 per email'
                }
            ]
        }
    
    def get_metrics_summary(self):
        """Get a summary of key metrics."""
        return {
            'response_rate': {
                'value': self.metrics['response_rates']['current'],
                'target': self.metrics['response_rates']['target'],
                'change': self.metrics['response_rates']['current'] - self.metrics['response_rates']['target']
            },
            'case_acceptance': {
                'value': self.metrics['acceptance_rates']['current'],
                'baseline': self.metrics['acceptance_rates']['baseline'],
                'change': self.metrics['acceptance_rates']['current'] - self.metrics['acceptance_rates']['baseline']
            },
            'time_to_lawyer': {
                'value': self.metrics['time_to_lawyer']['current'],
                'target': self.metrics['time_to_lawyer']['target'],
                'change': self.metrics['time_to_lawyer']['current'] - self.metrics['time_to_lawyer']['target']
            },
            'profit_margin': {
                'value': self.metrics['profit_margin']['current'],
                'target': self.metrics['profit_margin']['target'],
                'change': self.metrics['profit_margin']['current'] - self.metrics['profit_margin']['target']
            }
        }
    
    def get_performance_metrics(self):
        """Get detailed performance metrics."""
        return {
            'response_rates': self.metrics['response_rates'],
            'acceptance_rates': self.metrics['acceptance_rates'],
            'time_to_lawyer': self.metrics['time_to_lawyer'],
            'resource_consumption': self.metrics['resource_consumption'],
            'revenue': self.metrics['revenue']
        }
    
    def get_business_assumptions(self):
        """Get business plan assumptions."""
        return self.assumptions
    
    def get_financial_projections(self):
        """Get financial projections and actual performance."""
        return {
            'revenue_projections': self.metrics['projections'],
            'user_growth': self.metrics['user_growth'],
            'case_volume': self.metrics['case_volume'],
            'impact_goals': self.metrics['impact_goals']
        }
    
    def get_real_time_metrics(self):
        """
        Get real-time metrics with slight variations to simulate live data.
        In a real implementation, this would fetch actual real-time data.
        """
        # Create a copy of the current metrics
        real_time_metrics = self.get_metrics_summary()
        
        # Add small random variations to simulate real-time changes
        for key in real_time_metrics:
            if key == 'response_rate':
                real_time_metrics[key]['value'] += random.uniform(-0.5, 0.5)
            elif key == 'case_acceptance':
                real_time_metrics[key]['value'] += random.uniform(-0.1, 0.1)
            elif key == 'time_to_lawyer':
                real_time_metrics[key]['value'] += random.uniform(-0.2, 0.2)
            elif key == 'profit_margin':
                real_time_metrics[key]['value'] += random.uniform(-0.3, 0.3)
            
            # Recalculate change
            if 'target' in real_time_metrics[key]:
                real_time_metrics[key]['change'] = real_time_metrics[key]['value'] - real_time_metrics[key]['target']
            elif 'baseline' in real_time_metrics[key]:
                real_time_metrics[key]['change'] = real_time_metrics[key]['value'] - real_time_metrics[key]['baseline']
        
        return real_time_metrics
    
    def update_metric(self, metric_name, new_value):
        """
        Update a specific metric with a new value.
        In a real implementation, this would update the database.
        """
        if metric_name == 'response_rate':
            self.metrics['response_rates']['current'] = new_value
            self.metrics['response_rates']['history'].append(new_value)
            self.metrics['response_rates']['history'] = self.metrics['response_rates']['history'][-6:]
            
            # Update impact goal
            self.metrics['impact_goals']['response_rate_improvement']['current'] = (new_value / self.metrics['response_rates']['target']) * 100
            
        elif metric_name == 'case_acceptance':
            self.metrics['acceptance_rates']['current'] = new_value
            self.metrics['acceptance_rates']['history'].append(new_value)
            self.metrics['acceptance_rates']['history'] = self.metrics['acceptance_rates']['history'][-6:]
            
        elif metric_name == 'time_to_lawyer':
            self.metrics['time_to_lawyer']['current'] = new_value
            self.metrics['time_to_lawyer']['history'].append(new_value)
            self.metrics['time_to_lawyer']['history'] = self.metrics['time_to_lawyer']['history'][-6:]
            
            # Update impact goal
            weeks_to_hours = 168  # 1 week = 168 hours
            target_hours = 2
            current_reduction_percent = ((weeks_to_hours - new_value) / (weeks_to_hours - target_hours)) * 100
            self.metrics['impact_goals']['time_reduction']['current'] = min(100, current_reduction_percent)
            
        elif metric_name == 'profit_margin':
            self.metrics['profit_margin']['current'] = new_value
            self.metrics['profit_margin']['history'].append(new_value)
            self.metrics['profit_margin']['history'] = self.metrics['profit_margin']['history'][-6:]
        
        return True

# Create dashboard instance
dashboard = BusinessMetricsDashboard()

# Register routes
@app.route('/')
def index():
    return send_from_directory('frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('frontend', path)

@app.route('/api/metrics/summary', methods=['GET'])
@auth_system._require_investor_auth
def get_metrics_summary():
    return jsonify(dashboard.get_metrics_summary())

@app.route('/api/metrics/performance', methods=['GET'])
@auth_system._require_investor_auth
def get_performance_metrics():
    return jsonify(dashboard.get_performance_metrics())

@app.route('/api/metrics/assumptions', methods=['GET'])
@auth_system._require_investor_auth
def get_business_assumptions():
    return jsonify(dashboard.get_business_assumptions())

@app.route('/api/metrics/projections', methods=['GET'])
@auth_system._require_investor_auth
def get_financial_projections():
    return jsonify(dashboard.get_financial_projections())

@app.route('/api/metrics/realtime', methods=['GET'])
@auth_system._require_investor_auth
def get_real_time_metrics():
    return jsonify(dashboard.get_real_time_metrics())

@app.route('/api/metrics/update', methods=['POST'])
@auth_system._require_investor_auth
def update_metric():
    data = request.json
    
    if 'metric' not in data or 'value' not in data:
        return jsonify({'error': 'Metric name and value are required'}), 400
    
    metric_name = data['metric']
    new_value = data['value']
    
    success = dashboard.update_metric(metric_name, new_value)
    
    if success:
        return jsonify({'message': f'Metric {metric_name} updated successfully'}), 200
    else:
        return jsonify({'error': f'Failed to update metric {metric_name}'}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
