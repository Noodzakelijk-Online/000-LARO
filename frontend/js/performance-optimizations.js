// Performance optimizations for Legal AI Reach Out Platform

/**
 * Performance optimization script
 * This script implements various performance optimizations to make the platform
 * as fast as possible, focusing on resource loading, rendering, and execution.
 */

// Execute when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Initialize performance optimizations
  initPerformanceOptimizations();
});

/**
 * Initialize all performance optimizations
 */
function initPerformanceOptimizations() {
  // Implement lazy loading for images and iframes
  lazyLoadResources();
  
  // Implement intersection observer for content loading
  implementIntersectionObserver();
  
  // Optimize event listeners with debouncing and throttling
  optimizeEventListeners();
  
  // Implement resource hints for faster navigation
  implementResourceHints();
  
  // Implement local storage caching
  implementLocalStorageCaching();
  
  // Track and log performance metrics
  trackPerformanceMetrics();
}

/**
 * Lazy load images and iframes
 */
function lazyLoadResources() {
  // Find all images and iframes without loading="lazy" attribute
  const images = document.querySelectorAll('img:not([loading="lazy"])');
  const iframes = document.querySelectorAll('iframe:not([loading="lazy"])');
  
  // Add loading="lazy" attribute to images
  images.forEach(img => {
    if (!img.hasAttribute('loading')) {
      img.setAttribute('loading', 'lazy');
    }
    
    // Add width and height attributes if missing to prevent layout shifts
    if (!img.hasAttribute('width') && !img.hasAttribute('height')) {
      // Set default dimensions if natural dimensions are not available
      if (img.naturalWidth && img.naturalHeight) {
        img.setAttribute('width', img.naturalWidth);
        img.setAttribute('height', img.naturalHeight);
      }
    }
  });
  
  // Add loading="lazy" attribute to iframes
  iframes.forEach(iframe => {
    if (!iframe.hasAttribute('loading')) {
      iframe.setAttribute('loading', 'lazy');
    }
  });
  
  // For browsers that don't support native lazy loading
  if (!('loading' in HTMLImageElement.prototype)) {
    // Implement fallback lazy loading with Intersection Observer
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');
    const lazyIframes = document.querySelectorAll('iframe[loading="lazy"]');
    
    const lazyLoadObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target;
          
          if (element.tagName.toLowerCase() === 'img') {
            if (element.dataset.src) {
              element.src = element.dataset.src;
            }
            if (element.dataset.srcset) {
              element.srcset = element.dataset.srcset;
            }
          } else if (element.tagName.toLowerCase() === 'iframe') {
            if (element.dataset.src) {
              element.src = element.dataset.src;
            }
          }
          
          observer.unobserve(element);
        }
      });
    });
    
    lazyImages.forEach(img => {
      // Store original src in data attribute and remove src
      if (img.src && !img.dataset.src) {
        img.dataset.src = img.src;
        img.removeAttribute('src');
      }
      
      // Store original srcset in data attribute and remove srcset
      if (img.srcset && !img.dataset.srcset) {
        img.dataset.srcset = img.srcset;
        img.removeAttribute('srcset');
      }
      
      lazyLoadObserver.observe(img);
    });
    
    lazyIframes.forEach(iframe => {
      // Store original src in data attribute and remove src
      if (iframe.src && !iframe.dataset.src) {
        iframe.dataset.src = iframe.src;
        iframe.removeAttribute('src');
      }
      
      lazyLoadObserver.observe(iframe);
    });
  }
}

/**
 * Implement Intersection Observer for content loading
 */
function implementIntersectionObserver() {
  // Find all sections that should be loaded on demand
  const sections = document.querySelectorAll('.feature-card, .step-card, .metric-card, .chart');
  
  // Create intersection observer
  const sectionObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const section = entry.target;
        
        // Add visible class to trigger animations
        section.classList.add('visible');
        
        // Load any deferred content
        const deferredContent = section.querySelector('[data-deferred-content]');
        if (deferredContent) {
          deferredContent.innerHTML = deferredContent.dataset.deferredContent;
          delete deferredContent.dataset.deferredContent;
        }
        
        // Stop observing after loading
        observer.unobserve(section);
      }
    });
  }, {
    rootMargin: '50px', // Load when within 50px of viewport
    threshold: 0.1 // Trigger when at least 10% visible
  });
  
  // Observe each section
  sections.forEach(section => {
    sectionObserver.observe(section);
  });
}

