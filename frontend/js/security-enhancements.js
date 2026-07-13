/**
 * Security enhancements for Legal AI Reach Out Platform
 * 
 * This script implements various security features to improve platform reliability
 * and user trust while maintaining performance.
 */

// Execute when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Initialize security enhancements
  initSecurityEnhancements();
});

/**
 * Initialize all security enhancements
 */
function initSecurityEnhancements() {
  // Implement Content Security Policy
  implementCSP();
  
  // Enhance form security
  enhanceFormSecurity();
  
  // Implement secure data handling
  implementSecureDataHandling();
  
  // Add CSRF protection
  implementCSRFProtection();
  
  // Implement secure authentication handling
  enhanceAuthenticationSecurity();
  
  // Add secure navigation
  implementSecureNavigation();
}

/**
 * Implement Content Security Policy
 */
function implementCSP() {
  // Check if CSP is already set
  if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
    // Create CSP meta tag
    const cspMeta = document.createElement('meta');
    cspMeta.httpEquiv = 'Content-Security-Policy';
    
    // Define CSP directives
    // Note: In a production environment, this would be set server-side
    cspMeta.content = "default-src 'self'; " +
                      "script-src 'self' 'unsafe-inline'; " + // Inline scripts needed for this demo
                      "style-src 'self' 'unsafe-inline'; " +  // Inline styles needed for this demo
                      "img-src 'self' https://i.ibb.co data:; " +
                      "font-src 'self'; " +
                      "connect-src 'self' https://danolbza.manus.space; " +
                      "frame-src 'self'; " +
                      "object-src 'none'; " +
                      "base-uri 'self'; " +
                      "form-action 'self'; " +
                      "frame-ancestors 'self'; " +
                      "upgrade-insecure-requests;";
    
    document.head.appendChild(cspMeta);
    
    console.log('Content Security Policy implemented');
  }
}

/**
 * Enhance form security
 */
function enhanceFormSecurity() {
  // Get all forms
  const forms = document.querySelectorAll('form');
  
  forms.forEach(form => {
    // Add autocomplete="off" to sensitive forms
    if (form.id === 'authForm') {
      form.setAttribute('autocomplete', 'off');
    }
    
    // Add novalidate attribute to handle validation with JavaScript
    form.setAttribute('novalidate', '');
    
    // Sanitize form inputs
    const inputs = form.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      // Add input event listener to sanitize input
      input.addEventListener('input', function() {
        // Skip password fields
        if (input.type === 'password') return;
        
        // Sanitize input value
        input.value = sanitizeInput(input.value);
      });
    });
    
    // Add submit event listener
    form.addEventListener('submit', function(e) {
      // Prevent default form submission
      e.preventDefault();
      
      // Validate form
      if (validateForm(this)) {
        // Sanitize all inputs before submission
        const formInputs = this.querySelectorAll('input, textarea');
        formInputs.forEach(input => {
          if (input.type !== 'password') {
            input.value = sanitizeInput(input.value);
          }
        });
        
        // Simulate form submission (would be a real API call in production)
        const submitButton = this.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        submitButton.innerHTML = 'Processing...';
        submitButton.disabled = true;
        
        setTimeout(() => {
          submitButton.innerHTML = originalText;
          submitButton.disabled = false;
          
          // Handle form submission success
          if (this.id === 'authForm') {
            // Show dashboard after successful login
            if (typeof showSection === 'function') {
              showSection('dashboard');
            }
          } else {
            // Show success message for other forms
            if (typeof showSuccessMessage === 'function') {
              showSuccessMessage(this);
            }
          }
        }, 800);
      }
    });
  });
  
  console.log('Form security enhancements implemented');
}

/**
 * Sanitize input to prevent XSS
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  // Replace potentially dangerous characters
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate form (simplified version - full validation in form-validation.js)
 */
function validateForm(form) {
  // Check if the full validation function exists
  if (typeof window.validateForm === 'function') {
    return window.validateForm(form);
  }
  
  // Simple fallback validation
  let isValid = true;
  const requiredInputs = form.querySelectorAll('[required]');
  
  requiredInputs.forEach(input => {
    if (input.value.trim() === '') {
      isValid = false;
      
      // Add error class
      input.classList.add('input-error');
      input.style.borderColor = '#f44336';
    } else {
      // Remove error class
      input.classList.remove('input-error');
      input.style.borderColor = '';
    }
  });
  
  return isValid;
}

