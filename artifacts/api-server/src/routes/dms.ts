import { Router, type IRouter } from "express";
import {
  db,
  directMessagesTable,
  conversationKeyFor,
  type DirectMessage,
} from "@workspace/db";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import {
  ListConversationsResponse,
  GetUnreadDmCountResponse,
  ListDirectMessagesResponse,
  ListDirectMessagesResponseItem,
  SendDirectMessageBody,
  MarkConversationReadResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { getUserSummary } from "../lib/clerkUser";
import { broadcastDirectMessage, broadcastDmRead } from "../lib/realtime";

const router: IRouter = Router();

function serialize(row: DirectMessage) {
  return {
    id: row.id,
    senderId: row.senderId,
    recipientId: row.recipientId,
    senderUsername: row.senderUsername,
    senderAvatarUrl: row.senderAvatarUrl,
    body: row.body,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/dms", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;

  const lastMsgs = await db.execute<{
    id: number;
    conversation_key: string;
    sender_id: string;
    recipient_id: string;
    sender_username: string;
    sender_avatar_url: string | null;
    body: string;
    read_at: Date | null;
    created_at: Date;
    unread_count: number;
  }>(sql`
    SELECT DISTINCT ON (conversation_key)
      id, conversation_key, sender_id, recipient_id,
      sender_username, sender_avatar_url, body, read_at, created_at,
      (
        SELECT COUNT(*)::int FROM direct_messages dm2
        WHERE dm2.conversation_key = direct_messages.conversation_key
          AND dm2.recipient_id = ${me}
          AND dm2.read_at IS NULL
      ) AS unread_count
    FROM direct_messages
    WHERE sender_id = ${me} OR recipient_id = ${me}
    ORDER BY conversation_key, created_at DESC
  `);

  const rows = lastMsgs.rows;
  rows.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

  const partnerIds = Array.from(
    new Set(
      rows.map((r) => (r.sender_id === me ? r.recipient_id : r.sender_id)),
    ),
  );

  const partners = await Promise.all(
    partnerIds.map(async (id) => {
      try {
        const summary = await getUserSummary(id);
        return {
          userId: id,
          username: summary.username,
          avatarUrl: summary.avatarUrl,
        };
      } catch {
        return {
          userId: id,
          username: `Member ${id.slice(-4)}`,
          avatarUrl: null as string | null,
        };
      }
    }),
  );
  const partnerMap = new Map(partners.map((p) => [p.userId, p]));

  const conversations = rows.map((r) => {
    const partnerId = r.sender_id === me ? r.recipient_id : r.sender_id;
    const partner = partnerMap.get(partnerId)!;
    return {
      partner,
      lastMessage: {
        id: r.id,
        senderId: r.sender_id,
        recipientId: r.recipient_id,
        senderUsername: r.sender_username,
        senderAvatarUrl: r.sender_avatar_url,
        body: r.body,
        readAt: r.read_at ? r.read_at.toISOString() : null,
        createdAt: r.created_at.toISOString(),
      },
      unreadCount: r.unread_count,
    };
  });

  res.json(ListConversationsResponse.parse(conversations));
});

router.get("/dms/unread", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;
  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(directMessagesTable)
    .where(
      and(
        eq(directMessagesTable.recipientId, me),
        isNull(directMessagesTable.readAt),
      ),
    );
  res.json(GetUnreadDmCountResponse.parse({ total: row?.count ?? 0 }));
});

router.get("/dms/:userId", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;
  const otherId = String(req.params["userId"] ?? "");
  if (!otherId || otherId === me) {
    res.status(400).json({ error: "Invalid recipient" });
    return;
  }

  const key = conversationKeyFor(me, otherId);
  const rows = await db
    .select()
    .from(directMessagesTable)
    .where(eq(directMessagesTable.conversationKey, key))
    .orderBy(directMessagesTable.createdAt)
    .limit(200);

  res.json(ListDirectMessagesResponse.parse(rows.map(serialize)));
});

router.post("/dms/:userId", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;
  const otherId = String(req.params["userId"] ?? "");
  if (!otherId || otherId === me) {
    res.status(400).json({ error: "Invalid recipient" });
    return;
  }

  const parsed = SendDirectMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const trimmed = parsed.data.body.trim();
  if (!trimmed) {
    res.status(400).json({ error: "Message cannot be empty" });
    return;
  }

  let summary;
  try {
    summary = await getUserSummary(me);
  } catch {
    res.status(404).json({ error: "Sender not found" });
    return;
  }

  try {
    await getUserSummary(otherId);
  } catch {
    res.status(404).json({ error: "Recipient not found" });
    return;
  }

  const [row] = await db
    .insert(directMessagesTable)
    .values({
      conversationKey: conversationKeyFor(me, otherId),
      senderId: me,
      recipientId: otherId,
      senderUsername: summary.username,
      senderAvatarUrl: summary.avatarUrl,
      body: trimmed,
    })
    .returning();

  if (!row) {
    res.status(500).json({ error: "Failed to create message" });
    return;
  }

  broadcastDirectMessage(row);
  res.status(201).json(ListDirectMessagesResponseItem.parse(serialize(row)));
});

router.post(
  "/dms/:userId/read",
  requireAuth,
  async (req, res): Promise<void> => {
    const me = req.userId!;
    const otherId = String(req.params["userId"] ?? "");
    if (!otherId || otherId === me) {
      res.status(400).json({ error: "Invalid recipient" });
      return;
    }

    const key = conversationKeyFor(me, otherId);
    const now = new Date();
    const updated = await db
      .update(directMessagesTable)
      .set({ readAt: now })
      .where(
        and(
          eq(directMessagesTable.conversationKey, key),
          eq(directMessagesTable.recipientId, me),
          isNull(directMessagesTable.readAt),
        ),
      )
      .returning({ id: directMessagesTable.id });

    if (updated.length > 0) {
      broadcastDmRead({ readerId: me, partnerId: otherId, readAt: now });
    }

    res.json(MarkConversationReadResponse.parse({ marked: updated.length }));
  },
);

export default router;

// Quiet unused-import lint complaints
void or;
void desc;
