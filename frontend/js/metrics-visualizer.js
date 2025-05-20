// Real-time Data Visualization for Legal Metrics
// This file contains the JavaScript code for real-time data visualization
// It connects to the backend API and updates the charts dynamically

class LegalMetricsVisualizer {
    constructor() {
        this.charts = {};
        this.metrics = {};
        this.updateInterval = 10000; // Update every 10 seconds
        this.token = null;
        this.initialized = false;
    }

    // Initialize the visualizer with authentication token
    initialize(token) {
        this.token = token;
        this.fetchInitialData();
        this.setupRealTimeUpdates();
        this.initialized = true;
    }

    // Fetch initial data from the backend
    async fetchInitialData() {
        try {
            // Fetch all required data
            const summaryData = await this.fetchData('/api/metrics/summary');
            const performanceData = await this.fetchData('/api/metrics/performance');
            const assumptionsData = await this.fetchData('/api/metrics/assumptions');
            const projectionsData = await this.fetchData('/api/metrics/projections');

            // Store the data
            this.metrics = {
                summary: summaryData,
                performance: performanceData,
                assumptions: assumptionsData,
                projections: projectionsData
            };

            // Initialize the dashboard
            this.updateSummaryMetrics();
            this.initializeCharts();
        } catch (error) {
            console.error('Error fetching initial data:', error);
        }
    }

    // Set up real-time updates
    setupRealTimeUpdates() {
        setInterval(() => {
            this.fetchRealTimeData();
        }, this.updateInterval);
    }

    // Fetch real-time data from the backend
    async fetchRealTimeData() {
        try {
            const realTimeData = await this.fetchData('/api/metrics/realtime');
            this.updateRealTimeMetrics(realTimeData);
        } catch (error) {
            console.error('Error fetching real-time data:', error);
        }
    }

