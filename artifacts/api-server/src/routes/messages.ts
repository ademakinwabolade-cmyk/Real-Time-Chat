import { Router, type IRouter } from "express";
import { db, messagesTable } from "@workspace/db";
import { desc, sql, gte } from "drizzle-orm";
import {
  ListMessagesQueryParams,
  CreateMessageBody,
  ListMessagesResponse,
  ListMessagesResponseItem,
  GetChatStatsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { getUserSummary } from "../lib/clerkUser";
import { broadcastNewMessage } from "../lib/realtime";

const router: IRouter = Router();

router.get("/messages", requireAuth, async (req, res): Promise<void> => {
  const params = ListMessagesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const limit = params.data.limit ?? 100;

  const rows = await db
    .select()
    .from(messagesTable)
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit);

  const ordered = rows.slice().reverse();
  res.json(ListMessagesResponse.parse(ordered));
});

router.post("/messages", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.userId!;
  const summary = await getUserSummary(userId);

  const trimmed = parsed.data.body.trim();
  if (!trimmed) {
    res.status(400).json({ error: "Message cannot be empty" });
    return;
  }

  const [row] = await db
    .insert(messagesTable)
    .values({
      userId,
      username: summary.username,
      avatarUrl: summary.avatarUrl,
      body: trimmed,
    })
    .returning();

  if (!row) {
    res.status(500).json({ error: "Failed to create message" });
    return;
  }

  const payload = ListMessagesResponseItem.parse(row);
  broadcastNewMessage(row);
  res.status(201).json(payload);
});

router.get("/messages/stats", requireAuth, async (_req, res): Promise<void> => {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [totalRow] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(messagesTable);

  const [todayRow] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(messagesTable)
    .where(gte(messagesTable.createdAt, startOfToday));

  const [activeMembersRow] = await db
    .select({
      count: sql<number>`cast(count(distinct ${messagesTable.userId}) as integer)`,
    })
    .from(messagesTable)
    .where(gte(messagesTable.createdAt, startOfToday));

  const topRows = await db
    .select({
      userId: messagesTable.userId,
      username: messagesTable.username,
      avatarUrl: messagesTable.avatarUrl,
      messageCount: sql<number>`cast(count(*) as integer)`,
    })
    .from(messagesTable)
    .where(gte(messagesTable.createdAt, startOfToday))
    .groupBy(
      messagesTable.userId,
      messagesTable.username,
      messagesTable.avatarUrl,
    )
    .orderBy(sql`count(*) desc`)
    .limit(5);

  const data = GetChatStatsResponse.parse({
    totalMessages: totalRow?.count ?? 0,
    messagesToday: todayRow?.count ?? 0,
    activeMembersToday: activeMembersRow?.count ?? 0,
    topContributors: topRows,
  });

  res.json(data);
});

export default router;
