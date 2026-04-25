export interface PresenceMember {
  userId: string;
  username: string;
  avatarUrl: string | null;
}

interface PresenceEntry {
  member: PresenceMember;
  connections: number;
}

const presence: Map<string, PresenceEntry> = new Map();

export function addConnection(member: PresenceMember): {
  changed: boolean;
} {
  const existing = presence.get(member.userId);
  if (existing) {
    existing.connections += 1;
    existing.member = member;
    return { changed: false };
  }
  presence.set(member.userId, { member, connections: 1 });
  return { changed: true };
}

export function removeConnection(userId: string): { changed: boolean } {
  const existing = presence.get(userId);
  if (!existing) return { changed: false };
  existing.connections -= 1;
  if (existing.connections <= 0) {
    presence.delete(userId);
    return { changed: true };
  }
  return { changed: false };
}

export function snapshot(): {
  onlineCount: number;
  members: PresenceMember[];
} {
  const members = Array.from(presence.values()).map((entry) => entry.member);
  members.sort((a, b) =>
    a.username.toLowerCase().localeCompare(b.username.toLowerCase()),
  );
  return {
    onlineCount: members.length,
    members,
  };
}
