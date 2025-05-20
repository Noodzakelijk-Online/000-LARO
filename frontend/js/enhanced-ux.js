// Enhanced UX JavaScript for Legal AI Reach Out Platform
// This file contains scripts to improve navigation, user flow, and overall experience

// Common UX enhancements for all pages
document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    initTooltips();
    
    // Add smooth scrolling
    enableSmoothScrolling();
    
    // Add navigation highlighting
    highlightCurrentNavItem();
    
    // Add loading indicators
    setupLoadingIndicators();
    
    // Add keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Add guided tour functionality
    setupGuidedTour();
    
    // Add responsive behavior enhancements
    enhanceResponsiveBehavior();
    
    // Add form validation and user feedback
    enhanceFormExperience();
    
    // Add search functionality
    setupSearchFunctionality();
    
    // Add notification system
    setupNotifications();
    
    // Add page transitions
    setupPageTransitions();
    
    // Add accessibility improvements
    improveAccessibility();
});

// Initialize tooltips for better information discovery
function initTooltips() {
    const tooltipTriggers = document.querySelectorAll('[data-tooltip]');
    
    tooltipTriggers.forEach(trigger => {
        const tooltipText = trigger.getAttribute('data-tooltip');
        const tooltipElement = document.createElement('div');
        tooltipElement.className = 'tooltip-text';
        tooltipElement.textContent = tooltipText;
        
        trigger.classList.add('tooltip');
        trigger.appendChild(tooltipElement);
        
        // Position tooltip based on available space
        trigger.addEventListener('mouseenter', positionTooltip);
    });
}

// Position tooltip based on available space
function positionTooltip() {
    const tooltip = this.querySelector('.tooltip-text');
    const triggerRect = this.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    // Check if tooltip would go off-screen to the right
    if (triggerRect.left + tooltipRect.width > window.innerWidth) {
        tooltip.style.left = 'auto';
        tooltip.style.right = '0';
        tooltip.style.transform = 'translateX(0)';
    }
    
    // Check if tooltip would go off-screen to the top
    if (triggerRect.top - tooltipRect.height < 0) {
        tooltip.style.bottom = 'auto';
        tooltip.style.top = '125%';
    }
}

// Enable smooth scrolling for all anchor links
function enableSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                // Get height of fixed navbar if present
                const navbar = document.querySelector('.navbar');
                const navbarHeight = navbar ? navbar.offsetHeight : 0;
                
                window.scrollTo({
                    top: targetElement.offsetTop - navbarHeight - 20,
                    behavior: 'smooth'
                });
                
                // Update URL without page reload
                history.pushState(null, null, targetId);
            }
        });
    });
}

// Highlight current navigation item based on URL or scroll position
function highlightCurrentNavItem() {
    const navLinks = document.querySelectorAll('.navbar-link, .sidebar-link');
    const currentPath = window.location.pathname;
    
    // Highlight based on current page
    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        if (linkPath === currentPath || (currentPath.endsWith('/') && linkPath === 'index.html')) {
            link.classList.add('active');
        }
    });
    
    // Update highlight on scroll for section navigation
    if (document.querySelectorAll('section[id]').length > 0) {
        window.addEventListener('scroll', function() {
            let scrollPosition = window.scrollY + 100;
            
            document.querySelectorAll('section[id]').forEach(section => {
                const sectionTop = section.offsetTop;
                const sectionHeight = section.offsetHeight;
                const sectionId = section.getAttribute('id');
                
                if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                    document.querySelectorAll('.navbar-link').forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === '#' + sectionId) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        });
    }
}

