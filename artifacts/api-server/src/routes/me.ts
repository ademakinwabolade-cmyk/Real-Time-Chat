import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { db, usersTable, loginEventsTable, type AppUser } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { GetMeResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function buildUsername(user: {
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  emailAddresses?: { emailAddress: string }[];
  id: string;
}): string {
  if (user.username) return user.username;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  const email = user.emailAddresses?.[0]?.emailAddress;
  if (email) return email.split("@")[0]!;
  return `Member ${user.id.slice(-4)}`;
}

function serialize(row: AppUser) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    avatarUrl: row.avatarUrl,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    lastLogoutAt: row.lastLogoutAt ? row.lastLogoutAt.toISOString() : null,
    loginCount: row.loginCount,
  };
}

async function fetchClerkSnapshot(userId: string) {
  const user = await clerkClient.users.getUser(userId);
  return {
    username: buildUsername({
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      emailAddresses: user.emailAddresses?.map((e) => ({
        emailAddress: e.emailAddress,
      })),
      id: user.id,
    }),
    email: user.emailAddresses?.[0]?.emailAddress ?? null,
    avatarUrl: user.imageUrl ?? null,
  };
}

router.post("/me/login", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const snapshot = await fetchClerkSnapshot(userId);
  const now = new Date();
  const userAgent = req.get("user-agent") ?? null;
  const ipAddress = req.ip ?? null;

  const [row] = await db
    .insert(usersTable)
    .values({
      id: userId,
      username: snapshot.username,
      email: snapshot.email,
      avatarUrl: snapshot.avatarUrl,
      firstSeenAt: now,
      lastSeenAt: now,
      lastLoginAt: now,
      loginCount: 1,
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        username: snapshot.username,
        email: snapshot.email,
        avatarUrl: snapshot.avatarUrl,
        lastSeenAt: now,
        lastLoginAt: now,
        loginCount: sql`${usersTable.loginCount} + 1`,
      },
    })
    .returning();

  await db.insert(loginEventsTable).values({
    userId,
    eventType: "login",
    occurredAt: now,
    userAgent,
    ipAddress,
  });

  res.json(GetMeResponse.parse(serialize(row!)));
});

router.post("/me/logout", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const now = new Date();
  const userAgent = req.get("user-agent") ?? null;
  const ipAddress = req.ip ?? null;

  const [row] = await db
    .update(usersTable)
    .set({ lastSeenAt: now, lastLogoutAt: now })
    .where(eq(usersTable.id, userId))
    .returning();

  if (row) {
    await db.insert(loginEventsTable).values({
      userId,
      eventType: "logout",
      occurredAt: now,
      userAgent,
      ipAddress,
    });
    res.json(GetMeResponse.parse(serialize(row)));
    return;
  }

  const snapshot = await fetchClerkSnapshot(userId);
  const [created] = await db
    .insert(usersTable)
    .values({
      id: userId,
      username: snapshot.username,
      email: snapshot.email,
      avatarUrl: snapshot.avatarUrl,
      firstSeenAt: now,
      lastSeenAt: now,
      lastLogoutAt: now,
    })
    .returning();
  res.json(GetMeResponse.parse(serialize(created!)));
});

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Profile not yet recorded" });
    return;
  }
  res.json(GetMeResponse.parse(serialize(rows[0]!)));
});

export default router;
