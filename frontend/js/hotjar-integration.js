// Hotjar Integration for Feedback Collection
// This file implements Hotjar integration for comprehensive user feedback and behavior analysis

// Hotjar Integration Class
class HotjarIntegration {
  constructor() {
    this.initialized = false;
    this.siteId = null;
    this.version = 6;
    this.debugMode = false;
    this.settings = {
      heatmaps: true,
      recordings: true,
      forms: true,
      polls: true,
      surveys: true
    };
  }
  
  // Initialize Hotjar with site ID
  initialize(siteId, options = {}) {
    if (this.initialized) {
      console.warn('Hotjar already initialized');
      return false;
    }
    
    this.siteId = siteId;
    this.debugMode = options.debugMode || false;
    
    // Merge settings
    if (options.settings) {
      this.settings = { ...this.settings, ...options.settings };
    }
    
    // Inject Hotjar tracking code
    this.injectTrackingCode();
    
    this.initialized = true;
    console.log(`Hotjar initialized with site ID: ${this.siteId}`);
    return true;
  }
  
  // Inject Hotjar tracking code
  injectTrackingCode() {
    // Create Hotjar tracking code
    const trackingCode = `
      (function(h,o,t,j,a,r){
        h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
        h._hjSettings={hjid:${this.siteId},hjsv:${this.version}};
        a=o.getElementsByTagName('head')[0];
        r=o.createElement('script');r.async=1;
        r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
        a.appendChild(r);
      })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
    `;
    
    // Create script element
    const script = document.createElement('script');
    script.innerHTML = trackingCode;
    
    // Append to document head
    document.head.appendChild(script);
    
    // Set debug mode if enabled
    if (this.debugMode) {
      window.hj = window.hj || function() {
        (window.hj.q = window.hj.q || []).push(arguments);
        console.log('Hotjar Debug:', arguments);
      };
    }
  }
  
  // Check if Hotjar is loaded
  isLoaded() {
    return typeof window.hj === 'function';
  }
  
  // Identify user for Hotjar
  identifyUser(userId, userAttributes = {}) {
    if (!this.initialized) {
      console.error('Hotjar not initialized');
      return false;
    }
    
    if (!this.isLoaded()) {
      console.warn('Hotjar not loaded yet');
      return false;
    }
    
    try {
      // Call Hotjar identify method
      window.hj('identify', userId, userAttributes);
      
      console.log(`User identified in Hotjar: ${userId}`);
      return true;
    } catch (error) {
      console.error('Error identifying user in Hotjar:', error);
      return false;
    }
  }
  
  // Trigger Hotjar event
  triggerEvent(eventName) {
    if (!this.initialized) {
      console.error('Hotjar not initialized');
      return false;
    }
    
    if (!this.isLoaded()) {
      console.warn('Hotjar not loaded yet');
      return false;
    }
    
    try {
      // Call Hotjar event method
      window.hj('event', eventName);
      
      console.log(`Hotjar event triggered: ${eventName}`);
      return true;
    } catch (error) {
      console.error('Error triggering Hotjar event:', error);
      return false;
    }
  }
  
  // Set Hotjar state
  setState(state) {
    if (!this.initialized) {
      console.error('Hotjar not initialized');
      return false;
    }
    
    if (!this.isLoaded()) {
      console.warn('Hotjar not loaded yet');
      return false;
    }
    
    try {
      // Call Hotjar stateChange method
      window.hj('stateChange', window.location.href, state);
      
      console.log('Hotjar state set:', state);
      return true;
    } catch (error) {
      console.error('Error setting Hotjar state:', error);
      return false;
    }
  }
  
