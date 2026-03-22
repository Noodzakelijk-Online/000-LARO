import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import type { Socket } from "socket.io";

let io: SocketIOServer | null = null;

export function initializeWebSocket(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.VITE_FRONTEND_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Join user-specific room for targeted notifications
    socket.on("join", (userId: string) => {
      socket.join(`user:${userId}`);
      console.log(`[WebSocket] User ${userId} joined their room`);
    });

    socket.on("disconnect", () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

// Event emitters for real-time updates
export function emitNewMessage(userId: string, message: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit("new_message", message);
  console.log(`[WebSocket] Emitted new_message to user ${userId}`);
}

export function emitCaseUpdate(userId: string, caseUpdate: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit("case_update", caseUpdate);
  console.log(`[WebSocket] Emitted case_update to user ${userId}`);
}

export function emitEvidenceUpdate(userId: string, evidenceUpdate: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit("evidence_update", evidenceUpdate);
  console.log(`[WebSocket] Emitted evidence_update to user ${userId}`);
}

export function emitNotification(userId: string, notification: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit("notification", notification);
  console.log(`[WebSocket] Emitted notification to user ${userId}`);
}

