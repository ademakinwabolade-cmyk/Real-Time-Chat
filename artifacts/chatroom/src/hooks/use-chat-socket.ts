import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import {
  getListMessagesQueryKey,
  getGetChatStatsQueryKey,
  getGetPresenceQueryKey,
  getListConversationsQueryKey,
  getGetUnreadDmCountQueryKey,
  getListDirectMessagesQueryKey,
} from "@workspace/api-client-react";
import type {
  Message,
  PresenceSnapshot,
  DirectMessage,
} from "@workspace/api-client-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface DmReadEvent {
  readerId: string;
  partnerId: string;
  readAt: string;
}

export function useChatSocket() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const socketRef = useRef<Socket | null>(null);
  const myId = user?.id;

  useEffect(() => {
    const socket = io({
      path: `${basePath}/socket.io`,
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("message:new", (newMessage: Message) => {
      queryClient.setQueryData(
        getListMessagesQueryKey(),
        (oldData: Message[] | undefined) => {
          if (!oldData) return [newMessage];
          if (oldData.some((m) => m.id === newMessage.id)) return oldData;
          return [...oldData, newMessage].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
        },
      );
      queryClient.invalidateQueries({ queryKey: getGetChatStatsQueryKey() });
    });

    socket.on("presence:update", (presence: PresenceSnapshot) => {
      queryClient.setQueryData(getGetPresenceQueryKey(), presence);
    });

    socket.on("dm:new", (dm: DirectMessage) => {
      if (!myId) return;
      const partnerId = dm.senderId === myId ? dm.recipientId : dm.senderId;

      queryClient.setQueryData(
        getListDirectMessagesQueryKey(partnerId),
        (oldData: DirectMessage[] | undefined) => {
          if (!oldData) return [dm];
          if (oldData.some((m) => m.id === dm.id)) return oldData;
          return [...oldData, dm].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
        },
      );

      queryClient.invalidateQueries({
        queryKey: getListConversationsQueryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: getGetUnreadDmCountQueryKey(),
      });
    });

    socket.on("dm:read", (event: DmReadEvent) => {
      if (!myId) return;
      const otherId =
        event.readerId === myId ? event.partnerId : event.readerId;

      queryClient.setQueryData(
        getListDirectMessagesQueryKey(otherId),
        (oldData: DirectMessage[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.map((m) =>
            m.recipientId === event.readerId && !m.readAt
              ? { ...m, readAt: event.readAt }
              : m,
          );
        },
      );
      queryClient.invalidateQueries({
        queryKey: getListConversationsQueryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: getGetUnreadDmCountQueryKey(),
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [queryClient, myId]);

  return socketRef;
}
