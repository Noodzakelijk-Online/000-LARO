/**
 * Desktop evidence agent — in-memory stub for local/dev when DB tables are not migrated.
 * Swap for persistent storage when `agent_*` tables exist.
 */
import { nanoid } from "nanoid";
import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-agent-secret-change-me");

type AgentDevice = {
  id: string;
  userId: string;
  deviceName: string;
  platform: string;
  agentVersion: string;
  status: "active" | "revoked";
  lastSeenAt: Date;
  createdAt: Date;
};

type AgentScan = {
  id: string;
  deviceId: string;
  caseId: string;
  status: string;
  autoUpload: boolean;
  totalFiles: string;
  uploadedFiles: string;
  failedFiles: string;
  totalSizeBytes: string;
  uploadedSizeBytes: string;
  startedAt: Date;
  completedAt: Date | null;
  errorMessage?: string | null;
};

type AgentFile = {
  id: string;
  scanId: string;
  fileName: string;
  filePath: string;
  fileSize: string;
  mimeType: string | null;
  uploadStatus: string;
  uploadProgress: string;
  s3Key: string | null;
  s3Url: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: Date;
};

const devices = new Map<string, AgentDevice>();
const scans = new Map<string, AgentScan>();
const files = new Map<string, AgentFile>();

export async function registerAgentDevice(
  userId: string,
  deviceName: string,
  platform: string,
  agentVersion: string
): Promise<{ deviceId: string; token: string }> {
  const deviceId = nanoid();
  const now = new Date();
  devices.set(deviceId, {
    id: deviceId,
    userId,
    deviceName,
    platform,
    agentVersion,
    status: "active",
    lastSeenAt: now,
    createdAt: now,
  });

  const token = await new SignJWT({ userId, deviceId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("365d")
    .sign(SECRET);

  return { deviceId, token };
}

export async function verifyAgentToken(
  token: string
): Promise<{ userId: string; deviceId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const userId = String(payload.userId || "");
    const deviceId = String(payload.deviceId || "");
    if (!userId || !deviceId) return null;
    return { userId, deviceId };
  } catch {
    return null;
  }
}

export async function getAgentDevice(deviceId: string): Promise<AgentDevice | null> {
  return devices.get(deviceId) ?? null;
}

export async function listUserAgentDevices(userId: string): Promise<AgentDevice[]> {
  return [...devices.values()].filter((d) => d.userId === userId);
}

export async function updateDeviceLastSeen(deviceId: string): Promise<void> {
  const d = devices.get(deviceId);
  if (d) d.lastSeenAt = new Date();
}

export async function revokeAgentDevice(deviceId: string): Promise<void> {
  const d = devices.get(deviceId);
  if (d) d.status = "revoked";
}

export async function createAgentScan(
  deviceId: string,
  caseId: string,
  autoUpload: boolean,
  _excludedFolders?: string[]
): Promise<string> {
  const id = nanoid();
  const now = new Date();
  scans.set(id, {
    id,
    deviceId,
    caseId,
    status: "running",
    autoUpload,
    totalFiles: "0",
    uploadedFiles: "0",
    failedFiles: "0",
    totalSizeBytes: "0",
    uploadedSizeBytes: "0",
    startedAt: now,
    completedAt: null,
  });
  return id;
}

export async function getAgentScan(scanId: string): Promise<AgentScan | null> {
  return scans.get(scanId) ?? null;
}

export async function updateScanProgress(
  scanId: string,
  totalFiles: number,
  uploadedFiles: number,
  failedFiles: number,
  totalSizeBytes?: number,
  uploadedSizeBytes?: number
): Promise<void> {
  const s = scans.get(scanId);
  if (!s) return;
  s.totalFiles = String(totalFiles);
  s.uploadedFiles = String(uploadedFiles);
  s.failedFiles = String(failedFiles);
  if (totalSizeBytes !== undefined) s.totalSizeBytes = String(totalSizeBytes);
  if (uploadedSizeBytes !== undefined) s.uploadedSizeBytes = String(uploadedSizeBytes);
}

export async function updateScanStatus(
  scanId: string,
  status: "completed" | "failed" | "cancelled",
  errorMessage?: string
): Promise<void> {
  const s = scans.get(scanId);
  if (!s) return;
  s.status = status;
  s.completedAt = new Date();
  s.errorMessage = errorMessage ?? null;
}

export async function addAgentFile(
  scanId: string,
  filePath: string,
  fileName: string,
  fileSize: number,
  mimeType?: string,
  _fileModifiedAt?: Date
): Promise<string> {
  const id = nanoid();
  files.set(id, {
    id,
    scanId,
    filePath,
    fileName,
    fileSize: String(fileSize),
    mimeType: mimeType ?? null,
    uploadStatus: "pending",
    uploadProgress: "0",
    s3Key: null,
    s3Url: null,
    errorMessage: null,
    retryCount: 0,
    createdAt: new Date(),
  });
  return id;
}

export async function updateFileUploadStatus(
  fileId: string,
  status: string,
  progress?: number,
  s3Key?: string,
  s3Url?: string,
  errorMessage?: string
): Promise<void> {
  const f = files.get(fileId);
  if (!f) return;
  f.uploadStatus = status;
  if (progress !== undefined) f.uploadProgress = String(progress);
  if (s3Key !== undefined) f.s3Key = s3Key;
  if (s3Url !== undefined) f.s3Url = s3Url;
  if (errorMessage !== undefined) f.errorMessage = errorMessage;
}

export async function incrementFileRetryCount(fileId: string): Promise<number> {
  const f = files.get(fileId);
  if (!f) return 0;
  f.retryCount += 1;
  return f.retryCount;
}

export async function getScanFiles(scanId: string): Promise<AgentFile[]> {
  return [...files.values()].filter((f) => f.scanId === scanId);
}

export async function getPendingUploadFiles(_scanId: string): Promise<AgentFile[]> {
  return [...files.values()].filter((f) => f.uploadStatus === "pending");
}

export async function listCaseScans(caseId: string): Promise<AgentScan[]> {
  return [...scans.values()].filter((s) => s.caseId === caseId);
}

export async function listDeviceScans(deviceId: string): Promise<AgentScan[]> {
  return [...scans.values()].filter((s) => s.deviceId === deviceId);
}