    // Helper method to fetch data from the API
    async fetchData(endpoint) {
        const response = await fetch(endpoint, {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        return await response.json();
    }

    // Update summary metrics on the dashboard
    updateSummaryMetrics() {
        const summary = this.metrics.summary;

        // Update response rate
        document.querySelector('.response-rate .metric-value').textContent = `${summary.response_rate.value.toFixed(0)}%`;
        const responseRateChange = document.querySelector('.response-rate .metric-change');
        responseRateChange.textContent = `${summary.response_rate.change > 0 ? '+' : ''}${summary.response_rate.change.toFixed(0)}% vs Target`;
        responseRateChange.className = `metric-change ${summary.response_rate.change > 0 ? 'positive' : 'negative'}`;

        // Update case acceptance
        document.querySelector('.case-acceptance .metric-value').textContent = `${summary.case_acceptance.value.toFixed(1)}%`;
        const caseAcceptanceChange = document.querySelector('.case-acceptance .metric-change');
        caseAcceptanceChange.textContent = `${summary.case_acceptance.change > 0 ? '+' : ''}${summary.case_acceptance.change.toFixed(1)}% vs Baseline`;
        caseAcceptanceChange.className = `metric-change ${summary.case_acceptance.change > 0 ? 'positive' : 'negative'}`;

        // Update time to lawyer
        document.querySelector('.time-to-lawyer .metric-value').textContent = `${summary.time_to_lawyer.value.toFixed(1)}h`;
        const timeToLawyerChange = document.querySelector('.time-to-lawyer .metric-change');
        timeToLawyerChange.textContent = `${summary.time_to_lawyer.change > 0 ? '+' : ''}${summary.time_to_lawyer.change.toFixed(1)}h vs Target`;
        timeToLawyerChange.className = `metric-change ${summary.time_to_lawyer.change < 0 ? 'positive' : 'negative'}`;

        // Update profit margin
        document.querySelector('.profit-margin .metric-value').textContent = `${summary.profit_margin.value.toFixed(0)}%`;
        const profitMarginChange = document.querySelector('.profit-margin .metric-change');
        profitMarginChange.textContent = `${summary.profit_margin.change > 0 ? '+' : ''}${summary.profit_margin.change.toFixed(0)}% vs Target`;
        profitMarginChange.className = `metric-change ${summary.profit_margin.change > 0 ? 'positive' : 'negative'}`;
    }

    // Update real-time metrics on the dashboard
    updateRealTimeMetrics(realTimeData) {
        // Update response rate
        document.querySelector('.response-rate .metric-value').textContent = `${realTimeData.response_rate.value.toFixed(0)}%`;
        const responseRateChange = document.querySelector('.response-rate .metric-change');
        responseRateChange.textContent = `${realTimeData.response_rate.change > 0 ? '+' : ''}${realTimeData.response_rate.change.toFixed(0)}% vs Target`;
        responseRateChange.className = `metric-change ${realTimeData.response_rate.change > 0 ? 'positive' : 'negative'}`;

        // Update case acceptance
        document.querySelector('.case-acceptance .metric-value').textContent = `${realTimeData.case_acceptance.value.toFixed(1)}%`;
        const caseAcceptanceChange = document.querySelector('.case-acceptance .metric-change');
        caseAcceptanceChange.textContent = `${realTimeData.case_acceptance.change > 0 ? '+' : ''}${realTimeData.case_acceptance.change.toFixed(1)}% vs Baseline`;
        caseAcceptanceChange.className = `metric-change ${realTimeData.case_acceptance.change > 0 ? 'positive' : 'negative'}`;

        // Update time to lawyer
        document.querySelector('.time-to-lawyer .metric-value').textContent = `${realTimeData.time_to_lawyer.value.toFixed(1)}h`;
        const timeToLawyerChange = document.querySelector('.time-to-lawyer .metric-change');
        timeToLawyerChange.textContent = `${realTimeData.time_to_lawyer.change > 0 ? '+' : ''}${realTimeData.time_to_lawyer.change.toFixed(1)}h vs Target`;
        timeToLawyerChange.className = `metric-change ${realTimeData.time_to_lawyer.change < 0 ? 'positive' : 'negative'}`;

        // Update profit margin
        document.querySelector('.profit-margin .metric-value').textContent = `${realTimeData.profit_margin.value.toFixed(0)}%`;
        const profitMarginChange = document.querySelector('.profit-margin .metric-change');
        profitMarginChange.textContent = `${realTimeData.profit_margin.change > 0 ? '+' : ''}${realTimeData.profit_margin.change.toFixed(0)}% vs Target`;
        profitMarginChange.className = `metric-change ${realTimeData.profit_margin.change > 0 ? 'positive' : 'negative'}`;

        // Update charts with new data points if needed
        this.updateCharts(realTimeData);
    }

    // Initialize all charts
    initializeCharts() {
        this.initializeResponseRateChart();
        this.initializeAcceptanceRateChart();
        this.initializeTimeToLawyerChart();
        this.initializeResourceConsumptionChart();
        this.initializeRevenueChart();
        this.initializeProjectionCharts();
    }

    // Initialize response rate chart
    initializeResponseRateChart() {
        const ctx = document.getElementById('responseRateChart').getContext('2d');
        const data = this.metrics.performance.response_rates;
        
        this.charts.responseRate = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.months,
                datasets: [{
                    label: 'Actual Response Rate',
                    data: data.history,
                    borderColor: '#4a6da7',
                    backgroundColor: 'rgba(74, 109, 167, 0.1)',
                    tension: 0.3,
                    fill: true
                }, {
                    label: 'Target Response Rate',
                    data: Array(data.months.length).fill(data.target),
                    borderColor: '#ed8936',
                    borderDash: [5, 5],
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    // Initialize acceptance rate chart
    initializeAcceptanceRateChart() {
        const ctx = document.getElementById('acceptanceRateChart').getContext('2d');
        const data = this.metrics.performance.acceptance_rates;
        
        this.charts.acceptanceRate = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.months,
                datasets: [{
                    label: 'Actual Acceptance Rate',
                    data: data.history,
                    borderColor: '#4a6da7',
                    backgroundColor: 'rgba(74, 109, 167, 0.1)',
                    tension: 0.3,
                    fill: true
                }, {
                    label: 'Baseline Acceptance Rate',
                    data: Array(data.months.length).fill(data.baseline),
                    borderColor: '#ed8936',
                    borderDash: [5, 5],
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    // Initialize time to lawyer chart
    initializeTimeToLawyerChart() {
        const ctx = document.getElementById('timeToLawyerChart').getContext('2d');
        const data = this.metrics.performance.time_to_lawyer;
        
        this.charts.timeToLawyer = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.months,
                datasets: [{
                    label: 'Average Time (Hours)',
                    data: data.history,
                    borderColor: '#4a6da7',
                    backgroundColor: 'rgba(74, 109, 167, 0.1)',
                    tension: 0.3,
                    fill: true
                }, {
                    label: 'Target Time (Hours)',
                    data: Array(data.months.length).fill(data.target),
                    borderColor: '#ed8936',
                    borderDash: [5, 5],
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + 'h';
                            }
                        }
                    }
                }
            }
        });
    }

    // Initialize resource consumption chart
    initializeResourceConsumptionChart() {
        const ctx = document.getElementById('resourceConsumptionChart').getContext('2d');
        const data = this.metrics.performance.resource_consumption;
        
        this.charts.resourceConsumption = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.months,
                datasets: [{
                    label: 'AI Processing',
                    data: data.ai_processing,
                    backgroundColor: '#4a6da7',
                }, {
                    label: 'Storage',
                    data: data.storage,
                    backgroundColor: '#ed8936',
                }, {
                    label: 'Email Outreach',
                    data: data.email_outreach,
                    backgroundColor: '#38a169',
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                    },
                    y: {
                        stacked: true,
                        ticks: {
                            callback: function(value) {
                                return '€' + value;
                            }
                        }
                    }
                }
            }
        });
    }