// Add loading indicators for better user feedback
function setupLoadingIndicators() {
    // Add loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p class="loading-text">Loading...</p>
        </div>
    `;
    document.body.appendChild(loadingOverlay);
    
    // Add loading state to buttons
    document.querySelectorAll('button[type="submit"], .btn-action').forEach(button => {
        button.addEventListener('click', function(e) {
            // Skip for buttons with data-no-loading attribute
            if (this.hasAttribute('data-no-loading')) return;
            
            // Skip for buttons inside forms (handled by form submit)
            if (this.closest('form') && this.type === 'submit') return;
            
            const originalText = this.innerHTML;
            this.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${this.textContent}`;
            this.disabled = true;
            
            // Reset button after 2 seconds (for demo purposes)
            setTimeout(() => {
                this.innerHTML = originalText;
                this.disabled = false;
            }, 2000);
        });
    });
    
    // Add loading state to forms
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function(e) {
            // Skip for forms with data-no-loading attribute
            if (this.hasAttribute('data-no-loading')) return;
            
            const submitButton = this.querySelector('button[type="submit"]');
            if (submitButton) {
                const originalText = submitButton.innerHTML;
                submitButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${submitButton.textContent}`;
                submitButton.disabled = true;
                
                // For demo forms, reset after 2 seconds
                if (this.id === 'demoForm' || this.id === 'authForm') {
                    setTimeout(() => {
                        submitButton.innerHTML = originalText;
                        submitButton.disabled = false;
                    }, 2000);
                }
            }
        });
    });
    
    // Show loading overlay for page transitions
    window.addEventListener('beforeunload', function() {
        loadingOverlay.classList.add('active');
    });
    
    // Hide loading overlay when page is fully loaded
    window.addEventListener('load', function() {
        loadingOverlay.classList.remove('active');
    });
}

// Setup keyboard shortcuts for power users
function setupKeyboardShortcuts() {
    // Add keyboard shortcut info button
    const shortcutButton = document.createElement('button');
    shortcutButton.className = 'keyboard-shortcut-btn';
    shortcutButton.innerHTML = '<i class="fas fa-keyboard"></i>';
    shortcutButton.setAttribute('data-tooltip', 'Keyboard Shortcuts');
    document.body.appendChild(shortcutButton);
    
    // Create shortcuts modal
    const shortcutsModal = document.createElement('div');
    shortcutsModal.className = 'modal fade';
    shortcutsModal.id = 'keyboardShortcutsModal';
    shortcutsModal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Keyboard Shortcuts</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Shortcut</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><kbd>?</kbd></td>
                                <td>Show this help dialog</td>
                            </tr>
                            <tr>
                                <td><kbd>/</kbd></td>
                                <td>Focus search</td>
                            </tr>
                            <tr>
                                <td><kbd>G</kbd> + <kbd>H</kbd></td>
                                <td>Go to Home</td>
                            </tr>
                            <tr>
                                <td><kbd>G</kbd> + <kbd>D</kbd></td>
                                <td>Go to Dashboard</td>
                            </tr>
                            <tr>
                                <td><kbd>G</kbd> + <kbd>I</kbd></td>
                                <td>Go to Investors</td>
                            </tr>
                            <tr>
                                <td><kbd>N</kbd> + <kbd>C</kbd></td>
                                <td>New Case</td>
                            </tr>
                            <tr>
                                <td><kbd>Esc</kbd></td>
                                <td>Close dialogs</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(shortcutsModal);
    
    // Initialize modal
    const bsModal = new bootstrap.Modal(shortcutsModal);
    
    // Show shortcuts modal on button click
    shortcutButton.addEventListener('click', function() {
        bsModal.show();
    });
    
    // Setup keyboard event listener
    let keySequence = '';
    let keyTimeout;
    
    document.addEventListener('keydown', function(e) {
        // Ignore if user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        // Show shortcuts modal when ? is pressed
        if (e.key === '?') {
            e.preventDefault();
            bsModal.show();
            return;
        }
        
        // Focus search when / is pressed
        if (e.key === '/') {
            e.preventDefault();
            const searchInput = document.querySelector('.search-input');
            if (searchInput) searchInput.focus();
            return;
        }
        
        // Handle key sequences (e.g., G+H for Go Home)
        clearTimeout(keyTimeout);
        keySequence += e.key.toUpperCase();
        
        // Navigation shortcuts
        if (keySequence === 'GH') {
            window.location.href = 'index_dark.html';
        } else if (keySequence === 'GD') {
            window.location.href = 'dashboard_dark.html';
        } else if (keySequence === 'GI') {
            window.location.href = 'investors_dark.html';
        } else if (keySequence === 'NC') {
            const newCaseLink = document.querySelector('a[href="#new-case"]');
            if (newCaseLink) newCaseLink.click();
        }
        
        // Reset key sequence after a short delay
        keyTimeout = setTimeout(() => {
            keySequence = '';
        }, 1000);
        
        // Close modals with Escape key
        if (e.key === 'Escape') {
            const openModals = document.querySelectorAll('.modal.show');
            openModals.forEach(modal => {
                const modalInstance = bootstrap.Modal.getInstance(modal);
                if (modalInstance) modalInstance.hide();
            });
        }
    });
}

// Setup guided tour functionality for new users
function setupGuidedTour() {
    // Only add tour if it's a user's first visit (using localStorage for demo)
    const hasSeenTour = localStorage.getItem('hasSeenTour');
    
    if (!hasSeenTour) {
        // Add tour button to navbar
        const navbarNav = document.querySelector('.navbar-nav, .navbar-menu');
        
        if (navbarNav) {
            const tourButton = document.createElement('li');
            tourButton.className = 'navbar-item ms-2';
            tourButton.innerHTML = `
                <button class="btn btn-sm btn-outline-primary" id="startTourBtn">
                    <i class="fas fa-map-signs me-1"></i> Take a Tour
                </button>
            `;
            navbarNav.appendChild(tourButton);
            
            // Add event listener to tour button
            document.getElementById('startTourBtn').addEventListener('click', startGuidedTour);
        }
        
        // Show tour prompt after 3 seconds for first-time visitors
        setTimeout(() => {
            showTourPrompt();
        }, 3000);
    }
}

// Show tour prompt for new users
function showTourPrompt() {
    const tourPrompt = document.createElement('div');
    tourPrompt.className = 'tour-prompt';
    tourPrompt.innerHTML = `
        <div class="tour-prompt-content">
            <h4>Welcome to Legal AI Reach Out!</h4>
            <p>Would you like a quick tour to learn how to use the platform?</p>
            <div class="tour-prompt-actions">
                <button class="btn btn-primary" id="promptStartTourBtn">Yes, show me around</button>
                <button class="btn btn-outline" id="promptSkipTourBtn">Skip for now</button>
            </div>
        </div>
    `;
    document.body.appendChild(tourPrompt);
    
    // Show the prompt with animation
    setTimeout(() => {
        tourPrompt.classList.add('active');
    }, 100);
    
    // Add event listeners
    document.getElementById('promptStartTourBtn').addEventListener('click', function() {
        tourPrompt.classList.remove('active');
        setTimeout(() => {
            tourPrompt.remove();
            startGuidedTour();
        }, 300);
    });
    
    document.getElementById('promptSkipTourBtn').addEventListener('click', function() {
        tourPrompt.classList.remove('active');
        setTimeout(() => {
            tourPrompt.remove();
        }, 300);
        
        // Remember that user has seen the prompt
        localStorage.setItem('hasSeenTour', 'true');
    });
}

// Start the guided tour
function startGuidedTour() {
    // Remember that user has seen the tour
    localStorage.setItem('hasSeenTour', 'true');
    
    // Define tour steps based on current page
    let tourSteps = [];
    
    // Get current page
    const currentPath = window.location.pathname;
    
    if (currentPath.includes('index')) {
        // Home page tour
        tourSteps = [
            {
                element: '.navbar-logo',
                title: 'Welcome to Legal AI Reach Out',
                content: 'This is your gateway to finding the right legal representation in the Netherlands.',
                position: 'bottom'
            },
            {
                element: '.hero-section',
                title: 'Your Legal Journey Starts Here',
                content: 'Learn about our AI-powered platform that connects you with the perfect lawyer for your case.',
                position: 'bottom'
            },
            {
                element: '#how-it-works',
                title: 'How It Works',
                content: 'Discover our simple 4-step process to connect you with the right legal representation.',
                position: 'top'
            },
            {
                element: '#features',
                title: 'Powerful Features',
                content: 'Explore the cutting-edge technology that powers our platform.',
                position: 'top'
            },
            {
                element: '.btn-cta',
                title: 'Get Started',
                content: 'Click here to begin your legal journey with us.',
                position: 'left'
            }
        ];
    } else if (currentPath.includes('dashboard')) {
        // Dashboard page tour
        tourSteps = [
            {
                element: '.sidebar',
                title: 'Navigation Menu',
                content: 'Access all areas of your account from this sidebar.',
                position: 'right'
            },
            {
                element: '.case-summary-card',
                title: 'Your Active Case',
                content: 'View details about your current legal case here.',
                position: 'bottom'
            },
            {
                element: '.step-indicator',
                title: 'Case Progress',
                content: 'Track where your case stands in our process.',
                position: 'top'
            },
            {
                element: '.lawyer-card',
                title: 'Lawyer Responses',
                content: 'See which lawyers have responded to your case and their status.',
                position: 'left'
            },
            {
                element: '.document-card',
                title: 'Case Documents',
                content: 'Access all documents related to your case here.',
                position: 'right'
            },
            {
                element: '.resource-usage',
                title: 'Resource Usage & Billing',
                content: 'Track your usage and associated costs with our transparent pay-per-use model.',
                position: 'left'
            }
        ];
    } else if (currentPath.includes('investors')) {
        // Investors page tour
        tourSteps = [
            {
                element: '.auth-card',
                title: 'Investor Access',
                content: 'Enter your credentials to access detailed business metrics and performance data.',
                position: 'bottom'
            },
            {
                element: '.metrics-card',
                title: 'Key Performance Metrics',
                content: 'View our most important performance indicators at a glance.',
                position: 'bottom'
            },
            {
                element: '.tab-nav',
                title: 'Detailed Information',
                content: 'Switch between different views to see performance metrics, business assumptions, financial projections, and impact goals.',
                position: 'bottom'
            },
            {
                element: '.chart-container',
                title: 'Visual Data',
                content: 'Explore visual representations of our performance data and trends.',
                position: 'top'
            },
            {
                element: '.assumptions-table',
                title: 'Business Assumptions',
                content: 'Review the core assumptions that our business model is built upon.',
                position: 'top'
            }
        ];
    }
    
    // Create tour overlay and steps
    const tourOverlay = document.createElement('div');
    tourOverlay.className = 'tour-overlay';
    document.body.appendChild(tourOverlay);
    
    // Create tour popup
    const tourPopup = document.createElement('div');
    tourPopup.className = 'tour-popup';
    document.body.appendChild(tourPopup);
    
    // Initialize tour
    let currentStep = 0;
    
    // Function to show a tour step
    function showTourStep(stepIndex) {
        if (stepIndex >= tourSteps.length) {
            // End of tour
            endTour();
            return;
        }
        
        const step = tourSteps[stepIndex];
        const targetElement = document.querySelector(step.element);
        
        if (!targetElement) {
            // Skip this step if element not found
            showTourStep(stepIndex + 1);
            return;
        }
        
        // Scroll element into view if needed
        targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
        
        // Position the highlight
        const elementRect = targetElement.getBoundingClientRect();
        const highlight = document.createElement('div');
        highlight.className = 'tour-highlight';
        highlight.style.top = `${elementRect.top + window.scrollY}px`;
        highlight.style.left = `${elementRect.left + window.scrollX}px`;
        highlight.style.width = `${elementRect.width}px`;
        highlight.style.height = `${elementRect.height}px`;
        
        // Clear previous highlights
        document.querySelectorAll('.tour-highlight').forEach(el => el.remove());
        document.body.appendChild(highlight);
        
        // Position the popup
        tourPopup.innerHTML = `
            <h4>${step.title}</h4>
            <p>${step.content}</p>
            <div class="tour-controls">
                <span class="tour-progress">${stepIndex + 1} of ${tourSteps.length}</span>
                <div class="tour-buttons">
                    ${stepIndex > 0 ? '<button class="btn btn-sm btn-outline tour-prev">Previous</button>' : ''}
                    ${stepIndex < tourSteps.length - 1 ? 
                        '<button class="btn btn-sm btn-primary tour-next">Next</button>' : 
                        '<button class="btn btn-sm btn-success tour-finish">Finish Tour</button>'
                    }
                </div>
            </div>
            <button class="tour-close">&times;</button>
        `;
        
        // Position popup based on specified position
        const popupRect = tourPopup.getBoundingClientRect();
        let top, left;
        
        switch(step.position) {
            case 'top':
                top = elementRect.top + window.scrollY - popupRect.height - 10;
                left = elementRect.left + window.scrollX + (elementRect.width / 2) - (popupRect.width / 2);
                break;
            case 'bottom':
                top = elementRect.bottom + window.scrollY + 10;
                left = elementRect.left + window.scrollX + (elementRect.width / 2) - (popupRect.width / 2);
                break;
            case 'left':
                top = elementRect.top + window.scrollY + (elementRect.height / 2) - (popupRect.height / 2);
                left = elementRect.left + window.scrollX - popupRect.width - 10;
                break;
            case 'right':
                top = elementRect.top + window.scrollY + (elementRect.height / 2) - (popupRect.height / 2);
                left = elementRect.right + window.scrollX + 10;
                break;
            default:
                top = elementRect.bottom + window.scrollY + 10;
                left = elementRect.left + window.scrollX + (elementRect.width / 2) - (popupRect.width / 2);
        }
        
        // Ensure popup stays within viewport
        if (left < 10) left = 10;
        if (left + popupRect.width > window.innerWidth - 10) {
            left = window.innerWidth - popupRect.width - 10;
        }
        if (top < 10) top = 10;
        if (top + popupRect.height > window.innerHeight + window.scrollY - 10) {
            top = window.innerHeight + window.scrollY - popupRect.height - 10;
        }
        
        tourPopup.style.top = `${top}px`;
        tourPopup.style.left = `${left}px`;
        tourPopup.classList.add('active');
        
        // Add event listeners
        const prevButton = tourPopup.querySelector('.tour-prev');
        const nextButton = tourPopup.querySelector('.tour-next');
        const finishButton = tourPopup.querySelector('.tour-finish');
        const closeButton = tourPopup.querySelector('.tour-close');
        
        if (prevButton) {
            prevButton.addEventListener('click', () => {
                showTourStep(stepIndex - 1);
            });
        }
        
        if (nextButton) {
            nextButton.addEventListener('click', () => {
                showTourStep(stepIndex + 1);
            });
        }
        
        if (finishButton) {
            finishButton.addEventListener('click', endTour);
        }
        
        if (closeButton) {
            closeButton.addEventListener('click', endTour);
        }
    }
    
    // Function to end the tour
    function endTour() {
        tourOverlay.remove();
        tourPopup.remove();
        document.querySelectorAll('.tour-highlight').forEach(el => el.remove());
        
        // Show completion message
        showToast('Tour Completed', 'You can restart the tour anytime from the help menu.', 'success');
    }
    
    // Start the tour with the first step
    tourOverlay.classList.add('active');
    showTourStep(0);
}

// Enhance responsive behavior
function enhanceResponsiveBehavior() {
    // Handle sidebar toggle on mobile
    const sidebarToggle = document.querySelector('.navbar-toggler');
    const sidebar = document.querySelector('.sidebar');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', function(e) {
            if (window.innerWidth < 992 && 
                sidebar.classList.contains('active') && 
                !sidebar.contains(e.target) && 
                !sidebarToggle.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        });
    }
    
    // Adjust layout on window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth >= 992 && sidebar) {
            sidebar.classList.remove('active');
        }
    });
    
    // Add swipe gestures for mobile
    let touchStartX = 0;
    let touchEndX = 0;
    
    document.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
    }, false);
    
    document.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, false);
    
    function handleSwipe() {
        if (touchEndX - touchStartX > 100 && sidebar) {
            // Swipe right - open sidebar
            sidebar.classList.add('active');
        } else if (touchStartX - touchEndX > 100 && sidebar) {
            // Swipe left - close sidebar
            sidebar.classList.remove('active');
        }
    }
}

// Enhance form experience with validation and feedback
function enhanceFormExperience() {
    // Add custom form validation
    document.querySelectorAll('form').forEach(form => {
        // Skip forms with data-no-validate attribute
        if (form.hasAttribute('data-no-validate')) return;
        
        form.addEventListener('submit', function(e) {
            if (!this.checkValidity()) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            this.classList.add('was-validated');
            
            // Show success message for demo forms
            if (this.checkValidity() && (this.id === 'demoForm' || this.id === 'authForm')) {
                e.preventDefault();
                showToast('Success', 'Your information has been submitted successfully.', 'success');
            }
        });
        
        // Add real-time validation feedback
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            input.addEventListener('blur', function() {
                // Skip if form hasn't been submitted yet
                if (!form.classList.contains('was-validated')) return;
                
                this.classList.remove('is-valid', 'is-invalid');
                if (this.checkValidity()) {
                    this.classList.add('is-valid');
                } else {
                    this.classList.add('is-invalid');
                }
            });
        });
    });
    
    // Add password strength meter
    document.querySelectorAll('input[type="password"]').forEach(input => {
        // Skip inputs with data-no-strength-meter attribute
        if (input.hasAttribute('data-no-strength-meter')) return;
        
        // Create strength meter
        const strengthMeter = document.createElement('div');
        strengthMeter.className = 'password-strength-meter';
        strengthMeter.innerHTML = `
            <div class="strength-bars">
                <div class="strength-bar"></div>
                <div class="strength-bar"></div>
                <div class="strength-bar"></div>
                <div class="strength-bar"></div>
            </div>
            <div class="strength-text">Password strength</div>
        `;
        
        // Insert after password input
        input.parentNode.insertBefore(strengthMeter, input.nextSibling);
        
        // Update strength meter on input
        input.addEventListener('input', function() {
            updatePasswordStrength(this.value, strengthMeter);
        });
    });
}

// Update password strength meter
function updatePasswordStrength(password, meterElement) {
    let strength = 0;
    
    // Length check
    if (password.length >= 8) strength += 1;
    
    // Complexity checks
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    
    // Update strength bars
    const strengthBars = meterElement.querySelectorAll('.strength-bar');
    const strengthText = meterElement.querySelector('.strength-text');
    
    strengthBars.forEach((bar, index) => {
        bar.className = 'strength-bar';
        if (index < strength) {
            if (strength === 1) bar.classList.add('weak');
            else if (strength === 2) bar.classList.add('medium');
            else if (strength === 3) bar.classList.add('good');
            else if (strength === 4) bar.classList.add('strong');
        }
    });
    
    // Update strength text
    if (password.length === 0) {
        strengthText.textContent = 'Password strength';
    } else if (strength === 1) {
        strengthText.textContent = 'Weak password';
    } else if (strength === 2) {
        strengthText.textContent = 'Medium password';
    } else if (strength === 3) {
        strengthText.textContent = 'Good password';
    } else if (strength === 4) {
        strengthText.textContent = 'Strong password';
    }
}

// Setup search functionality
function setupSearchFunctionality() {
    // Add search bar to navbar if not present
    const navbar = document.querySelector('.navbar-nav, .navbar-menu');
    
    if (navbar && !document.querySelector('.search-container')) {
        const searchContainer = document.createElement('li');
        searchContainer.className = 'navbar-item search-container ms-auto';
        searchContainer.innerHTML = `
            <div class="search-box">
                <input type="text" class="search-input" placeholder="Search...">
                <button class="search-button">
                    <i class="fas fa-search"></i>
                </button>
            </div>
        `;
        navbar.appendChild(searchContainer);
        
        // Add search functionality
        const searchInput = searchContainer.querySelector('.search-input');
        const searchButton = searchContainer.querySelector('.search-button');
        
        searchButton.addEventListener('click', function() {
            performSearch(searchInput.value);
        });
        
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch(this.value);
            }
        });
        
        // Add search box expand/collapse on focus
        searchInput.addEventListener('focus', function() {
            searchContainer.classList.add('expanded');
        });
        
        searchInput.addEventListener('blur', function() {
            if (this.value === '') {
                searchContainer.classList.remove('expanded');
            }
        });
    }
}

// Perform search
function performSearch(query) {
    if (!query.trim()) return;
    
    // Show loading state
    showToast('Searching', `Searching for "${query}"...`, 'info');
    
    // For demo purposes, show results after a delay
    setTimeout(() => {
        // Create search results modal
        const resultsModal = document.createElement('div');
        resultsModal.className = 'modal fade';
        resultsModal.id = 'searchResultsModal';
        resultsModal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Search Results for "${query}"</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="search-results">
                            <div class="search-result-item">
                                <h5><a href="index_dark.html">Legal AI Reach Out - Home</a></h5>
                                <p>Our AI-powered platform simplifies how individuals in the Netherlands access legal help...</p>
                            </div>
                            <div class="search-result-item">
                                <h5><a href="dashboard_dark.html">Dashboard - Employment Discrimination Case</a></h5>
                                <p>View details about your employment discrimination case and track lawyer responses...</p>
                            </div>
                            <div class="search-result-item">
                                <h5><a href="#how-it-works">How It Works - Legal AI Reach Out</a></h5>
                                <p>Learn about our 4-step process to connect you with the right legal representation...</p>
                            </div>
                            <div class="search-result-item">
                                <h5><a href="investors_dark.html">Investor Dashboard - Performance Metrics</a></h5>
                                <p>View real-time performance metrics and business plan assumptions...</p>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(resultsModal);
        
        // Show the modal
        const modal = new bootstrap.Modal(resultsModal);
        modal.show();
        
        // Remove modal from DOM when hidden
        resultsModal.addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }, 1000);
}

// Setup notification system
function setupNotifications() {
    // Create toast container if not exists
    if (!document.querySelector('.toast-container')) {
        const toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Add notification bell functionality
    const notificationBell = document.querySelector('.fa-bell');
    
    if (notificationBell) {
        notificationBell.addEventListener('click', function() {
            // Create notifications dropdown
            const notificationsDropdown = document.createElement('div');
            notificationsDropdown.className = 'notifications-dropdown';
            notificationsDropdown.innerHTML = `
                <div class="notifications-header">
                    <h5>Notifications</h5>
                    <button class="mark-all-read">Mark all as read</button>
                </div>
                <div class="notifications-body">
                    <div class="notification-item unread">
                        <div class="notification-icon">
                            <i class="fas fa-user-tie"></i>
                        </div>
                        <div class="notification-content">
                            <p>Jane Doe has accepted your case</p>
                            <span class="notification-time">2 hours ago</span>
                        </div>
                    </div>
                    <div class="notification-item unread">
                        <div class="notification-icon">
                            <i class="fas fa-file-alt"></i>
                        </div>
                        <div class="notification-content">
                            <p>New document added to your case</p>
                            <span class="notification-time">Yesterday</span>
                        </div>
                    </div>
                    <div class="notification-item">
                        <div class="notification-icon">
                            <i class="fas fa-comment-alt"></i>
                        </div>
                        <div class="notification-content">
                            <p>Michael Smith requested more information</p>
                            <span class="notification-time">2 days ago</span>
                        </div>
                    </div>
                </div>
                <div class="notifications-footer">
                    <a href="#all-notifications">View all notifications</a>
                </div>
            `;
            
            // Position the dropdown
            const bellRect = notificationBell.getBoundingClientRect();
            notificationsDropdown.style.top = `${bellRect.bottom + window.scrollY}px`;
            notificationsDropdown.style.right = `${window.innerWidth - bellRect.right}px`;
            
            // Remove existing dropdowns
            document.querySelectorAll('.notifications-dropdown').forEach(el => el.remove());
            
            // Add to DOM
            document.body.appendChild(notificationsDropdown);
            
            // Show with animation
            setTimeout(() => {
                notificationsDropdown.classList.add('active');
            }, 10);
            
            // Add event listeners
            document.querySelector('.mark-all-read').addEventListener('click', function() {
                document.querySelectorAll('.notification-item').forEach(item => {
                    item.classList.remove('unread');
                });
                
                // Remove notification dot
                document.querySelector('.notification-dot')?.remove();
            });
            
            // Close when clicking outside
            document.addEventListener('click', function closeNotifications(e) {
                if (!notificationsDropdown.contains(e.target) && e.target !== notificationBell) {
                    notificationsDropdown.classList.remove('active');
                    setTimeout(() => {
                        notificationsDropdown.remove();
                    }, 300);
                    document.removeEventListener('click', closeNotifications);
                }
            });
        });
    }
}

// Show toast notification
function showToast(title, message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container');
    
    if (!toastContainer) return;
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-header">
            <i class="fas ${getIconForToastType(type)} me-2"></i>
            <strong class="me-auto">${title}</strong>
            <button type="button" class="toast-close">&times;</button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Show with animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Add close button functionality
    toast.querySelector('.toast-close').addEventListener('click', function() {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    });
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        }
    }, 5000);
}

// Get icon for toast type
function getIconForToastType(type) {
    switch(type) {
        case 'success': return 'fa-check-circle';
        case 'warning': return 'fa-exclamation-triangle';
        case 'error': return 'fa-times-circle';
        case 'info':
        default: return 'fa-info-circle';
    }
}

// Setup page transitions
function setupPageTransitions() {
    // Add transition styles
    const style = document.createElement('style');
    style.textContent = `
        .page-transition-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: var(--dark-bg-primary);
            z-index: 9999;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s ease, visibility 0.3s ease;
        }
        
        .page-transition-overlay.active {
            opacity: 1;
            visibility: visible;
        }
    `;
    document.head.appendChild(style);
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'page-transition-overlay';
    document.body.appendChild(overlay);
    
    // Add transition to all internal links
    document.querySelectorAll('a[href]').forEach(link => {
        // Skip links with no-transition attribute
        if (link.hasAttribute('data-no-transition')) return;
        
        // Skip external links and anchor links
        const href = link.getAttribute('href');
        if (href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return;
        
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Show overlay
            overlay.classList.add('active');
            
            // Navigate after transition
            setTimeout(() => {
                window.location.href = href;
            }, 300);
        });
    });
}

// Improve accessibility
function improveAccessibility() {
    // Add focus styles
    const style = document.createElement('style');
    style.textContent = `
        :focus {
            outline: 2px solid var(--orange-primary) !important;
            outline-offset: 2px !important;
        }
        
        .skip-to-content {
            position: absolute;
            top: -40px;
            left: 0;
            background: var(--orange-primary);
            color: white;
            padding: 8px 16px;
            z-index: 10000;
            transition: top 0.3s ease;
        }
        
        .skip-to-content:focus {
            top: 0;
        }
    `;
    document.head.appendChild(style);
    
    // Add skip to content link
    const skipLink = document.createElement('a');
    skipLink.className = 'skip-to-content';
    skipLink.href = '#main-content';
    skipLink.textContent = 'Skip to content';
    document.body.prepend(skipLink);
    
    // Add main content ID if not present
    const mainContent = document.querySelector('main') || document.querySelector('.main-content');
    if (mainContent && !mainContent.id) {
        mainContent.id = 'main-content';
    }
    
    // Add aria labels to elements missing them
    document.querySelectorAll('button:not([aria-label]):not([title])').forEach(button => {
        if (button.textContent.trim()) return;
        
        // Try to determine purpose from icon
        const icon = button.querySelector('i[class*="fa-"]');
        if (icon) {
            const iconClass = Array.from(icon.classList).find(cls => cls.startsWith('fa-'));
            if (iconClass) {
                const purpose = iconClass.replace('fa-', '').replace(/-/g, ' ');
                button.setAttribute('aria-label', purpose);
            }
        }
    });
    
    // Add role attributes
    document.querySelectorAll('nav:not([role])').forEach(nav => {
        nav.setAttribute('role', 'navigation');
    });
    
    document.querySelectorAll('main:not([role])').forEach(main => {
        main.setAttribute('role', 'main');
    });
    
    document.querySelectorAll('header:not([role])').forEach(header => {
        header.setAttribute('role', 'banner');
    });
    
    document.querySelectorAll('footer:not([role])').forEach(footer => {
        footer.setAttribute('role', 'contentinfo');
    });
}

// Add CSS for UX enhancements
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.textContent = `
        /* Loading overlay */
        .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s ease, visibility 0.3s ease;
        }
        
        .loading-overlay.active {
            opacity: 1;
            visibility: visible;
        }
        
        .loading-spinner {
            text-align: center;
        }
        
        .spinner {
            width: 50px;
            height: 50px;
            border: 5px solid rgba(255, 107, 0, 0.3);
            border-radius: 50%;
            border-top-color: var(--orange-primary);
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }
        
        .loading-text {
            color: white;
            font-weight: 500;
        }
        
        /* Keyboard shortcuts button */
        .keyboard-shortcut-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background-color: var(--dark-bg-secondary);
            color: var(--dark-text-primary);
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: var(--shadow-md);
            z-index: 900;
            transition: all 0.3s ease;
        }
        
        .keyboard-shortcut-btn:hover {
            transform: translateY(-3px);
            box-shadow: var(--shadow-lg);
            background-color: var(--orange-primary);
            color: white;
        }
        
        /* Tour styles */
        .tour-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 9990;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s ease, visibility 0.3s ease;
        }
        
        .tour-overlay.active {
            opacity: 1;
            visibility: visible;
        }
        
        .tour-highlight {
            position: absolute;
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7);
            border-radius: 4px;
            z-index: 9991;
            pointer-events: none;
        }
        
        .tour-popup {
            position: absolute;
            background-color: var(--dark-bg-secondary);
            border-radius: 8px;
            padding: 1.5rem;
            box-shadow: var(--shadow-lg);
            z-index: 9992;
            width: 300px;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s ease, visibility 0.3s ease;
        }
        
        .tour-popup.active {
            opacity: 1;
            visibility: visible;
        }
        
        .tour-popup h4 {
            margin-top: 0;
            margin-bottom: 0.5rem;
            color: var(--orange-primary);
        }
        
        .tour-popup p {
            margin-bottom: 1.5rem;
        }
        
        .tour-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .tour-progress {
            color: var(--dark-text-secondary);
            font-size: 0.875rem;
        }
        
        .tour-buttons {
            display: flex;
            gap: 0.5rem;
        }
        
        .tour-close {
            position: absolute;
            top: 10px;
            right: 10px;
            background: none;
            border: none;
            color: var(--dark-text-secondary);
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0;
            line-height: 1;
        }
        
        .tour-prompt {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background-color: var(--dark-bg-secondary);
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            padding: 1.5rem;
            z-index: 9000;
            width: 300px;
            transform: translateY(100px);
            opacity: 0;
            transition: transform 0.3s ease, opacity 0.3s ease;
        }
        
        .tour-prompt.active {
            transform: translateY(0);
            opacity: 1;
        }
        
        .tour-prompt h4 {
            margin-top: 0;
            color: var(--orange-primary);
        }
        
        .tour-prompt-actions {
            display: flex;
            gap: 0.5rem;
            margin-top: 1.5rem;
        }
        
        /* Search styles */
        .search-container {
            position: relative;
            margin-left: 1rem;
        }
        
        .search-box {
            display: flex;
            align-items: center;
            background-color: var(--dark-bg-tertiary);
            border-radius: 50px;
            padding: 0.25rem;
            transition: all 0.3s ease;
        }
        
        .search-input {
            background: transparent;
            border: none;
            color: var(--dark-text-primary);
            padding: 0.5rem;
            width: 150px;
            transition: width 0.3s ease;
        }
        
        .search-input:focus {
            outline: none;
        }
        
        .search-button {
            background-color: var(--orange-primary);
            color: white;
            border: none;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .search-button:hover {
            background-color: var(--orange-secondary);
        }
        
        .search-container.expanded .search-input {
            width: 200px;
        }
        
        .search-result-item {
            margin-bottom: 1.5rem;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid var(--element-border);
        }
        
        .search-result-item:last-child {
            margin-bottom: 0;
            padding-bottom: 0;
            border-bottom: none;
        }
        
        .search-result-item h5 {
            margin-bottom: 0.5rem;
        }
        
        .search-result-item p {
            color: var(--dark-text-secondary);
            margin-bottom: 0;
        }
        
        /* Notifications styles */
        .notifications-dropdown {
            position: absolute;
            background-color: var(--dark-bg-secondary);
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            width: 350px;
            z-index: 1000;
            transform: translateY(10px);
            opacity: 0;
            visibility: hidden;
            transition: transform 0.3s ease, opacity 0.3s ease, visibility 0.3s ease;
        }
        
        .notifications-dropdown.active {
            transform: translateY(0);
            opacity: 1;
            visibility: visible;
        }
        
        .notifications-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 1.5rem;
            border-bottom: 1px solid var(--element-border);
        }
        
        .notifications-header h5 {
            margin: 0;
        }
        
        .mark-all-read {
            background: none;
            border: none;
            color: var(--orange-primary);
            cursor: pointer;
            font-size: 0.875rem;
        }
        
        .notifications-body {
            max-height: 350px;
            overflow-y: auto;
        }
        
        .notification-item {
            display: flex;
            padding: 1rem 1.5rem;
            border-bottom: 1px solid var(--element-border);
            transition: background-color 0.2s ease;
        }
        
        .notification-item:hover {
            background-color: var(--element-hover);
        }
        
        .notification-item.unread {
            background-color: rgba(255, 107, 0, 0.05);
        }
        
        .notification-item.unread:hover {
            background-color: rgba(255, 107, 0, 0.1);
        }
        
        .notification-icon {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background-color: var(--element-active);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 1rem;
            color: var(--orange-primary);
        }
        
        .notification-content {
            flex: 1;
        }
        
        .notification-content p {
            margin: 0 0 0.25rem;
        }
        
        .notification-time {
            font-size: 0.75rem;
            color: var(--dark-text-tertiary);
        }
        
        .notifications-footer {
            padding: 1rem 1.5rem;
            text-align: center;
            border-top: 1px solid var(--element-border);
        }
        
        .notifications-footer a {
            color: var(--orange-primary);
            text-decoration: none;
        }
        
        /* Toast notifications */
        .toast-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
        }
        
        .toast {
            background-color: var(--dark-bg-secondary);
            border-radius: 8px;
            box-shadow: var(--shadow-md);
            margin-bottom: 1rem;
            width: 350px;
            overflow: hidden;
            transform: translateX(100%);
            opacity: 0;
            transition: transform 0.3s ease, opacity 0.3s ease;
        }
        
        .toast.show {
            transform: translateX(0);
            opacity: 1;
        }
        
        .toast-header {
            display: flex;
            align-items: center;
            padding: 0.75rem 1rem;
            background-color: var(--dark-bg-tertiary);
            border-bottom: 1px solid var(--element-border);
        }
        
        .toast-body {
            padding: 1rem;
        }
        
        .toast-close {
            background: none;
            border: none;
            color: var(--dark-text-secondary);
            font-size: 1.25rem;
            cursor: pointer;
            padding: 0;
            margin-left: auto;
        }
        
        .toast-success .toast-header i {
            color: var(--success);
        }
        
        .toast-warning .toast-header i {
            color: var(--warning);
        }
        
        .toast-error .toast-header i {
            color: var(--error);
        }
        
        .toast-info .toast-header i {
            color: var(--info);
        }
        
        /* Password strength meter */
        .password-strength-meter {
            margin-top: 0.5rem;
        }
        
        .strength-bars {
            display: flex;
            gap: 5px;
            margin-bottom: 0.25rem;
        }
        
        .strength-bar {
            height: 4px;
            flex: 1;
            background-color: var(--element-border);
            border-radius: 2px;
        }
        
        .strength-bar.weak {
            background-color: #f44336;
        }
        
        .strength-bar.medium {
            background-color: #ff9800;
        }
        
        .strength-bar.good {
            background-color: #2196f3;
        }
        
        .strength-bar.strong {
            background-color: #4caf50;
        }
        
        .strength-text {
            font-size: 0.75rem;
            color: var(--dark-text-tertiary);
        }
    `;
    document.head.appendChild(style);
});