/**
 * Implement secure data handling
 */
function implementSecureDataHandling() {
  // Secure localStorage usage
  if (typeof Storage !== 'undefined') {
    // Encrypt sensitive data before storing
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
      // Check if key indicates sensitive data
      if (key.includes('auth_') || key.includes('user_') || key.includes('token_')) {
        // Simple encryption for demo purposes
        // In production, use a proper encryption library
        value = btoa(value);
      }
      
      originalSetItem.call(this, key, value);
    };
    
    // Decrypt sensitive data when retrieving
    const originalGetItem = localStorage.getItem;
    localStorage.getItem = function(key) {
      const value = originalGetItem.call(this, key);
      
      if (value && (key.includes('auth_') || key.includes('user_') || key.includes('token_'))) {
        // Simple decryption for demo purposes
        try {
          return atob(value);
        } catch (e) {
          // If decryption fails, return the original value
          return value;
        }
      }
      
      return value;
    };
    
    // Clear sensitive data on page unload
    window.addEventListener('beforeunload', function() {
      // Get all localStorage keys
      const keys = Object.keys(localStorage);
      
      // Remove sensitive data
      keys.forEach(key => {
        if (key.includes('auth_') || key.includes('token_')) {
          localStorage.removeItem(key);
        }
      });
    });
  }
  
  console.log('Secure data handling implemented');
}

/**
 * Implement CSRF protection
 */
function implementCSRFProtection() {
  // Generate CSRF token
  function generateCSRFToken() {
    // Generate random token
    const token = Math.random().toString(36).substring(2, 15) + 
                 Math.random().toString(36).substring(2, 15);
    
    // Store token in localStorage
    localStorage.setItem('csrf_token', token);
    
    return token;
  }
  
  // Get or create CSRF token
  const csrfToken = localStorage.getItem('csrf_token') || generateCSRFToken();
  
  // Add CSRF token to all forms
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    // Check if CSRF token input already exists
    if (!form.querySelector('input[name="csrf_token"]')) {
      // Create CSRF token input
      const csrfInput = document.createElement('input');
      csrfInput.type = 'hidden';
      csrfInput.name = 'csrf_token';
      csrfInput.value = csrfToken;
      
      form.appendChild(csrfInput);
    }
  });
  
  // Add CSRF token to fetch/XHR requests
  const originalFetch = window.fetch;
  window.fetch = function(url, options = {}) {
    // Create headers if not exist
    if (!options.headers) {
      options.headers = {};
    }
    
    // Add CSRF token to headers
    options.headers['X-CSRF-Token'] = csrfToken;
    
    return originalFetch.call(this, url, options);
  };
  
  // Add CSRF token to XHR requests
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function() {
    const originalSend = this.send;
    
    this.send = function(data) {
      this.setRequestHeader('X-CSRF-Token', csrfToken);
      return originalSend.apply(this, arguments);
    };
    
    return originalXhrOpen.apply(this, arguments);
  };
  
  console.log('CSRF protection implemented');
}

/**
 * Enhance authentication security
 */
function enhanceAuthenticationSecurity() {
  // Get auth form
  const authForm = document.getElementById('authForm');
  
  if (authForm) {
    // Add password strength requirements
    const passwordInput = authForm.querySelector('input[type="password"]');
    if (passwordInput) {
      // Add password requirements hint
      const requirementsHint = document.createElement('div');
      requirementsHint.className = 'password-requirements';
      requirementsHint.style.fontSize = '12px';
      requirementsHint.style.marginTop = '5px';
      requirementsHint.style.color = '#b0b0b0';
      requirementsHint.innerHTML = 'Password must be at least 8 characters with a mix of letters, numbers, and symbols.';
      
      passwordInput.parentElement.appendChild(requirementsHint);
      
      // Add focus event to show requirements
      passwordInput.addEventListener('focus', function() {
        requirementsHint.style.display = 'block';
      });
      
      // Add blur event to hide requirements if password is valid
      passwordInput.addEventListener('blur', function() {
        if (isStrongPassword(this.value)) {
          requirementsHint.style.display = 'none';
        }
      });
      
      // Add input event to validate password strength
      passwordInput.addEventListener('input', function() {
        validatePasswordStrength(this);
      });
    }
    
    // Implement login attempt limiting
    let loginAttempts = parseInt(localStorage.getItem('login_attempts') || '0');
    
    authForm.addEventListener('submit', function(e) {
      // Check login attempts
      if (loginAttempts >= 5) {
        e.preventDefault();
        
        // Show error message
        alert('Too many login attempts. Please try again later.');
        
        // Reset attempts after 30 minutes (in a real app)
        setTimeout(() => {
          localStorage.setItem('login_attempts', '0');
        }, 30 * 60 * 1000);
        
        return false;
      }
      
      // Increment login attempts
      loginAttempts++;
      localStorage.setItem('login_attempts', loginAttempts.toString());
      
      // Reset attempts on successful login (simulated)
      setTimeout(() => {
        localStorage.setItem('login_attempts', '0');
      }, 2000);
    });
  }
  
  console.log('Authentication security enhanced');
}

