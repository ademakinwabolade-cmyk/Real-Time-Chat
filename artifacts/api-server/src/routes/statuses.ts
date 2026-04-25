import { Router, type IRouter } from "express";
import { db, statusesTable, type Status } from "@workspace/db";
import { desc, gt, sql } from "drizzle-orm";
import {
  ListStatusesResponse,
  ListStatusesResponseItem,
  CreateStatusBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { getUserSummary } from "../lib/clerkUser";

const router: IRouter = Router();

const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

function serialize(row: Status) {
  return {
    id: row.id,
    userId: row.userId,
    username: row.username,
    avatarUrl: row.avatarUrl,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

router.get("/statuses", requireAuth, async (_req, res): Promise<void> => {
  const now = new Date();
  const rows = await db
    .select()
    .from(statusesTable)
    .where(gt(statusesTable.expiresAt, now))
    .orderBy(desc(statusesTable.createdAt))
    .limit(100);

  res.json(ListStatusesResponse.parse(rows.map(serialize)));
});

router.post("/statuses", requireAuth, async (req, res): Promise<void> => {
  const me = req.userId!;
  const parsed = CreateStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data.body.trim();
  if (!body) {
    res.status(400).json({ error: "Status cannot be empty" });
    return;
  }

  let summary;
  try {
    summary = await getUserSummary(me);
  } catch {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const now = new Date();
  const expires = new Date(now.getTime() + STATUS_TTL_MS);

  const [row] = await db
    .insert(statusesTable)
    .values({
      userId: me,
      username: summary.username,
      avatarUrl: summary.avatarUrl,
      body,
      createdAt: now,
      expiresAt: expires,
    })
    .returning();

  if (!row) {
    res.status(500).json({ error: "Failed to create status" });
    return;
  }

  res.status(201).json(ListStatusesResponseItem.parse(serialize(row)));
});

export default router;

void sql;
