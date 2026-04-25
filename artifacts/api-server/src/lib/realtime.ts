import type { Server as IOServer } from "socket.io";
import type { Message } from "@workspace/db";
import { snapshot } from "./presence";

let ioRef: IOServer | null = null;

export function setIO(io: IOServer): void {
  ioRef = io;
}

export function getIO(): IOServer | null {
  return ioRef;
}

export function broadcastNewMessage(message: Message): void {
  ioRef?.emit("message:new", {
    id: message.id,
    userId: message.userId,
    username: message.username,
    avatarUrl: message.avatarUrl,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  });
}

export function broadcastPresence(): void {
  if (!ioRef) return;
  ioRef.emit("presence:update", snapshot());
}
