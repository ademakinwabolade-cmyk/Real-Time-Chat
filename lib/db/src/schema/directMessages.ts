import { pgTable, text, serial, timestamp, index } from "drizzle-orm/pg-core";

export function conversationKeyFor(a: string, b: string): string {
  return [a, b].sort().join(":");
}

export const directMessagesTable = pgTable(
  "direct_messages",
  {
    id: serial("id").primaryKey(),
    conversationKey: text("conversation_key").notNull(),
    senderId: text("sender_id").notNull(),
    recipientId: text("recipient_id").notNull(),
    senderUsername: text("sender_username").notNull(),
    senderAvatarUrl: text("sender_avatar_url"),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    conversationIdx: index("direct_messages_conversation_idx").on(
      table.conversationKey,
      table.createdAt,
    ),
    recipientUnreadIdx: index("direct_messages_recipient_unread_idx").on(
      table.recipientId,
      table.readAt,
    ),
  }),
);

export type DirectMessage = typeof directMessagesTable.$inferSelect;
export type InsertDirectMessage = typeof directMessagesTable.$inferInsert;
