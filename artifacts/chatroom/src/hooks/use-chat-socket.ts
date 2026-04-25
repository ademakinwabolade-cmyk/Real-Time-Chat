import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { 
  getListMessagesQueryKey, 
  getGetChatStatsQueryKey, 
  getGetPresenceQueryKey 
} from "@workspace/api-client-react";
import type { Message, PresenceSnapshot } from "@workspace/api-zod/src/generated/types";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function useChatSocket() {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Create socket connection
    const socket = io({ 
      path: `${basePath}/socket.io`, 
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to chat socket");
    });

    socket.on("message:new", (newMessage: Message) => {
      // Optimistically append message to list
      queryClient.setQueryData(getListMessagesQueryKey(), (oldData: Message[] | undefined) => {
        if (!oldData) return [newMessage];
        // Dedupe
        if (oldData.some(m => m.id === newMessage.id)) return oldData;
        return [...oldData, newMessage].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });

      // Invalidate to refresh stats
      queryClient.invalidateQueries({ queryKey: getGetChatStatsQueryKey() });
    });

    socket.on("presence:update", (presence: PresenceSnapshot) => {
      // Update presence panel
      queryClient.setQueryData(getGetPresenceQueryKey(), presence);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [queryClient]);

  return socketRef;
}