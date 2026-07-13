/**
 * Advanced Image Optimization Module for Legal AI Reach Out Platform
 * 
 * This module implements WebP format with proper srcset attributes for responsive images,
 * lazy loading, and other image optimization techniques.
 */

// Execute when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Initialize image optimizations
  initImageOptimizations();
});

/**
 * Initialize all image optimizations
 */
function initImageOptimizations() {
  // Convert images to WebP format with srcset
  convertImagesToWebP();
  
  // Implement lazy loading for images
  implementLazyLoading();
  
  // Add image error handling
  addImageErrorHandling();
  
  // Implement responsive image handling
  implementResponsiveImages();
  
  // Add image compression for user uploads
  setupImageCompression();
}

/**
 * Convert images to WebP format with srcset
 */
function convertImagesToWebP() {
  // Get all images on the page
  const images = document.querySelectorAll('img:not([data-no-webp])');
  
  // Check if browser supports WebP
  const supportsWebP = localStorage.getItem('supportsWebP');
  
  if (supportsWebP === null) {
    // Test for WebP support if not already tested
    const webPTest = new Image();
    webPTest.onload = function() {
      localStorage.setItem('supportsWebP', 'true');
      processImagesForWebP(images, true);
    };
    webPTest.onerror = function() {
      localStorage.setItem('supportsWebP', 'false');
      processImagesForWebP(images, false);
    };
    webPTest.src = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
  } else {
    // Use cached result
    processImagesForWebP(images, supportsWebP === 'true');
  }
}

/**
 * Process images for WebP conversion
 */
function processImagesForWebP(images, supportsWebP) {
  images.forEach(img => {
    // Skip if already processed
    if (img.dataset.processed) return;
    
    const originalSrc = img.src;
    
    // Mark as processed to avoid duplicate processing
    img.dataset.processed = 'true';
    
    // Store original src as fallback
    img.dataset.originalSrc = originalSrc;
    
    if (supportsWebP) {
      // Convert to WebP if supported
      const webPSrc = getWebPUrl(originalSrc);
      
      // Create srcset for responsive images
      if (!img.srcset) {
        const width = img.width || 800;
        
        // Create srcset with multiple sizes
        const srcset = [
          `${getWebPUrl(originalSrc, width / 2)} ${width / 2}w`,
          `${getWebPUrl(originalSrc, width)} ${width}w`,
          `${getWebPUrl(originalSrc, width * 2)} ${width * 2}w`
        ].join(', ');
        
        img.srcset = srcset;
        img.sizes = img.sizes || '(max-width: 767px) 100vw, (max-width: 991px) 50vw, 33vw';
      }
      
      // Update src to WebP
      img.src = webPSrc;
    }
  });
}

/**
 * Get WebP URL from original image URL
 */
function getWebPUrl(url, width) {
  // For demo purposes, we're simulating WebP conversion
  // In production, this would connect to a real image processing service
  
  // Extract base URL and extension
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  const extension = pathname.split('.').pop().toLowerCase();
  
  // Skip if already WebP
  if (extension === 'webp') return url;
  
  // For images from i.ibb.co, we can use their WebP conversion
  if (url.includes('i.ibb.co')) {
    // Replace extension with webp
    const webpUrl = url.replace(new RegExp(`\\.${extension}$`), '.webp');
    
    // Add width parameter if specified
    if (width) {
      return `${webpUrl}?width=${width}`;
    }
    
    return webpUrl;
  }
  
  // For other images, we would use a real image processing service
  // For this demo, we'll just return the original URL
  return url;
}

/**
 * Implement lazy loading for images
 */
function implementLazyLoading() {
  // Check if Intersection Observer is supported
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          
          // Load the image
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          
          if (img.dataset.srcset) {
            img.srcset = img.dataset.srcset;
            img.removeAttribute('data-srcset');
          }
          
          // Stop observing the image
          observer.unobserve(img);
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01
    });
    
    // Get all images with data-src attribute
    const lazyImages = document.querySelectorAll('img[data-src]');
    lazyImages.forEach(img => {
      imageObserver.observe(img);
    });
  } else {
    // Fallback for browsers that don't support Intersection Observer
    // Load all images immediately
    const lazyImages = document.querySelectorAll('img[data-src]');
    lazyImages.forEach(img => {
      img.src = img.dataset.src;
      
      if (img.dataset.srcset) {
        img.srcset = img.dataset.srcset;
      }
    });
  }
}

/**
 * Add error handling for images
 */
