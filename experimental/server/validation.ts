/**
 * Data Validation Utilities
 * 
 * Centralized validation functions for forms, APIs, and data processing.
 */

import { z } from "zod";

// ============================================================================
// Email Validation
// ============================================================================

export const emailSchema = z.string().email("Invalid email address");

export function isValidEmail(email: string): boolean {
  try {
    emailSchema.parse(email);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Phone Number Validation (Dutch format)
// ============================================================================

export const dutchPhoneSchema = z.string().regex(
  /^(\+31|0031|0)[1-9][0-9]{8}$/,
  "Invalid Dutch phone number"
);

export function isValidDutchPhone(phone: string): boolean {
  try {
    dutchPhoneSchema.parse(phone);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Postal Code Validation (Dutch format: 1234 AB)
// ============================================================================

export const dutchPostalCodeSchema = z.string().regex(
  /^[1-9][0-9]{3}\s?[A-Z]{2}$/i,
  "Invalid Dutch postal code (format: 1234 AB)"
);

export function isValidDutchPostalCode(postalCode: string): boolean {
  try {
    dutchPostalCodeSchema.parse(postalCode);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Case Data Validation
// ============================================================================

export const caseDataSchema = z.object({
  clientName: z.string().min(2, "Client name must be at least 2 characters"),
  email: emailSchema,
  phone: z.string().optional(),
  caseType: z.string().min(3, "Case type is required"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  urgency: z.enum(["Low", "Medium", "High", "Critical"]),
  city: z.string().min(2, "City is required"),
  postalCode: z.string().optional(),
  preferredContactMethod: z.enum(["Email", "Phone", "Both"]).optional(),
});

export type CaseData = z.infer<typeof caseDataSchema>;

export function validateCaseData(data: unknown): { 
  success: boolean; 
  data?: CaseData; 
  errors?: string[];
} {
  try {
    const validated = caseDataSchema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return { success: false, errors: ["Validation failed"] };
  }
}

// ============================================================================
// Lawyer Data Validation
// ============================================================================

export const lawyerDataSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: emailSchema,
  phone: z.string().optional(),
  city: z.string().min(2, "City is required"),
  postalCode: dutchPostalCodeSchema.optional(),
  legalAreas: z.array(z.string()).min(1, "At least one legal area is required"),
  barAssociationNumber: z.string().optional(),
  currentlyAccepting: z.enum(["Yes", "No"]).optional(),
  caseLoad: z.number().min(0).max(100).optional(),
});

export type LawyerData = z.infer<typeof lawyerDataSchema>;

export function validateLawyerData(data: unknown): {
  success: boolean;
  data?: LawyerData;
  errors?: string[];
} {
  try {
    const validated = lawyerDataSchema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return { success: false, errors: ["Validation failed"] };
  }
}

// ============================================================================
// Coordinates Validation
// ============================================================================

export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export function isValidCoordinates(lat: number, lon: number): boolean {
  try {
    coordinatesSchema.parse({ latitude: lat, longitude: lon });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// File Upload Validation
// ============================================================================

export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/gif",
  "text/plain",
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateFileUpload(
  file: { size: number; type: string; name: string }
): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024} MB`,
    };
  }

  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed. Allowed types: PDF, Word, images, text`,
    };
  }

  return { valid: true };
}

// ============================================================================
// Date Validation
// ============================================================================

export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

export function isFutureDate(dateString: string): boolean {
  if (!isValidDate(dateString)) return false;
  return new Date(dateString) > new Date();
}

export function isPastDate(dateString: string): boolean {
  if (!isValidDate(dateString)) return false;
  return new Date(dateString) < new Date();
}

// ============================================================================
// String Sanitization
// ============================================================================

export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .replace(/[<>]/g, ""); // Remove < and > to prevent XSS
}

export function sanitizeHTML(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

// ============================================================================
// Number Validation
// ============================================================================

export function isPositiveInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

// ============================================================================
// URL Validation
// ============================================================================

export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// JSON Validation
// ============================================================================

export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

export function parseJSONSafely<T>(str: string, defaultValue: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return defaultValue;
  }
}

// ============================================================================
// Batch Validation
// ============================================================================

export function validateBatch<T>(
  items: unknown[],
  validator: (item: unknown) => { success: boolean; data?: T; errors?: string[] }
): {
  valid: T[];
  invalid: Array<{ item: unknown; errors: string[] }>;
} {
  const valid: T[] = [];
  const invalid: Array<{ item: unknown; errors: string[] }> = [];

  for (const item of items) {
    const result = validator(item);
    if (result.success && result.data) {
      valid.push(result.data);
    } else {
      invalid.push({ item, errors: result.errors || ["Unknown error"] });
    }
  }

  return { valid, invalid };
}

