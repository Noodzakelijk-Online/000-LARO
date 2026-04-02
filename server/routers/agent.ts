// @ts-nocheck

import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import {
  registerAgentDevice,
  verifyAgentToken,
  getAgentDevice,
  listUserAgentDevices,
  updateDeviceLastSeen,
  revokeAgentDevice,
  createAgentScan,
  getAgentScan,
  updateScanProgress,
  updateScanStatus,
  addAgentFile,
  updateFileUploadStatus,
  incrementFileRetryCount,
  getScanFiles,
  getPendingUploadFiles,
  listCaseScans,
  listDeviceScans,
} from '../agentService';
import { storagePut } from '../storage';
import { nanoid } from 'nanoid';

/**
 * Agent Router
 * API endpoints for evidence collection agent
 */

export const agentRouter = router({
  /**
   * Register a new agent device
   */
  register: protectedProcedure
    .input(
      z.object({
        deviceName: z.string().min(1).max(255),
        platform: z.enum(['windows', 'macos', 'linux']),
        agentVersion: z.string().min(1).max(20),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { deviceId, token } = await registerAgentDevice(
        ctx.user.id,
        input.deviceName,
        input.platform,
        input.agentVersion
      );

      return {
        deviceId,
        token,
        message: 'Device registered successfully',
      };
    }),

  /**
   * Authenticate agent with token
   */
  authenticate: publicProcedure
    .input(
      z.object({
        token: z.string(),
      })
    )
    .query(async ({ input }) => {
      const payload = await verifyAgentToken(input.token);

      if (!payload) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        });
      }

      const device = await getAgentDevice(payload.deviceId);

      if (!device) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Device not found',
        });
      }

      if (device.status === 'revoked') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Device access has been revoked',
        });
      }

      // Update last seen
      await updateDeviceLastSeen(payload.deviceId);

      return {
        valid: true,
        userId: payload.userId,
        deviceId: payload.deviceId,
        deviceName: device.deviceName,
        platform: device.platform,
      };
    }),

  /**
   * List user's agent devices
   */
  listDevices: protectedProcedure.query(async ({ ctx }) => {
    const devices = await listUserAgentDevices(ctx.user.id);

    return {
      devices: devices.map((device) => ({
        id: device.id,
        deviceName: device.deviceName,
        platform: device.platform,
        agentVersion: device.agentVersion,
        status: device.status,
        lastSeenAt: device.lastSeenAt,
        createdAt: device.createdAt,
      })),
    };
  }),

  /**
   * Revoke device access
   */
  revokeDevice: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify device belongs to user
      const device = await getAgentDevice(input.deviceId);

      if (!device) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Device not found',
        });
      }

      if (device.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to revoke this device',
        });
      }

      await revokeAgentDevice(input.deviceId);

      return {
        success: true,
        message: 'Device access revoked',
      };
    }),

  /**
   * Start a new scan session
   */
  startScan: publicProcedure
    .input(
      z.object({
        token: z.string(),
        caseId: z.string(),
        autoUpload: z.boolean(),
        excludedFolders: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Authenticate agent
      const payload = await verifyAgentToken(input.token);

      if (!payload) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        });
      }

      const device = await getAgentDevice(payload.deviceId as string);

      if (!device || device.status === 'revoked') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Device access denied',
        });
      }

      // Update last seen
      await updateDeviceLastSeen(payload.deviceId);

      // Create scan
      const scanId = await createAgentScan(
        payload.deviceId,
        input.caseId,
        input.autoUpload,
        input.excludedFolders
      );

      return {
        scanId,
        message: 'Scan started successfully',
      };
    }),

  /**
   * Get scan status
   */
  getScanStatus: publicProcedure
    .input(
      z.object({
        token: z.string(),
        scanId: z.string(),
      })
    )
    .query(async ({ input }) => {
      // Authenticate agent
      const payload = verifyAgentToken(input.token);

      if (!payload) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        });
      }

      const scan = await getAgentScan(input.scanId);

      if (!scan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Scan not found',
        });
      }

      // Verify scan belongs to this device
      const device = await getAgentDevice(scan.deviceId);
      if (!device || device.id !== payload.deviceId as string) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      return {
        scanId: scan.id,
        caseId: scan.caseId,
        status: scan.status,
        autoUpload: scan.autoUpload,
        totalFiles: parseInt(scan.totalFiles, 10),
        uploadedFiles: parseInt(scan.uploadedFiles, 10),
        failedFiles: parseInt(scan.failedFiles, 10),
        totalSizeBytes: parseInt(scan.totalSizeBytes, 10),
        uploadedSizeBytes: parseInt(scan.uploadedSizeBytes, 10),
        startedAt: scan.startedAt,
        completedAt: scan.completedAt,
      };
    }),

  /**
   * Update scan progress
   */
  updateProgress: publicProcedure
    .input(
      z.object({
        token: z.string(),
        scanId: z.string(),
        totalFiles: z.number(),
        uploadedFiles: z.number(),
        failedFiles: z.number(),
        totalSizeBytes: z.number().optional(),
        uploadedSizeBytes: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Authenticate agent
      const payload = verifyAgentToken(input.token);

      if (!payload) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        });
      }

      await updateScanProgress(
        input.scanId,
        input.totalFiles,
        input.uploadedFiles,
        input.failedFiles,
        input.totalSizeBytes,
        input.uploadedSizeBytes
      );

      return {
        success: true,
      };
    }),

  /**
   * Complete scan
   */
  completeScan: publicProcedure
    .input(
      z.object({
        token: z.string(),
        scanId: z.string(),
        status: z.enum(['completed', 'failed', 'cancelled']),
        errorMessage: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Authenticate agent
      const payload = verifyAgentToken(input.token);

      if (!payload) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        });
      }

      await updateScanStatus(input.scanId, input.status, input.errorMessage);

      return {
        success: true,
        message: `Scan ${input.status}`,
      };
    }),

  /**
   * Add file to scan
   */
  addFile: publicProcedure
    .input(
      z.object({
        token: z.string(),
        scanId: z.string(),
        filePath: z.string(),
        fileName: z.string(),
        fileSize: z.number(),
        mimeType: z.string().optional(),
        fileModifiedAt: z.date().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Authenticate agent
      const payload = verifyAgentToken(input.token);

      if (!payload) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        });
      }

      const fileId = await addAgentFile(
        input.scanId,
        input.filePath,
        input.fileName,
        input.fileSize,
        input.mimeType,
        input.fileModifiedAt
      );

      return {
        fileId,
      };
    }),

  /**
   * Request presigned upload URL for file
   */
  requestUploadUrl: publicProcedure
    .input(
      z.object({
        token: z.string(),
        fileId: z.string(),
        fileName: z.string(),
        mimeType: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Authenticate agent
      const payload = verifyAgentToken(input.token);

      if (!payload) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        });
      }

      // Generate S3 key
      const timestamp = Date.now();
      const randomId = nanoid(8);
      const s3Key = `evidence/agent/${payload.userId as string}/${timestamp}-${randomId}-${input.fileName}`;

      // For now, we'll return a direct upload instruction
      // The agent will upload the file and then call confirmUpload
      return {
        fileId: input.fileId,
        s3Key,
        uploadMethod: 'direct', // Agent will use storagePut equivalent
      };
    }),

  /**
   * Confirm file upload completion
   */
  confirmUpload: publicProcedure
    .input(
      z.object({
        token: z.string(),
        fileId: z.string(),
        s3Key: z.string(),
        s3Url: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Authenticate agent
      const payload = verifyAgentToken(input.token);

      if (!payload) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        });
      }

      await updateFileUploadStatus(
        input.fileId,
        'completed',
        100,
        input.s3Key,
        input.s3Url
      );

      return {
        success: true,
      };
    }),

  /**
   * Report file upload failure
   */
  reportUploadFailure: publicProcedure
    .input(
      z.object({
        token: z.string(),
        fileId: z.string(),
        errorMessage: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Authenticate agent
      const payload = verifyAgentToken(input.token);

      if (!payload) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        });
      }

      const retryCount = await incrementFileRetryCount(input.fileId);

      // Mark as failed if retry count exceeds 3
      if (retryCount >= 3) {
        await updateFileUploadStatus(
          input.fileId,
          'failed',
          undefined,
          undefined,
          undefined,
          input.errorMessage
        );
      }

      return {
        success: true,
        retryCount,
        shouldRetry: retryCount < 3,
      };
    }),

  /**
   * Get scan files (for review mode)
   */
  getScanFiles: protectedProcedure
    .input(
      z.object({
        scanId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const files = await getScanFiles(input.scanId);

      return {
        files: files.map((file) => ({
          id: file.id,
          fileName: file.fileName,
          fileSize: parseInt(file.fileSize, 10),
          mimeType: file.mimeType,
          uploadStatus: file.uploadStatus,
          uploadProgress: parseInt(file.uploadProgress, 10),
          s3Url: file.s3Url,
          errorMessage: file.errorMessage,
          createdAt: file.createdAt,
        })),
      };
    }),

  /**
   * List scans for a case
   */
  listCaseScans: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const scans = await listCaseScans(input.caseId);

      return {
        scans: scans.map((scan) => ({
          id: scan.id,
          deviceId: scan.deviceId,
          status: scan.status,
          autoUpload: scan.autoUpload,
          totalFiles: parseInt(scan.totalFiles, 10),
          uploadedFiles: parseInt(scan.uploadedFiles, 10),
          failedFiles: parseInt(scan.failedFiles, 10),
          startedAt: scan.startedAt,
          completedAt: scan.completedAt,
        })),
      };
    }),
});
