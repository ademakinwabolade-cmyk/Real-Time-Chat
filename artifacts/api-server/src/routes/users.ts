import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import {
  ListUsersResponse,
  GetUserProfileResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { getUserSummary } from "../lib/clerkUser";

const router: IRouter = Router();

interface ClerkUserLike {
  id: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string;
  emailAddresses?: { emailAddress: string }[];
}

function profileFor(user: ClerkUserLike): {
  userId: string;
  username: string;
  avatarUrl: string | null;
} {
  const display =
    user.username ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
    `Member ${user.id.slice(-4)}`;
  return {
    userId: user.id,
    username: display,
    avatarUrl: user.imageUrl ?? null,
  };
}

router.get("/users", requireAuth, async (req, res): Promise<void> => {
  const search =
    typeof req.query["search"] === "string" ? req.query["search"] : undefined;
  const limitRaw = req.query["limit"];
  const limit =
    typeof limitRaw === "string" ? Math.min(100, Math.max(1, Number(limitRaw))) : 50;

  const me = req.userId!;

  const params: { limit: number; query?: string } = { limit: limit + 1 };
  if (search && search.trim().length > 0) {
    params.query = search.trim();
  }

  const result = await clerkClient.users.getUserList(params);
  const list = (result?.data ?? []) as ClerkUserLike[];
  const profiles = list
    .filter((u) => u.id !== me)
    .slice(0, limit)
    .map(profileFor);

  res.json(ListUsersResponse.parse(profiles));
});

router.get("/users/:userId", requireAuth, async (req, res): Promise<void> => {
  const userId = String(req.params["userId"] ?? "");
  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }
  try {
    const summary = await getUserSummary(userId);
    res.json(
      GetUserProfileResponse.parse({
        userId,
        username: summary.username,
        avatarUrl: summary.avatarUrl,
      }),
    );
  } catch {
    res.status(404).json({ error: "User not found" });
  }
});

export default router;
