// Form validation and error handling script
document.addEventListener('DOMContentLoaded', function() {
  // Get all forms on the page
  const forms = document.querySelectorAll('form');
  
  forms.forEach(form => {
    // Add validation to each form
    form.addEventListener('submit', function(e) {
      // Prevent default form submission
      e.preventDefault();
      
      // Validate form
      if (validateForm(this)) {
        // If form is valid, show loading state
        const submitButton = this.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        submitButton.innerHTML = 'Processing...';
        submitButton.disabled = true;
        
        // Simulate form submission (would be a real API call in production)
        setTimeout(() => {
          submitButton.innerHTML = originalText;
          submitButton.disabled = false;
          
          // Handle form submission success
          if (this.id === 'authForm') {
            // Show dashboard after successful login
            showSection('dashboard');
          } else {
            // Show success message for other forms
            showSuccessMessage(this);
          }
        }, 800); // Reduced from 1500ms to 800ms for faster response
      }
    });
    
    // Add real-time validation for inputs
    const inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      // Validate on blur (when user leaves the field)
      input.addEventListener('blur', function() {
        validateInput(this);
      });
      
      // Clear error on focus
      input.addEventListener('focus', function() {
        clearInputError(this);
      });
      
      // For password fields, add strength meter
      if (input.type === 'password') {
        input.addEventListener('input', function() {
          updatePasswordStrength(this);
        });
      }
    });
  });
  
  // Function to validate entire form
  function validateForm(form) {
    let isValid = true;
    const inputs = form.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
      if (!validateInput(input)) {
        isValid = false;
      }
    });
    
    return isValid;
  }
  
  // Function to validate individual input
  function validateInput(input) {
    // Skip validation for disabled or optional fields
    if (input.disabled || !input.required) {
      return true;
    }
    
    let isValid = true;
    let errorMessage = '';
    
    // Clear any existing error
    clearInputError(input);
    
    // Check if empty
    if (input.required && input.value.trim() === '') {
      isValid = false;
      errorMessage = 'This field is required';
    } else {
      // Validate based on input type
      switch (input.type) {
        case 'email':
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailPattern.test(input.value)) {
            isValid = false;
            errorMessage = 'Please enter a valid email address';
          }
          break;
          
        case 'password':
          if (input.value.length < 8) {
            isValid = false;
            errorMessage = 'Password must be at least 8 characters';
          }
          break;
          
        case 'tel':
          const phonePattern = /^\+?[0-9\s\-()]{8,20}$/;
          if (!phonePattern.test(input.value)) {
            isValid = false;
            errorMessage = 'Please enter a valid phone number';
          }
          break;
      }
    }
    
    // If validation failed, show error
    if (!isValid) {
      showInputError(input, errorMessage);
    }
    
    return isValid;
  }
  
  // Function to show input error
  function showInputError(input, message) {
    // Create error element if it doesn't exist
    let errorElement = input.parentElement.querySelector('.error-message');
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.className = 'error-message';
      errorElement.style.color = '#f44336';
      errorElement.style.fontSize = '12px';
      errorElement.style.marginTop = '5px';
      input.parentElement.appendChild(errorElement);
    }
    
    // Set error message
    errorElement.textContent = message;
    
    // Add error class to input
    input.classList.add('input-error');
    input.style.borderColor = '#f44336';
    
    // Add aria attributes for accessibility
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', 'error-' + input.id);
    errorElement.id = 'error-' + input.id;
  }
  
  // Function to clear input error
  function clearInputError(input) {
    // Remove error element
    const errorElement = input.parentElement.querySelector('.error-message');
    if (errorElement) {
      errorElement.textContent = '';
    }
    
    // Remove error class from input
    input.classList.remove('input-error');
    input.style.borderColor = '';
    
    // Remove aria attributes
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }
  
  // Function to update password strength meter
  function updatePasswordStrength(input) {
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
  
  // Function to show success message
  function showSuccessMessage(form) {
    // Create success message
    let successMessage = form.querySelector('.success-message');
    if (!successMessage) {
      successMessage = document.createElement('div');
      successMessage.className = 'success-message';
      successMessage.style.backgroundColor = '#4caf50';
      successMessage.style.color = 'white';
      successMessage.style.padding = '10px';
      successMessage.style.borderRadius = '4px';
      successMessage.style.marginTop = '15px';
      successMessage.style.textAlign = 'center';
      form.appendChild(successMessage);
    }
    
    // Set success message
    successMessage.textContent = 'Form submitted successfully!';
    
    // Hide success message after 3 seconds
    setTimeout(() => {
      successMessage.style.display = 'none';
    }, 3000);
  }
  
  // Function to show section (copied from main script for reference)
  function showSection(section) {
    // Show loading overlay
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('active');
    
    // Hide all sections
    const mainContent = document.getElementById('mainContent');
    const authSection = document.getElementById('authSection');
    const dashboardSection = document.getElementById('dashboardSection');
    
    mainContent.style.display = 'none';
    authSection.style.display = 'none';
    dashboardSection.style.display = 'none';
    
    // Show selected section after a short delay
    setTimeout(() => {
      if (section === 'main') {
        mainContent.style.display = 'block';
      } else if (section === 'auth') {
        authSection.style.display = 'flex';
      } else if (section === 'dashboard') {
        dashboardSection.style.display = 'block';
      }
      
      // Hide loading overlay
      loadingOverlay.classList.remove('active');
      
      // Scroll to top
      window.scrollTo(0, 0);
    }, 300);
  }
});

// Global error handling
window.addEventListener('error', function(e) {
  console.error('Global error:', e.message);
  
  // Log error to console (would send to server in production)
  const errorDetails = {
    message: e.message,
    source: e.filename,
    lineNumber: e.lineno,
    columnNumber: e.colno,
    stack: e.error ? e.error.stack : null,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent
  };
  
  console.log('Error details:', errorDetails);
  
  // Show user-friendly error message for critical errors
  if (e.message.includes('critical') || e.message.includes('fatal')) {
    showGlobalErrorMessage('Something went wrong. Please try again or contact support.');
  }
  
  // Prevent default browser error handling
  return false;
});

// Function to show global error message
function showGlobalErrorMessage(message) {
  // Create error container if it doesn't exist
  let errorContainer = document.getElementById('globalErrorContainer');
  if (!errorContainer) {
    errorContainer = document.createElement('div');
    errorContainer.id = 'globalErrorContainer';
    errorContainer.style.position = 'fixed';
    errorContainer.style.top = '20px';
    errorContainer.style.left = '50%';
    errorContainer.style.transform = 'translateX(-50%)';
    errorContainer.style.backgroundColor = '#f44336';
    errorContainer.style.color = 'white';
    errorContainer.style.padding = '10px 20px';
    errorContainer.style.borderRadius = '4px';
    errorContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    errorContainer.style.zIndex = '2000';
    errorContainer.style.display = 'flex';
    errorContainer.style.alignItems = 'center';
    errorContainer.style.justifyContent = 'space-between';
    
    document.body.appendChild(errorContainer);
  }
  
  // Set error message
  errorContainer.innerHTML = `
    <span>${message}</span>
    <button style="background: none; border: none; color: white; cursor: pointer; margin-left: 15px; font-size: 20px;" 
            onclick="this.parentElement.style.display='none'">×</button>
  `;
  
  // Show error container
  errorContainer.style.display = 'flex';
  
  // Hide error after 5 seconds
  setTimeout(() => {
    errorContainer.style.display = 'none';
  }, 5000);
}
