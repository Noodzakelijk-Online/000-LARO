export const MAX_EVIDENCE_FILE_BYTES = 7 * 1024 * 1024;
export const MAX_EVIDENCE_BASE64_CHARS = Math.ceil(MAX_EVIDENCE_FILE_BYTES / 3) * 4;

const SUPPORTED_EXACT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-outlook",
  "message/rfc822",
  "text/csv",
  "text/html",
  "text/plain",
]);

const DOCUMENT_ANALYSIS_MIME_TYPES = [
  "text/plain",
  "text/csv",
  "text/html",
  "message/rfc822",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/x-ms-bmp",
  "image/x-portable-bitmap",
] as const;

const IMAGE_OCR_MIME_TYPES = new Set<string>(DOCUMENT_ANALYSIS_MIME_TYPES.filter((mimeType) => mimeType.startsWith("image/")));
const DOCUMENT_ANALYSIS_MIME_TYPE_SET = new Set<string>(DOCUMENT_ANALYSIS_MIME_TYPES);

export function getSupportedDocumentAnalysisMimeTypes(): string[] {
  return [...DOCUMENT_ANALYSIS_MIME_TYPES];
}

export function isSupportedImageOcrMimeType(mimeType: string): boolean {
  return IMAGE_OCR_MIME_TYPES.has(mimeType.trim().toLowerCase().split(";")[0]);
}

export function isSupportedDocumentAnalysisMimeType(mimeType: string): boolean {
  return DOCUMENT_ANALYSIS_MIME_TYPE_SET.has(mimeType.trim().toLowerCase().split(";")[0]);
}

export function isSupportedEvidenceMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  return (
    SUPPORTED_EXACT_MIME_TYPES.has(normalized) ||
    normalized.startsWith("image/") ||
    normalized.startsWith("video/") ||
    normalized.startsWith("audio/")
  );
}

export function evidenceTypeForMime(
  mimeType: string
): "document" | "email" | "photo" | "video" | "audio" | "other" {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === "message/rfc822") return "email";
  if (normalized.startsWith("image/")) return "photo";
  if (normalized.startsWith("video/")) return "video";
  if (normalized.startsWith("audio/")) return "audio";
  if (isSupportedEvidenceMimeType(normalized)) return "document";
  return "other";
}