  // Create and show a Hotjar poll
  createPoll(options) {
    if (!this.initialized) {
      console.error('Hotjar not initialized');
      return false;
    }
    
    if (!this.settings.polls) {
      console.warn('Hotjar polls are disabled in settings');
      return false;
    }
    
    const defaultOptions = {
      id: null,
      title: 'We value your feedback',
      question: 'How would you rate your experience?',
      answers: [
        { text: 'Very poor', value: 1 },
        { text: 'Poor', value: 2 },
        { text: 'Average', value: 3 },
        { text: 'Good', value: 4 },
        { text: 'Excellent', value: 5 }
      ],
      followUpQuestion: 'Would you like to tell us why?',
      submitText: 'Submit',
      thankYouMessage: 'Thank you for your feedback!',
      targeting: {
        urlPattern: window.location.pathname,
        deviceType: 'all',
        showOncePerVisitor: true,
        minimumTimeOnPage: 30
      }
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    // In a real implementation, this would create a poll in the Hotjar dashboard
    // For this prototype, we'll simulate the poll creation
    console.log('Hotjar poll created with options:', mergedOptions);
    
    return {
      success: true,
      pollId: mergedOptions.id || Math.floor(Math.random() * 1000000),
      options: mergedOptions
    };
  }
  
  // Create and show a Hotjar survey
  createSurvey(options) {
    if (!this.initialized) {
      console.error('Hotjar not initialized');
      return false;
    }
    
    if (!this.settings.surveys) {
      console.warn('Hotjar surveys are disabled in settings');
      return false;
    }
    
    const defaultOptions = {
      id: null,
      title: 'Help us improve',
      questions: [
        {
          type: 'rating',
          text: 'How likely are you to recommend our service to a friend or colleague?',
          scale: 0,
          scaleEnd: 10,
          lowLabel: 'Not at all likely',
          highLabel: 'Extremely likely'
        },
        {
          type: 'multiple-choice',
          text: 'What aspects of our service do you value the most?',
          choices: [
            'Ease of use',
            'Speed',
            'Customer support',
            'Features',
            'Price'
          ],
          allowMultiple: true
        },
        {
          type: 'open-ended',
          text: 'How could we improve our service?'
        }
      ],
      targeting: {
        urlPattern: window.location.pathname,
        deviceType: 'all',
        showOncePerVisitor: true,
        minimumTimeOnPage: 60
      }
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    // In a real implementation, this would create a survey in the Hotjar dashboard
    // For this prototype, we'll simulate the survey creation
    console.log('Hotjar survey created with options:', mergedOptions);
    
    return {
      success: true,
      surveyId: mergedOptions.id || Math.floor(Math.random() * 1000000),
      options: mergedOptions
    };
  }
  
  // Configure heatmap settings
  configureHeatmaps(options) {
    if (!this.initialized) {
      console.error('Hotjar not initialized');
      return false;
    }
    
    if (!this.settings.heatmaps) {
      console.warn('Hotjar heatmaps are disabled in settings');
      return false;
    }
    
    const defaultOptions = {
      captureClicks: true,
      captureMouseMovement: true,
      captureScrolling: true,
      captureContent: true,
      continuousCapture: false,
      targetPages: [window.location.pathname]
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    // In a real implementation, this would configure heatmaps in the Hotjar dashboard
    // For this prototype, we'll simulate the configuration
    console.log('Hotjar heatmaps configured with options:', mergedOptions);
    
    return {
      success: true,
      options: mergedOptions
    };
  }
  
  // Configure recording settings
  configureRecordings(options) {
    if (!this.initialized) {
      console.error('Hotjar not initialized');
      return false;
    }
    
    if (!this.settings.recordings) {
      console.warn('Hotjar recordings are disabled in settings');
      return false;
    }
    
    const defaultOptions = {
      captureKeystrokes: false,
      maskAllInputs: true,
      maskAllEmails: true,
      maskAllNumbers: true,
      maskAllZipCodes: true,
      suppressRecordingForPages: ['/account', '/profile', '/payment'],
      recordingRate: 10 // Percentage of sessions to record
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    // In a real implementation, this would configure recordings in the Hotjar dashboard
    // For this prototype, we'll simulate the configuration
    console.log('Hotjar recordings configured with options:', mergedOptions);
    
    return {
      success: true,
      options: mergedOptions
    };
  }
  
  // Create a feedback widget
  createFeedbackWidget(options) {
    if (!this.initialized) {
      console.error('Hotjar not initialized');
      return false;
    }
    
    if (!this.settings.forms) {
      console.warn('Hotjar forms are disabled in settings');
      return false;
    }
    
    const defaultOptions = {
      id: null,
      title: 'Send feedback',
      description: 'Help us improve by sharing your thoughts',
      position: 'right',
      color: '#ed8936',
      showAvatar: true,
      fields: [
        {
          type: 'select',
          label: 'What kind of feedback do you have?',
          options: ['Suggestion', 'Bug report', 'Compliment', 'Other'],
          required: true
        },
        {
          type: 'text',
          label: 'Please describe your feedback',
          required: true
        },
        {
          type: 'email',
          label: 'Your email (optional)',
          required: false
        }
      ],
      submitText: 'Send feedback',
      thankYouMessage: 'Thank you for your feedback!'
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    // In a real implementation, this would create a feedback widget in the Hotjar dashboard
    // For this prototype, we'll simulate the widget creation
    console.log('Hotjar feedback widget created with options:', mergedOptions);
    
    return {
      success: true,
      widgetId: mergedOptions.id || Math.floor(Math.random() * 1000000),
      options: mergedOptions
    };
  }
  
  // Get feedback data (simulated for prototype)
  async getFeedbackData(startDate, endDate) {
    if (!this.initialized) {
      console.error('Hotjar not initialized');
      return {
        success: false,
        error: 'Hotjar not initialized'
      };
    }
    
    // In a real implementation, this would fetch data from the Hotjar API
    // For this prototype, we'll simulate the data
    return {
      success: true,
      period: {
        start: startDate,
        end: endDate
      },
      feedback: {
        total: 128,
        categories: {
          'Suggestion': 47,
          'Bug report': 31,
          'Compliment': 42,
          'Other': 8
        },
        sentiment: {
          positive: 58,
          neutral: 43,
          negative: 27
        },
        topIssues: [
          { text: 'Difficulty finding lawyers', count: 15 },
          { text: 'Slow response times', count: 12 },
          { text: 'Interface confusion', count: 9 }
        ],
        topCompliments: [
          { text: 'Easy to use', count: 18 },
          { text: 'Helpful customer support', count: 14 },
          { text: 'Fast lawyer matching', count: 10 }
        ]
      },
      heatmaps: {
        total: 15,
        mostClickedElements: [
          { selector: '.get-started-button', clicks: 342 },
          { selector: '.lawyer-profile', clicks: 287 },
          { selector: '.case-submit-button', clicks: 201 }
        ],
        leastClickedElements: [
          { selector: '.terms-link', clicks: 12 },
          { selector: '.faq-section', clicks: 28 },
          { selector: '.about-us-link', clicks: 35 }
        ]
      },
      recordings: {
        total: 250,
        averageDuration: '3m 42s',
        bounceRate: '23%',
        conversionRate: '18%',
        dropOffPoints: [
          { page: '/case-details', percentage: 35 },
          { page: '/lawyer-selection', percentage: 22 },
          { page: '/payment', percentage: 15 }
        ]
      }
    };
  }
}

// Feedback Collection Dashboard Component
class FeedbackDashboard {
  constructor(hotjarIntegration) {
    this.hotjar = hotjarIntegration;
    this.feedbackData = null;
    this.lastUpdated = null;
    this.filterOptions = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endDate: new Date(),
      categories: ['Suggestion', 'Bug report', 'Compliment', 'Other'],
      sentiment: ['positive', 'neutral', 'negative']
    };
  }
  
  // Initialize dashboard
  async initialize() {
    if (!this.hotjar || !this.hotjar.initialized) {
      console.error('Hotjar integration not initialized');
      return false;
    }
    
    // Fetch initial data
    await this.refreshData();
    
    console.log('Feedback dashboard initialized');
    return true;
  }
  
  // Refresh feedback data
  async refreshData() {
    try {
      const { startDate, endDate } = this.filterOptions;
      
      // Fetch data from Hotjar
      const data = await this.hotjar.getFeedbackData(startDate, endDate);
      
      if (data.success) {
        this.feedbackData = data;
        this.lastUpdated = new Date();
        
        console.log('Feedback data refreshed:', this.lastUpdated);
        return true;
      } else {
        console.error('Error fetching feedback data:', data.error);
        return false;
      }
    } catch (error) {
      console.error('Error refreshing feedback data:', error);
      return false;
    }
  }
  
  // Update filter options
  updateFilters(newFilters) {
    this.filterOptions = { ...this.filterOptions, ...newFilters };
    
    console.log('Feedback filters updated:', this.filterOptions);
    return this.filterOptions;
  }
  
  // Get feedback summary
  getFeedbackSummary() {
    if (!this.feedbackData) {
      return null;
    }
    
    const { feedback } = this.feedbackData;
    
    return {
      total: feedback.total,
      categories: feedback.categories,
      sentiment: feedback.sentiment,
      lastUpdated: this.lastUpdated
    };
  }
  
  // Get top issues
  getTopIssues(limit = 5) {
    if (!this.feedbackData) {
      return [];
    }
    
    return this.feedbackData.feedback.topIssues.slice(0, limit);
  }
  
  // Get top compliments
  getTopCompliments(limit = 5) {
    if (!this.feedbackData) {
      return [];
    }
    
    return this.feedbackData.feedback.topCompliments.slice(0, limit);
  }
  
  // Get heatmap insights
  getHeatmapInsights() {
    if (!this.feedbackData) {
      return null;
    }
    
    return this.feedbackData.heatmaps;
  }
  
  // Get recording insights
  getRecordingInsights() {
    if (!this.feedbackData) {
      return null;
    }
    
    return this.feedbackData.recordings;
  }
  
  // Generate feedback report
  generateReport() {
    if (!this.feedbackData) {
      return {
        success: false,
        error: 'No feedback data available'
      };
    }
    
    const { feedback, heatmaps, recordings } = this.feedbackData;
    
    // Calculate insights
    const positivePercentage = (feedback.sentiment.positive / feedback.total * 100).toFixed(1);
    const negativePercentage = (feedback.sentiment.negative / feedback.total * 100).toFixed(1);
    const topCategory = Object.entries(feedback.categories).sort((a, b) => b[1] - a[1])[0][0];
    
    // Generate report
    const report = {
      title: 'User Feedback Analysis Report',
      period: `${this.filterOptions.startDate.toLocaleDateString()} to ${this.filterOptions.endDate.toLocaleDateString()}`,
      summary: {
        totalFeedback: feedback.total,
        positivePercentage: `${positivePercentage}%`,
        negativePercentage: `${negativePercentage}%`,
        topCategory: topCategory,
        topIssue: feedback.topIssues[0].text,
        topCompliment: feedback.topCompliments[0].text
      },
      userBehavior: {
        totalRecordings: recordings.total,
        averageSessionDuration: recordings.averageDuration,
        bounceRate: recordings.bounceRate,
        conversionRate: recordings.conversionRate,
        mainDropOffPoint: recordings.dropOffPoints[0].page
      },
      userInterface: {
        mostClickedElement: heatmaps.mostClickedElements[0].selector,
        leastClickedElement: heatmaps.leastClickedElements[0].selector
      },
      recommendations: [
        `Address the top issue: "${feedback.topIssues[0].text}"`,
        `Improve visibility of underutilized element: "${heatmaps.leastClickedElements[0].selector}"`,
        `Optimize the drop-off point at "${recordings.dropOffPoints[0].page}" page`,
        `Leverage the strength: "${feedback.topCompliments[0].text}"`
      ]
    };
    
    return {
      success: true,
      report: report
    };
  }
}

// Create and export instances
export const hotjarIntegration = new HotjarIntegration();
export const feedbackDashboard = new FeedbackDashboard(hotjarIntegration);

// Example usage:
/*
// Initialize Hotjar with your site ID
hotjarIntegration.initialize('1234567');

// Identify a user
hotjarIntegration.identifyUser('user123', {
  userType: 'client',
  plan: 'premium',
  signupDate: '2023-01-15'
});

// Trigger events on important user actions
document.getElementById('submit-case-button').addEventListener('click', () => {
  hotjarIntegration.triggerEvent('case_submitted');
});

// Create a feedback widget
hotjarIntegration.createFeedbackWidget({
  title: 'How can we improve?',
  position: 'right',
  color: '#ed8936'
});

// Initialize the feedback dashboard
feedbackDashboard.initialize();

// Display feedback insights in your admin dashboard
const summary = feedbackDashboard.getFeedbackSummary();
const topIssues = feedbackDashboard.getTopIssues();
const report = feedbackDashboard.generateReport();
*/