function addImageErrorHandling() {
  const images = document.querySelectorAll('img');
  
  images.forEach(img => {
    img.addEventListener('error', function() {
      // Try original source if available
      if (this.dataset.originalSrc && this.src !== this.dataset.originalSrc) {
        this.src = this.dataset.originalSrc;
        return;
      }
      
      // Replace with placeholder
      this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"%3E%3Cpath fill="%23CCC" d="M21.9 21.9l-8.49-8.49-9.93-9.93L2.1 2.1 0.69 3.51 3 5.83V19c0 1.1 0.9 2 2 2h13.17l2.31 2.31 1.42-1.41zM5 19V7.83l7.17 7.17H5zm11.9-8.49L15.17 12l-3-3 1.41-1.41 1.41 1.41 1.41-1.41 1.41 1.41-1.41 1.42zm0.59-5.66L16.24 3.6l-1.41 1.41L15.17 6l-1.41 1.41-1.41-1.41-1.41 1.41L12.34 6l-1.41-1.41 1.41-1.41-1.41-1.42L8.76 3.6l1.42 1.42L9 6.17l1.41 1.41L9 8.99l1.41 1.41 1.41-1.41 1.42 1.41 1.41-1.41 1.41 1.41 1.41-1.41-1.41-1.42 1.41-1.41z"/%3E%3C/svg%3E';
      this.alt = 'Image failed to load';
      this.style.padding = '20px';
      this.style.backgroundColor = '#f0f0f0';
    });
  });
}

/**
 * Implement responsive image handling
 */
function implementResponsiveImages() {
  // Get all images without srcset
  const images = document.querySelectorAll('img:not([srcset]):not([data-no-responsive])');
  
  images.forEach(img => {
    // Skip if already processed or has srcset
    if (img.dataset.processed || img.srcset) return;
    
    const originalSrc = img.src;
    
    // Get image dimensions
    const width = img.getAttribute('width') || img.width || 800;
    
    // Create srcset with multiple sizes
    const srcset = [
      `${originalSrc}?width=${width / 2} ${width / 2}w`,
      `${originalSrc} ${width}w`,
      `${originalSrc}?width=${width * 2} ${width * 2}w`
    ].join(', ');
    
    img.srcset = srcset;
    img.sizes = img.sizes || '(max-width: 767px) 100vw, (max-width: 991px) 50vw, 33vw';
  });
}

/**
 * Set up image compression for user uploads
 */
function setupImageCompression() {
  // Get all file inputs that accept images
  const fileInputs = document.querySelectorAll('input[type="file"][accept*="image"]');
  
  fileInputs.forEach(input => {
    input.addEventListener('change', async function(e) {
      const files = e.target.files;
      
      if (!files.length) return;
      
      // Check if browser supports the required APIs
      if (!window.FileReader || !window.Blob) {
        console.warn('Browser does not support image compression');
        return;
      }
      
      // Load the image compression library dynamically
      if (!window.imageCompression) {
        try {
          // In a real implementation, we would load a real library
          // For this demo, we'll simulate the compression
          window.imageCompression = {
            getDataUrlFromFile: file => {
              return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
            },
            compressImage: async (file, options) => {
              // Simulate compression by returning the original file
              // In production, this would actually compress the image
              console.log(`Compressing image to maxWidth: ${options.maxWidthOrHeight}px`);
              return file;
            }
          };
        } catch (err) {
          console.error('Failed to load image compression library:', err);
          return;
        }
      }
      
      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Skip non-image files
        if (!file.type.startsWith('image/')) continue;
        
        try {
          // Get image dimensions
          const dataUrl = await window.imageCompression.getDataUrlFromFile(file);
          const img = new Image();
          img.src = dataUrl;
          
          await new Promise(resolve => {
            img.onload = resolve;
          });
          
          // Determine max width based on image size
          const maxWidth = Math.min(1920, img.width);
          
          // Compress the image
          const compressedFile = await window.imageCompression.compressImage(file, {
            maxWidthOrHeight: maxWidth,
            useWebWorker: true,
            maxSizeMB: 1
          });
          
          // Replace the file in the input
          // Note: This is not directly possible with standard file inputs
          // In a real implementation, we would use a custom file upload component
          console.log(`Compressed image from ${file.size} bytes to ${compressedFile.size} bytes`);
        } catch (err) {
          console.error('Error compressing image:', err);
        }
      }
    });
  });
}

// Initialize image optimizations immediately if document is already loaded
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  initImageOptimizations();
}