/**
 * Optimize event listeners with debouncing and throttling
 */
function optimizeEventListeners() {
  // Debounce function for events that shouldn't fire too frequently
  function debounce(func, wait) {
    let timeout;
    return function() {
      const context = this;
      const args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        func.apply(context, args);
      }, wait);
    };
  }
  
  // Throttle function for events that should fire at a consistent rate
  function throttle(func, limit) {
    let inThrottle;
    return function() {
      const context = this;
      const args = arguments;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  // Optimize resize event
  const resizeHandler = debounce(() => {
    // Handle responsive adjustments
    adjustResponsiveElements();
  }, 100); // 100ms debounce
  
  window.addEventListener('resize', resizeHandler);
  
  // Optimize scroll event
  const scrollHandler = throttle(() => {
    // Handle scroll-based effects
    updateScrollBasedEffects();
  }, 50); // 50ms throttle
  
  window.addEventListener('scroll', scrollHandler);
  
  // Optimize input events
  const inputFields = document.querySelectorAll('input, textarea');
  inputFields.forEach(field => {
    const inputHandler = debounce((e) => {
      // Handle input validation
      if (typeof validateInput === 'function') {
        validateInput(e.target);
      }
    }, 300); // 300ms debounce
    
    field.addEventListener('input', inputHandler);
  });
}

/**
 * Adjust responsive elements based on viewport
 */
function adjustResponsiveElements() {
  // Adjust elements based on viewport size
  const viewportWidth = window.innerWidth;
  
  // Adjust navigation
  const navMenu = document.getElementById('navMenu');
  if (viewportWidth <= 767) {
    // Mobile view adjustments
    if (navMenu && !navMenu.classList.contains('mobile-ready')) {
      navMenu.classList.add('mobile-ready');
    }
  } else {
    // Desktop view adjustments
    if (navMenu && navMenu.classList.contains('mobile-ready')) {
      navMenu.classList.remove('mobile-ready');
      navMenu.classList.remove('active'); // Hide mobile menu if open
    }
  }
}

/**
 * Update scroll-based effects
 */
function updateScrollBasedEffects() {
  // Get scroll position
  const scrollPosition = window.scrollY;
  
  // Apply header transparency based on scroll
  const header = document.querySelector('header');
  if (header) {
    if (scrollPosition > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }
}

/**
 * Implement resource hints for faster navigation
 */
function implementResourceHints() {
  // Add preconnect for external domains
  const domains = [
    'https://i.ibb.co', // Image hosting
    'https://danolbza.manus.space' // Dashboard link
  ];
  
  domains.forEach(domain => {
    // Check if preconnect already exists
    if (!document.querySelector(`link[rel="preconnect"][href="${domain}"]`)) {
      const preconnect = document.createElement('link');
      preconnect.rel = 'preconnect';
      preconnect.href = domain;
      document.head.appendChild(preconnect);
    }
  });
  
  // Add prefetch for likely navigation
  const prefetchUrls = [
    'https://danolbza.manus.space/dashboard_dark.html'
  ];
  
  prefetchUrls.forEach(url => {
    // Check if prefetch already exists
    if (!document.querySelector(`link[rel="prefetch"][href="${url}"]`)) {
      const prefetch = document.createElement('link');
      prefetch.rel = 'prefetch';
      prefetch.href = url;
      document.head.appendChild(prefetch);
    }
  });
}

/**
 * Implement local storage caching
 */
function implementLocalStorageCaching() {
  // Check if local storage is available
  if (typeof Storage !== 'undefined') {
    // Cache user preferences
    const cacheUserPreferences = () => {
      // Get form inputs for preferences
      const inputs = document.querySelectorAll('input[data-preference]');
      inputs.forEach(input => {
        const preference = input.dataset.preference;
        
        // Save preference when input changes
        input.addEventListener('change', () => {
          let value;
          if (input.type === 'checkbox') {
            value = input.checked;
          } else {
            value = input.value;
          }
          
          localStorage.setItem(`preference_${preference}`, JSON.stringify(value));
        });
        
        // Load saved preference
        const savedValue = localStorage.getItem(`preference_${preference}`);
        if (savedValue !== null) {
          const parsedValue = JSON.parse(savedValue);
          if (input.type === 'checkbox') {
            input.checked = parsedValue;
          } else {
            input.value = parsedValue;
          }
        }
      });
    };
    
    // Cache form data to prevent loss
    const cacheFormData = () => {
      const forms = document.querySelectorAll('form[data-cache-id]');
      forms.forEach(form => {
        const formId = form.dataset.cacheId;
        const formInputs = form.querySelectorAll('input, textarea, select');
        
        // Save form data when inputs change
        formInputs.forEach(input => {
          // Skip password fields for security
          if (input.type === 'password') return;
          
          input.addEventListener('input', debounce(() => {
            const formData = {};
            formInputs.forEach(field => {
              if (field.type !== 'password' && field.name) {
                formData[field.name] = field.value;
              }
            });
            
            localStorage.setItem(`form_${formId}`, JSON.stringify(formData));
          }, 500));
        });
        
        // Load saved form data
        const savedFormData = localStorage.getItem(`form_${formId}`);
        if (savedFormData !== null) {
          const parsedFormData = JSON.parse(savedFormData);
          Object.keys(parsedFormData).forEach(fieldName => {
            const field = form.querySelector(`[name="${fieldName}"]`);
            if (field && field.type !== 'password') {
              field.value = parsedFormData[fieldName];
            }
          });
        }
        
        // Clear saved form data on successful submission
        form.addEventListener('submit', () => {
          localStorage.removeItem(`form_${formId}`);
        });
      });
    };
    
    // Initialize caching
    cacheUserPreferences();
    cacheFormData();
  }
}

/**
 * Track and log performance metrics
 */
function trackPerformanceMetrics() {
  // Check if Performance API is available
  if (window.performance) {
    // Create a PerformanceObserver to observe navigation timing
    if (PerformanceObserver) {
      const navigationObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            // Log navigation timing metrics
            console.log('Navigation Timing:', {
              dnsLookup: entry.domainLookupEnd - entry.domainLookupStart,
              tcpConnection: entry.connectEnd - entry.connectStart,
              requestTime: entry.responseStart - entry.requestStart,
              responseTime: entry.responseEnd - entry.responseStart,
              domProcessing: entry.domComplete - entry.domInteractive,
              loadEvent: entry.loadEventEnd - entry.loadEventStart,
              totalPageLoad: entry.loadEventEnd - entry.startTime
            });
          }
        });
      });
      
      navigationObserver.observe({ entryTypes: ['navigation'] });
      
      // Observe resource timing
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        // Filter for slow resources (taking more than 1 second)
        const slowResources = entries.filter(entry => entry.duration > 1000);
        if (slowResources.length > 0) {
          console.warn('Slow resources detected:', slowResources);
        }
      });
      
      resourceObserver.observe({ entryTypes: ['resource'] });
      
      // Observe long tasks
      if (typeof PerformanceLongTaskTiming !== 'undefined') {
        const longTaskObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          console.warn('Long tasks detected:', entries);
        });
        
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      }
    }
    
    // Log Core Web Vitals if available
    if ('web-vitals' in window) {
      window['web-vitals'].getCLS(metric => console.log('CLS:', metric.value));
      window['web-vitals'].getFID(metric => console.log('FID:', metric.value));
      window['web-vitals'].getLCP(metric => console.log('LCP:', metric.value));
    }
  }
}

/**
 * Debounce function for events that shouldn't fire too frequently
 */
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

// Initialize performance optimizations immediately
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  initPerformanceOptimizations();
}
