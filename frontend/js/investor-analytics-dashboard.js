// Dedicated Investor Analytics Dashboard Implementation
// This file implements a comprehensive analytics dashboard specifically for investors

// Import required libraries
import React, { useState, useEffect } from 'react';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import { format, subDays, subMonths, subYears, parseISO } from 'date-fns';
import axios from 'axios';

// Analytics Dashboard Component
const InvestorAnalyticsDashboard = () => {
  // State for analytics data
  const [metricsData, setMetricsData] = useState(null);
  const [timeRange, setTimeRange] = useState('month');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comparisonMetric, setComparisonMetric] = useState('responseRate');
  const [forecastPeriod, setForecastPeriod] = useState('quarter');
  
  // State for business assumptions
  const [assumptions, setAssumptions] = useState(null);
  
  // State for financial projections
  const [projections, setProjections] = useState(null);
  
  // State for real-time metrics
  const [realTimeMetrics, setRealTimeMetrics] = useState({
    activeUsers: 0,
    pendingCases: 0,
    activeLawyers: 0,
    todayOutreach: 0
  });
  
  // Fetch analytics data based on time range
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Get metrics history
        const metricsResponse = await axios.get(`/api/metrics/history?period=${timeRange}`);
        setMetricsData(metricsResponse.data.metrics);
        
        // Get business assumptions
        const assumptionsResponse = await axios.get('/api/metrics/assumptions');
        setAssumptions(assumptionsResponse.data.assumptions);
        
        // Get financial projections
        const projectionsResponse = await axios.get('/api/metrics/projections');
        setProjections(projectionsResponse.data.projections);
        
        setIsLoading(false);
      } catch (err) {
        setError('Failed to fetch analytics data');
        setIsLoading(false);
        console.error('Error fetching analytics data:', err);
      }
    };
    
    fetchData();
    
    // Set up real-time metrics polling
    const realTimeInterval = setInterval(() => {
      fetchRealTimeMetrics();
    }, 30000); // Poll every 30 seconds
    
    return () => clearInterval(realTimeInterval);
  }, [timeRange]);
  
  // Fetch real-time metrics
  const fetchRealTimeMetrics = async () => {
    try {
      const response = await axios.get('/api/metrics/realtime');
      setRealTimeMetrics(response.data);
    } catch (err) {
      console.error('Error fetching real-time metrics:', err);
    }
  };
  
  // Format data for charts
  const formatChartData = (data, metric) => {
    if (!data) return null;
    
    return {
      labels: data.map(item => format(parseISO(item.date), 'MMM d, yyyy')),
      datasets: [
        {
          label: getMetricLabel(metric),
          data: data.map(item => item[metric]),
          fill: false,
          backgroundColor: getMetricColor(metric),
          borderColor: getMetricColor(metric),
          tension: 0.4
        }
      ]
    };
  };
  
  // Get metric label
  const getMetricLabel = (metric) => {
    switch(metric) {
      case 'responseRate': return 'Lawyer Response Rate (%)';
      case 'caseAcceptance': return 'Case Acceptance Rate (%)';
      case 'timeToLawyer': return 'Time to Lawyer (hours)';
      case 'profitMargin': return 'Profit Margin (%)';
      case 'totalCases': return 'Total Cases';
      case 'totalOutreach': return 'Total Outreach';
      case 'totalConnections': return 'Total Connections';
      default: return metric;
    }
  };
  
  // Get metric color
  const getMetricColor = (metric) => {
    switch(metric) {
      case 'responseRate': return '#4a6da7';
      case 'caseAcceptance': return '#ed8936';
      case 'timeToLawyer': return '#2a4a7f';
      case 'profitMargin': return '#c05621';
      case 'totalCases': return '#1a365d';
      case 'totalOutreach': return '#7b341e';
      case 'totalConnections': return '#4a6da7';
      default: return '#4a6da7';
    }
  };
  
  // Format data for comparison chart
  const formatComparisonData = () => {
    if (!metricsData) return null;
    
    // Get current and previous period data
    const currentPeriodData = metricsData.slice(-1)[0];
    const previousPeriodData = metricsData.slice(-2)[0];
    
    if (!currentPeriodData || !previousPeriodData) return null;
    
    return {
      labels: ['Previous Period', 'Current Period'],
      datasets: [
        {
          label: getMetricLabel(comparisonMetric),
          data: [previousPeriodData[comparisonMetric], currentPeriodData[comparisonMetric]],
          backgroundColor: [
            'rgba(74, 109, 167, 0.6)',
            'rgba(237, 137, 54, 0.6)'
          ],
          borderColor: [
            'rgba(74, 109, 167, 1)',
            'rgba(237, 137, 54, 1)'
          ],
          borderWidth: 1
        }
      ]
    };
  };
  
  // Format data for forecast chart
  const formatForecastData = () => {
    if (!projections) return null;
    
    const periods = Object.keys(projections);
    
    return {
      labels: periods,
      datasets: [
        {
          label: 'Projected Revenue (€)',
          data: periods.map(period => projections[period].revenue),
          backgroundColor: 'rgba(74, 109, 167, 0.6)',
          borderColor: 'rgba(74, 109, 167, 1)',
          borderWidth: 1,
          type: 'bar'
        },
        {
          label: 'User Growth',
          data: periods.map(period => projections[period].userGrowth),
          backgroundColor: 'rgba(237, 137, 54, 0.6)',
          borderColor: 'rgba(237, 137, 54, 1)',
          borderWidth: 1,
          type: 'line',
          yAxisID: 'y1'
        }
      ]
    };
  };
  
  // Format data for metrics distribution chart
  const formatDistributionData = () => {
    if (!metricsData || metricsData.length === 0) return null;
    
    const latestData = metricsData.slice(-1)[0];
    
    return {
      labels: ['Response Rate', 'Case Acceptance', 'Profit Margin', 'Time to Lawyer'],
      datasets: [
        {
          data: [
            latestData.responseRate,
            latestData.caseAcceptance,
            latestData.profitMargin,
            latestData.timeToLawyer
          ],
          backgroundColor: [
            'rgba(74, 109, 167, 0.6)',
            'rgba(237, 137, 54, 0.6)',
            'rgba(42, 74, 127, 0.6)',
            'rgba(192, 86, 33, 0.6)'
          ],
          borderColor: [
            'rgba(74, 109, 167, 1)',
            'rgba(237, 137, 54, 1)',
            'rgba(42, 74, 127, 1)',
            'rgba(192, 86, 33, 1)'
          ],
          borderWidth: 1
        }
      ]
    };
  };
  
  // Calculate performance indicators
  const calculatePerformanceIndicators = () => {
    if (!metricsData || metricsData.length < 2) return null;
    
    const currentData = metricsData.slice(-1)[0];
    const previousData = metricsData.slice(-2)[0];
    
    return {
      responseRateChange: ((currentData.responseRate - previousData.responseRate) / previousData.responseRate * 100).toFixed(2),
      caseAcceptanceChange: ((currentData.caseAcceptance - previousData.caseAcceptance) / previousData.caseAcceptance * 100).toFixed(2),
      timeToLawyerChange: ((currentData.timeToLawyer - previousData.timeToLawyer) / previousData.timeToLawyer * 100).toFixed(2),
      profitMarginChange: ((currentData.profitMargin - previousData.profitMargin) / previousData.profitMargin * 100).toFixed(2)
    };
  };
  
  // Chart options
  const lineChartOptions = {
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
  };
  
  const barChartOptions = {
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
  };
  
  const forecastChartOptions = {
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
        title: {
          display: true,
          text: 'Revenue (€)'
        }
      },
      y1: {
        beginAtZero: true,
        position: 'right',
        title: {
          display: true,
          text: 'User Growth'
        },
        grid: {
          drawOnChartArea: false
        }
      }
    }
  };
  
  const pieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    }
  };
  
  // Performance indicators component
  const PerformanceIndicators = () => {
    const indicators = calculatePerformanceIndicators();
    
    if (!indicators) return <div>Insufficient data for performance indicators</div>;
    
    return (
      <div className="performance-indicators">
        <div className="indicator">
          <h4>Response Rate</h4>
          <div className={`value ${indicators.responseRateChange > 0 ? 'positive' : 'negative'}`}>
            {indicators.responseRateChange > 0 ? '+' : ''}{indicators.responseRateChange}%
          </div>
        </div>
        <div className="indicator">
          <h4>Case Acceptance</h4>
          <div className={`value ${indicators.caseAcceptanceChange > 0 ? 'positive' : 'negative'}`}>
            {indicators.caseAcceptanceChange > 0 ? '+' : ''}{indicators.caseAcceptanceChange}%
          </div>
        </div>
        <div className="indicator">
          <h4>Time to Lawyer</h4>
          <div className={`value ${indicators.timeToLawyerChange < 0 ? 'positive' : 'negative'}`}>
            {indicators.timeToLawyerChange > 0 ? '+' : ''}{indicators.timeToLawyerChange}%
          </div>
        </div>
        <div className="indicator">
          <h4>Profit Margin</h4>
          <div className={`value ${indicators.profitMarginChange > 0 ? 'positive' : 'negative'}`}>
            {indicators.profitMarginChange > 0 ? '+' : ''}{indicators.profitMarginChange}%
          </div>
        </div>
      </div>
    );
  };
  
  // Real-time metrics component
  const RealTimeMetrics = () => {
    return (
      <div className="real-time-metrics">
        <h3>Real-Time Activity</h3>
        <div className="metrics-grid">
          <div className="metric">
            <div className="metric-value">{realTimeMetrics.activeUsers}</div>
            <div className="metric-label">Active Users</div>
          </div>
          <div className="metric">
            <div className="metric-value">{realTimeMetrics.pendingCases}</div>
            <div className="metric-label">Pending Cases</div>
          </div>
          <div className="metric">
            <div className="metric-value">{realTimeMetrics.activeLawyers}</div>
            <div className="metric-label">Active Lawyers</div>
          </div>
          <div className="metric">
            <div className="metric-value">{realTimeMetrics.todayOutreach}</div>
            <div className="metric-label">Today's Outreach</div>
          </div>
        </div>
      </div>
    );
  };
  
  // Business assumptions component
  const BusinessAssumptions = () => {
    if (!assumptions) return <div>Loading assumptions...</div>;
    
    return (
      <div className="business-assumptions">
        <h3>Business Assumptions</h3>
        <div className="assumptions-grid">
          <div className="assumption">
            <div className="assumption-label">Market Size</div>
            <div className="assumption-value">{assumptions.marketSize.toLocaleString()}</div>
          </div>
          <div className="assumption">
            <div className="assumption-label">Lawyer Workload</div>
            <div className="assumption-value">{assumptions.lawyerWorkload} cases/month</div>
          </div>
          <div className="assumption">
            <div className="assumption-label">Initial Response Rate</div>
            <div className="assumption-value">{assumptions.initialResponseRate}%</div>
          </div>
          <div className="assumption">
            <div className="assumption-label">Case Acceptance Rate</div>
            <div className="assumption-value">{assumptions.caseAcceptanceRate}</div>
          </div>
          <div className="assumption">
            <div className="assumption-label">Revenue Model</div>
            <div className="assumption-value">{assumptions.revenueModel}</div>
          </div>
          <div className="assumption">
            <div className="assumption-label">AI Processing Cost</div>
            <div className="assumption-value">{assumptions.aiProcessingCost}</div>
          </div>
          <div className="assumption">
            <div className="assumption-label">Storage Cost</div>
            <div className="assumption-value">{assumptions.storageCost}</div>
          </div>
          <div className="assumption">
            <div className="assumption-label">Email Outreach Cost</div>
            <div className="assumption-value">{assumptions.emailOutreachCost}</div>
          </div>
        </div>
      </div>
    );
  };
  
  // Main render
  return (
    <div className="investor-analytics-dashboard">
      <div className="dashboard-header">
        <h2>Investor Analytics Dashboard</h2>
        <div className="time-range-selector">
          <button 
            className={timeRange === 'week' ? 'active' : ''} 
            onClick={() => setTimeRange('week')}
          >
            Week
          </button>
          <button 
            className={timeRange === 'month' ? 'active' : ''} 
            onClick={() => setTimeRange('month')}
          >
            Month
          </button>
          <button 
            className={timeRange === 'quarter' ? 'active' : ''} 
            onClick={() => setTimeRange('quarter')}
          >
            Quarter
          </button>
          <button 
            className={timeRange === 'year' ? 'active' : ''} 
            onClick={() => setTimeRange('year')}
          >
            Year
          </button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="loading">Loading analytics data...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <div className="dashboard-content">
          {/* Real-time metrics */}
          <div className="dashboard-section">
            <RealTimeMetrics />
          </div>
          
          {/* Performance indicators */}
          <div className="dashboard-section">
            <h3>Performance Indicators (vs Previous Period)</h3>
            <PerformanceIndicators />
          </div>
          
          {/* Main metrics chart */}
          <div className="dashboard-section">
            <h3>Key Metrics Over Time</h3>
            <div className="metric-selector">
              <button 
                className={comparisonMetric === 'responseRate' ? 'active' : ''} 
                onClick={() => setComparisonMetric('responseRate')}
              >
                Response Rate
              </button>
              <button 
                className={comparisonMetric === 'caseAcceptance' ? 'active' : ''} 
                onClick={() => setComparisonMetric('caseAcceptance')}
              >
                Case Acceptance
              </button>
              <button 
                className={comparisonMetric === 'timeToLawyer' ? 'active' : ''} 
                onClick={() => setComparisonMetric('timeToLawyer')}
              >
                Time to Lawyer
              </button>
              <button 
                className={comparisonMetric === 'profitMargin' ? 'active' : ''} 
                onClick={() => setComparisonMetric('profitMargin')}
              >
                Profit Margin
              </button>
            </div>
            <div className="chart-container">
              {metricsData && (
                <Line 
                  data={formatChartData(metricsData, comparisonMetric)} 
                  options={lineChartOptions} 
                />
              )}
            </div>
          </div>
          
          {/* Metrics comparison */}
          <div className="dashboard-section">
            <h3>Period Comparison</h3>
            <div className="chart-container">
              {metricsData && (
                <Bar 
                  data={formatComparisonData()} 
                  options={barChartOptions} 
                />
              )}
            </div>
          </div>
          
          {/* Metrics distribution */}
          <div className="dashboard-section">
            <h3>Current Metrics Distribution</h3>
            <div className="chart-container">
              {metricsData && (
                <Doughnut 
                  data={formatDistributionData()} 
                  options={pieChartOptions} 
                />
              )}
            </div>
          </div>
          
          {/* Financial forecast */}
          <div className="dashboard-section">
            <h3>Financial Forecast</h3>
            <div className="forecast-period-selector">
              <button 
                className={forecastPeriod === 'quarter' ? 'active' : ''} 
                onClick={() => setForecastPeriod('quarter')}
              >
                Quarterly
              </button>
              <button 
                className={forecastPeriod === 'year' ? 'active' : ''} 
                onClick={() => setForecastPeriod('year')}
              >
                Yearly
              </button>
            </div>
            <div className="chart-container">
              {projections && (
                <Bar 
                  data={formatForecastData()} 
                  options={forecastChartOptions} 
                />
              )}
            </div>
          </div>
          
          {/* Business assumptions */}
          <div className="dashboard-section">
            <BusinessAssumptions />
          </div>
        </div>
      )}
    </div>
  );
};

export default InvestorAnalyticsDashboard;
