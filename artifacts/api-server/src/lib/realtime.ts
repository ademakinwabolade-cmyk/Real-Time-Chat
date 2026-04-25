import type { Server as IOServer } from "socket.io";
import type { Message, DirectMessage } from "@workspace/db";
import { snapshot } from "./presence";

let ioRef: IOServer | null = null;

export function setIO(io: IOServer): void {
  ioRef = io;
}

export function getIO(): IOServer | null {
  return ioRef;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
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

export function broadcastDirectMessage(message: DirectMessage): void {
  if (!ioRef) return;
  const payload = {
    id: message.id,
    senderId: message.senderId,
    recipientId: message.recipientId,
    senderUsername: message.senderUsername,
    senderAvatarUrl: message.senderAvatarUrl,
    body: message.body,
    readAt: message.readAt ? message.readAt.toISOString() : null,
    createdAt: message.createdAt.toISOString(),
  };
  ioRef
    .to(userRoom(message.senderId))
    .to(userRoom(message.recipientId))
    .emit("dm:new", payload);
}

export function broadcastDmRead(params: {
  readerId: string;
  partnerId: string;
  readAt: Date;
}): void {
  if (!ioRef) return;
  const payload = {
    readerId: params.readerId,
    partnerId: params.partnerId,
    readAt: params.readAt.toISOString(),
  };
  ioRef
    .to(userRoom(params.readerId))
    .to(userRoom(params.partnerId))
    .emit("dm:read", payload);
}