    // Initialize revenue chart
    initializeRevenueChart() {
        const ctx = document.getElementById('revenueChart').getContext('2d');
        const data = this.metrics.performance.revenue;
        
        this.charts.revenue = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.months,
                datasets: [{
                    label: 'Revenue',
                    data: data.revenue,
                    borderColor: '#38a169',
                    backgroundColor: 'rgba(56, 161, 105, 0.1)',
                    tension: 0.3,
                    fill: true
                }, {
                    label: 'Costs',
                    data: data.costs,
                    borderColor: '#e53e3e',
                    backgroundColor: 'rgba(229, 62, 62, 0.1)',
                    tension: 0.3,
                    fill: true
                }, {
                    label: 'Profit',
                    data: data.profit,
                    borderColor: '#4a6da7',
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '€' + value + 'K';
                            }
                        }
                    }
                }
            }
        });
    }

    // Initialize projection charts
    initializeProjectionCharts() {
        // Revenue Projection Chart
        const revenueProjectionCtx = document.getElementById('revenueProjectionChart').getContext('2d');
        const projectionData = this.metrics.projections.revenue_projections;
        
        this.charts.revenueProjection = new Chart(revenueProjectionCtx, {
            type: 'line',
            data: {
                labels: projectionData.quarters,
                datasets: [{
                    label: 'Projected Revenue',
                    data: projectionData.projected_revenue,
                    borderColor: '#4a6da7',
                    borderDash: [5, 5],
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    fill: false
                }, {
                    label: 'Actual Revenue',
                    data: projectionData.actual_revenue,
                    borderColor: '#38a169',
                    backgroundColor: 'rgba(56, 161, 105, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '€' + value + 'K';
                            }
                        }
                    }
                }
            }
        });

        // User Growth Chart
        const userGrowthCtx = document.getElementById('userGrowthChart').getContext('2d');
        const userGrowthData = this.metrics.projections.user_growth;
        
        this.charts.userGrowth = new Chart(userGrowthCtx, {
            type: 'line',
            data: {
                labels: userGrowthData.months,
                datasets: [{
                    label: 'Projected Users',
                    data: userGrowthData.projected,
                    borderColor: '#4a6da7',
                    borderDash: [5, 5],
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    fill: false
                }, {
                    label: 'Actual Users',
                    data: userGrowthData.actual,
                    borderColor: '#38a169',
                    backgroundColor: 'rgba(56, 161, 105, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Case Volume Chart
        const caseVolumeCtx = document.getElementById('caseVolumeChart').getContext('2d');
        const caseVolumeData = this.metrics.projections.case_volume;
        
        this.charts.caseVolume = new Chart(caseVolumeCtx, {
            type: 'bar',
            data: {
                labels: caseVolumeData.months,
                datasets: [{
                    label: 'New Cases',
                    data: caseVolumeData.new_cases,
                    backgroundColor: '#4a6da7',
                }, {
                    label: 'Completed Cases',
                    data: caseVolumeData.completed_cases,
                    backgroundColor: '#38a169',
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Update impact goals progress bars
        this.updateImpactGoalsProgress();
    }

    // Update impact goals progress bars
    updateImpactGoalsProgress() {
        const impactGoals = this.metrics.projections.impact_goals;
        
        // Response Rate Improvement
        const responseRateProgress = document.querySelector('.response-rate-progress .progress-bar');
        responseRateProgress.style.width = `${impactGoals.response_rate_improvement.current}%`;
        responseRateProgress.textContent = `${Math.round(impactGoals.response_rate_improvement.current)}%`;
        
        // Time Reduction
        const timeReductionProgress = document.querySelector('.time-reduction-progress .progress-bar');
        timeReductionProgress.style.width = `${impactGoals.time_reduction.current}%`;
        timeReductionProgress.textContent = `${Math.round(impactGoals.time_reduction.current)}%`;
        
        // Access Improvement
        const accessImprovementProgress = document.querySelector('.access-improvement-progress .progress-bar');
        accessImprovementProgress.style.width = `${impactGoals.access_improvement.current}%`;
        accessImprovementProgress.textContent = `${Math.round(impactGoals.access_improvement.current)}%`;
    }

    // Update charts with new data
    updateCharts(realTimeData) {
        // In a real implementation, we would update the charts with new data points
        // For this demo, we'll just update the impact goals progress
        const responseRateProgress = document.querySelector('.response-rate-progress .progress-bar');
        const currentResponseRate = parseFloat(responseRateProgress.textContent);
        const newResponseRate = currentResponseRate + (Math.random() * 0.5 - 0.25);
        responseRateProgress.style.width = `${newResponseRate}%`;
        responseRateProgress.textContent = `${Math.round(newResponseRate)}%`;
    }
}

// Initialize the visualizer when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Create the visualizer instance
    window.legalMetricsVisualizer = new LegalMetricsVisualizer();
    
    // Handle investor authentication form submission
    const investorAuthForm = document.getElementById('investorAuthForm');
    if (investorAuthForm) {
        investorAuthForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('investorEmail').value;
            
            // In a real implementation, this would authenticate with the backend
            // For demo purposes, we'll simulate authentication
            if (email) {
                document.getElementById('investorAuth').style.display = 'none';
                document.getElementById('investorDashboard').style.display = 'block';
                
                // Initialize the visualizer with a dummy token
                window.legalMetricsVisualizer.initialize('dummy_token');
            }
        });
    }
});
