// Server-side rendering implementation for Legal AI Reach Out Platform
const express = require('express');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware for static files
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CSRF Protection
const csrf = require('csurf');
const cookieParser = require('cookie-parser');
app.use(cookieParser());
const csrfProtection = csrf({ cookie: true });

// Set security headers
app.use((req, res, next) => {
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https://i.ibb.co data:; connect-src 'self' https://danolbza.manus.space; form-action 'self'; upgrade-insecure-requests;"
  );
  
  // Other security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  next();
});

// Mock data for the platform
const mockData = {
  metrics: {
    responseRate: 42,
    caseAcceptance: 1.8,
    timeToLawyer: 3.2,
    profitMargin: 48
  },
  assumptions: {
    marketSize: 18500,
    lawyerWorkload: 50,
    initialResponseRate: 30,
    caseAcceptanceRate: '0.1% to 1.3%'
  },
  projections: {
    q2_2025: { revenue: 125000, userGrowth: 1500, caseVolume: 2500 },
    q3_2025: { revenue: 250000, userGrowth: 3000, caseVolume: 5000 },
    q4_2025: { revenue: 375000, userGrowth: 5000, caseVolume: 8000 },
    q1_2026: { revenue: 500000, userGrowth: 7500, caseVolume: 12000 }
  }
};

// Server-side rendering function
function renderPage(template, data = {}) {
  const filePath = path.join(__dirname, 'frontend', template);
  let html = fs.readFileSync(filePath, 'utf8');
  
  // Create a DOM from the HTML
  const dom = new JSDOM(html);
  const document = dom.window.document;
  
  // Add CSRF token to all forms
  if (data.csrfToken) {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      const csrfInput = document.createElement('input');
      csrfInput.type = 'hidden';
      csrfInput.name = '_csrf';
      csrfInput.value = data.csrfToken;
      form.appendChild(csrfInput);
    });
  }
  
  // Inject data into the page
  if (data.metrics) {
    const responseRateElement = document.querySelector('.metric-value:nth-of-type(1)');
    if (responseRateElement) responseRateElement.textContent = `${data.metrics.responseRate}%`;
    
    const caseAcceptanceElement = document.querySelector('.metric-value:nth-of-type(2)');
    if (caseAcceptanceElement) caseAcceptanceElement.textContent = `${data.metrics.caseAcceptance}%`;
    
    const timeToLawyerElement = document.querySelector('.metric-value:nth-of-type(3)');
    if (timeToLawyerElement) timeToLawyerElement.textContent = `${data.metrics.timeToLawyer}h`;
    
    const profitMarginElement = document.querySelector('.metric-value:nth-of-type(4)');
    if (profitMarginElement) profitMarginElement.textContent = `${data.metrics.profitMargin}%`;
  }
  
  // Add preload hints for critical resources
  const head = document.querySelector('head');
  if (head) {
    // Preload critical CSS
    const cssPreload = document.createElement('link');
    cssPreload.rel = 'preload';
    cssPreload.href = '/css/dark-theme.css';
    cssPreload.as = 'style';
    head.appendChild(cssPreload);
    
    // Preload critical images
    const imgPreload = document.createElement('link');
    imgPreload.rel = 'preload';
    imgPreload.href = 'https://i.ibb.co/Qj1Vz7W/home-dark-mode.jpg';
    imgPreload.as = 'image';
    head.appendChild(imgPreload);
    
    // Add service worker registration
    const swScript = document.createElement('script');
    swScript.textContent = `
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
          navigator.serviceWorker.register('/js/service-worker.js')
            .then(function(registration) {
              console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(function(error) {
              console.log('ServiceWorker registration failed: ', error);
            });
        });
      }
    `;
    head.appendChild(swScript);
  }
  
  // Return the rendered HTML
  return dom.serialize();
}

// Routes with server-side rendering
app.get('/', csrfProtection, (req, res) => {
  const html = renderPage('final_prototype.html', { 
    csrfToken: req.csrfToken()
  });
  res.send(html);
});

app.get('/dashboard', csrfProtection, (req, res) => {
  const html = renderPage('final_prototype.html', { 
    csrfToken: req.csrfToken(),
    metrics: mockData.metrics
  });
  res.send(html);
});

// API endpoints
app.get('/api/metrics', (req, res) => {
  res.json(mockData.metrics);
});

app.get('/api/assumptions', (req, res) => {
  res.json(mockData.assumptions);
});

app.get('/api/projections', (req, res) => {
  res.json(mockData.projections);
});

// Authentication API (mock)
app.post('/api/auth', csrfProtection, (req, res) => {
  const { email, password } = req.body;
  
  // Simple validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  // In a real app, we would validate credentials against a database
  // For this demo, we'll accept any email/password
  res.json({
    success: true,
    user: {
      email,
      role: email.includes('investor') ? 'investor' : 'user'
    },
    token: 'mock-jwt-token-' + Date.now()
  });
});

// Form submission API with CSRF protection
app.post('/api/submit-form', csrfProtection, (req, res) => {
  // In a real app, we would process the form data
  // For this demo, we'll just echo it back
  res.json({
    success: true,
    message: 'Form submitted successfully',
    data: req.body
  });
});

// Case submission API
app.post('/api/submit-case', csrfProtection, (req, res) => {
  const { caseDescription, legalField } = req.body;
  
  // Simple validation
  if (!caseDescription) {
    return res.status(400).json({ error: 'Case description is required' });
  }
  
  // In a real app, we would process the case with AI and store in database
  // For this demo, we'll just echo it back with a mock response
  res.json({
    success: true,
    message: 'Case submitted successfully',
    caseId: 'CASE-' + Date.now(),
    estimatedTimeToLawyer: '3-4 hours',
    suggestedLegalFields: legalField ? [legalField] : ['Contract Law', 'Employment Law']
  });
});

// Fallback route for all other requests - serve the main page
app.get('*', csrfProtection, (req, res) => {
  const html = renderPage('final_prototype.html', { 
    csrfToken: req.csrfToken()
  });
  res.send(html);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access the application at http://localhost:${PORT}`);
});

module.exports = app; // For testing purposes
