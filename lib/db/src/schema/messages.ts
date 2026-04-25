import { pgTable, text, serial, timestamp, index } from "drizzle-orm/pg-core";

export const messagesTable = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    username: text("username").notNull(),
    avatarUrl: text("avatar_url"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    createdAtIdx: index("messages_created_at_idx").on(table.createdAt),
    userIdIdx: index("messages_user_id_idx").on(table.userId),
  }),
);

export type Message = typeof messagesTable.$inferSelect;
export type InsertMessage = typeof messagesTable.$inferInsert;
