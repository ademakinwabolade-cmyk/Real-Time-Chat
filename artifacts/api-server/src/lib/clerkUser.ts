import { clerkClient } from "@clerk/express";

interface CachedUser {
  username: string;
  avatarUrl: string | null;
  fetchedAt: number;
}

const TTL_MS = 30_000;
const cache: Map<string, CachedUser> = new Map();

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

export async function getUserSummary(userId: string): Promise<{
  username: string;
  avatarUrl: string | null;
}> {
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && now - cached.fetchedAt < TTL_MS) {
    return { username: cached.username, avatarUrl: cached.avatarUrl };
  }

  const user = await clerkClient.users.getUser(userId);
  const summary = {
    username: buildUsername({
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      emailAddresses: user.emailAddresses?.map((e) => ({
        emailAddress: e.emailAddress,
      })),
      id: user.id,
    }),
    avatarUrl: user.imageUrl ?? null,
  };
  cache.set(userId, { ...summary, fetchedAt: now });
  return summary;
}