/**
 * Check if password is strong
 */
function isStrongPassword(password) {
  // At least 8 characters
  if (password.length < 8) return false;
  
  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) return false;
  
  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) return false;
  
  // Check for at least one number
  if (!/[0-9]/.test(password)) return false;
  
  // Check for at least one special character
  if (!/[^a-zA-Z0-9]/.test(password)) return false;
  
  return true;
}

/**
 * Validate password strength
 */
function validatePasswordStrength(input) {
  // Get or create strength meter element
  let strengthMeter = input.parentElement.querySelector('.password-strength');
  if (!strengthMeter) {
    strengthMeter = document.createElement('div');
    strengthMeter.className = 'password-strength';
    strengthMeter.style.height = '4px';
    strengthMeter.style.marginTop = '5px';
    strengthMeter.style.transition = 'width 0.3s, background-color 0.3s';
    
    const strengthText = document.createElement('div');
    strengthText.className = 'strength-text';
    strengthText.style.fontSize = '12px';
    strengthText.style.marginTop = '5px';
    
    input.parentElement.appendChild(strengthMeter);
    input.parentElement.appendChild(strengthText);
  }
  
  // Calculate password strength
  const password = input.value;
  let strength = 0;
  let strengthText = '';
  
  if (password.length >= 8) strength += 1;
  if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength += 1;
  if (password.match(/[0-9]/)) strength += 1;
  if (password.match(/[^a-zA-Z0-9]/)) strength += 1;
  
  // Update strength meter
  switch (strength) {
    case 0:
      strengthMeter.style.width = '25%';
      strengthMeter.style.backgroundColor = '#f44336';
      strengthText = 'Weak';
      break;
    case 1:
      strengthMeter.style.width = '50%';
      strengthMeter.style.backgroundColor = '#ff9800';
      strengthText = 'Fair';
      break;
    case 2:
      strengthMeter.style.width = '75%';
      strengthMeter.style.backgroundColor = '#ffeb3b';
      strengthText = 'Good';
      break;
    case 3:
      strengthMeter.style.width = '90%';
      strengthMeter.style.backgroundColor = '#4caf50';
      strengthText = 'Strong';
      break;
    case 4:
      strengthMeter.style.width = '100%';
      strengthMeter.style.backgroundColor = '#4caf50';
      strengthText = 'Very Strong';
      break;
  }
  
  // Update strength text
  const strengthTextElement = input.parentElement.querySelector('.strength-text');
  if (strengthTextElement) {
    strengthTextElement.textContent = password.length > 0 ? 'Password strength: ' + strengthText : '';
    strengthTextElement.style.color = strengthMeter.style.backgroundColor;
  }
}

/**
 * Implement secure navigation
 */
function implementSecureNavigation() {
  // Add rel="noopener noreferrer" to external links
  const externalLinks = document.querySelectorAll('a[href^="http"]:not([href*="' + window.location.hostname + '"])');
  
  externalLinks.forEach(link => {
    // Add security attributes
    link.setAttribute('rel', 'noopener noreferrer');
    
    // Add target="_blank" if not already set
    if (!link.getAttribute('target')) {
      link.setAttribute('target', '_blank');
    }
  });
  
  // Prevent clickjacking
  if (!document.querySelector('meta[name="X-Frame-Options"]')) {
    const frameOptions = document.createElement('meta');
    frameOptions.name = 'X-Frame-Options';
    frameOptions.content = 'DENY';
    document.head.appendChild(frameOptions);
  }
  
  console.log('Secure navigation implemented');
}

// Initialize security enhancements immediately if document is already loaded
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  initSecurityEnhancements();
}
