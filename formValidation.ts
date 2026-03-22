/**
 * Form Validation Utilities
 * 
 * Client-side validation helpers for forms with real-time feedback.
 */

export interface ValidationRule {
  validate: (value: any) => boolean;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Common validation rules
 */
export const validationRules = {
  required: (message: string = "This field is required"): ValidationRule => ({
    validate: (value) => {
      if (typeof value === "string") return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return value != null;
    },
    message,
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    validate: (value) => {
      if (typeof value !== "string") return false;
      return value.length >= min;
    },
    message: message || `Must be at least ${min} characters`,
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    validate: (value) => {
      if (typeof value !== "string") return false;
      return value.length <= max;
    },
    message: message || `Must be at most ${max} characters`,
  }),

  email: (message: string = "Please enter a valid email address"): ValidationRule => ({
    validate: (value) => {
      if (typeof value !== "string") return false;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    },
    message,
  }),

  phone: (message: string = "Please enter a valid phone number"): ValidationRule => ({
    validate: (value) => {
      if (typeof value !== "string") return false;
      // Dutch phone number format
      const phoneRegex = /^(\+31|0)[1-9][0-9]{8}$/;
      return phoneRegex.test(value.replace(/[\s-]/g, ""));
    },
    message,
  }),

  postalCode: (message: string = "Please enter a valid postal code"): ValidationRule => ({
    validate: (value) => {
      if (typeof value !== "string") return false;
      // Dutch postal code format: 1234AB
      const postalCodeRegex = /^[1-9][0-9]{3}\s?[A-Z]{2}$/i;
      return postalCodeRegex.test(value);
    },
    message,
  }),

  url: (message: string = "Please enter a valid URL"): ValidationRule => ({
    validate: (value) => {
      if (typeof value !== "string") return false;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message,
  }),

  min: (min: number, message?: string): ValidationRule => ({
    validate: (value) => {
      const num = Number(value);
      return !isNaN(num) && num >= min;
    },
    message: message || `Must be at least ${min}`,
  }),

  max: (max: number, message?: string): ValidationRule => ({
    validate: (value) => {
      const num = Number(value);
      return !isNaN(num) && num <= max;
    },
    message: message || `Must be at most ${max}`,
  }),

  pattern: (regex: RegExp, message: string): ValidationRule => ({
    validate: (value) => {
      if (typeof value !== "string") return false;
      return regex.test(value);
    },
    message,
  }),

  custom: (validator: (value: any) => boolean, message: string): ValidationRule => ({
    validate: validator,
    message,
  }),
};

/**
 * Validate a single field against multiple rules
 */
export function validateField(value: any, rules: ValidationRule[]): ValidationResult {
  const errors: string[] = [];

  for (const rule of rules) {
    if (!rule.validate(value)) {
      errors.push(rule.message);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate an entire form object
 */
export function validateForm<T extends Record<string, any>>(
  formData: T,
  rules: Record<keyof T, ValidationRule[]>
): Record<keyof T, ValidationResult> {
  const results = {} as Record<keyof T, ValidationResult>;

  for (const field in rules) {
    results[field] = validateField(formData[field], rules[field]);
  }

  return results;
}

/**
 * Check if form validation results are all valid
 */
export function isFormValid<T extends Record<string, any>>(
  results: Record<keyof T, ValidationResult>
): boolean {
  return Object.values(results).every((result) => result.isValid);
}

/**
 * Get all error messages from validation results
 */
export function getFormErrors<T extends Record<string, any>>(
  results: Record<keyof T, ValidationResult>
): Record<keyof T, string[]> {
  const errors = {} as Record<keyof T, string[]>;

  for (const field in results) {
    errors[field] = results[field].errors;
  }

  return errors;
}

/**
 * Real-time validation hook helper
 */
export function createValidator<T extends Record<string, any>>(
  rules: Record<keyof T, ValidationRule[]>
) {
  return {
    validateField: (field: keyof T, value: any) => {
      return validateField(value, rules[field] || []);
    },
    validateForm: (formData: T) => {
      return validateForm(formData, rules);
    },
  };
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Validate file upload
 */
export function validateFile(
  file: File,
  options: {
    maxSize?: number; // in bytes
    allowedTypes?: string[]; // MIME types
  } = {}
): ValidationResult {
  const errors: string[] = [];

  if (options.maxSize && file.size > options.maxSize) {
    const maxSizeMB = (options.maxSize / (1024 * 1024)).toFixed(1);
    errors.push(`File size must be less than ${maxSizeMB}MB`);
  }

  if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
    errors.push(`File type ${file.type} is not allowed`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate multiple files
 */
export function validateFiles(
  files: File[],
  options: {
    maxSize?: number;
    allowedTypes?: string[];
    maxFiles?: number;
  } = {}
): ValidationResult {
  const errors: string[] = [];

  if (options.maxFiles && files.length > options.maxFiles) {
    errors.push(`Maximum ${options.maxFiles} files allowed`);
  }

  for (const file of files) {
    const result = validateFile(file, options);
    if (!result.isValid) {
      errors.push(`${file.name}: ${result.errors.join(", ")}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

