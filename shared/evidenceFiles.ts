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
