import { createServer } from "node:http";
import { Server as IOServer } from "socket.io";
import { clerkMiddleware, getAuth } from "@clerk/express";
import app from "./app";
import { logger } from "./lib/logger";
import { setIO, broadcastPresence, userRoom } from "./lib/realtime";
import {
  addConnection,
  removeConnection,
  type PresenceMember,
} from "./lib/presence";
import { getUserSummary } from "./lib/clerkUser";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);

const io = new IOServer(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
});

setIO(io);

io.engine.use(clerkMiddleware());

io.use(async (socket, next) => {
  try {
    const req = socket.request as Parameters<typeof getAuth>[0];
    const auth = getAuth(req);
    const userId = auth?.userId;
    if (!userId) {
      next(new Error("Unauthorized"));
      return;
    }
    const summary = await getUserSummary(userId);
    const member: PresenceMember = {
      userId,
      username: summary.username,
      avatarUrl: summary.avatarUrl,
    };
    (socket.data as { member?: PresenceMember }).member = member;
    next();
  } catch (err) {
    logger.error({ err }, "Socket auth failed");
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  const member = (socket.data as { member?: PresenceMember }).member;
  if (!member) {
    socket.disconnect(true);
    return;
  }

  socket.join(userRoom(member.userId));

  const { changed } = addConnection(member);
  if (changed) broadcastPresence();
  logger.info({ userId: member.userId }, "Socket connected");

  socket.on("disconnect", () => {
    const removed = removeConnection(member.userId);
    if (removed.changed) broadcastPresence();
    logger.info({ userId: member.userId }, "Socket disconnected");
  });
});

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
});
