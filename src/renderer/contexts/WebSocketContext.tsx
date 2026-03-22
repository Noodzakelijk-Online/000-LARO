import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
});

export function useWebSocket() {
  return useContext(WebSocketContext);
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Connect to WebSocket server
    const socketInstance = io(window.location.origin, {
      transports: ["websocket", "polling"],
    });

    socketInstance.on("connect", () => {
      console.log("[WebSocket] Connected");
      setIsConnected(true);
      
      // Join user-specific room
      socketInstance.emit("join", user.id);
    });

    socketInstance.on("disconnect", () => {
      console.log("[WebSocket] Disconnected");
      setIsConnected(false);
    });

    // Listen for real-time events
    socketInstance.on("new_message", (message) => {
      console.log("[WebSocket] New message received:", message);
      toast.info("New message received", {
        description: message.subject || "You have a new message",
      });
      
      // Trigger refetch of messages (handled by components with useQueryClient)
    });

    socketInstance.on("case_update", (caseUpdate) => {
      console.log("[WebSocket] Case update received:", caseUpdate);
      if (caseUpdate.type === 'status_changed') {
        toast.success("Case Status Updated", {
          description: `Status changed from ${caseUpdate.oldStatus} to ${caseUpdate.newStatus}`,
        });
      } else {
        toast.info("Case Updated", {
          description: `Case ${caseUpdate.caseId} has been updated`,
        });
      }
    });

    socketInstance.on("evidence_update", (evidenceUpdate) => {
      console.log("[WebSocket] Evidence update received:", evidenceUpdate);
      toast.success("New evidence added", {
        description: `Evidence added to case ${evidenceUpdate.caseId}`,
      });
    });

    socketInstance.on("notification", (notification) => {
      console.log("[WebSocket] Notification received:", notification);
      toast(notification.title, {
        description: notification.message,
      });
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user]);

  return (
    <WebSocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
}

