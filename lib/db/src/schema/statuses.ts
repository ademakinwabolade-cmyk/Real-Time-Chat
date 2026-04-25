import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

export const statusesTable = pgTable(
  "statuses",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    username: text("username").notNull(),
    avatarUrl: text("avatar_url"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    expiresIdx: index("statuses_expires_idx").on(table.expiresAt),
    userIdx: index("statuses_user_idx").on(table.userId, table.createdAt),
  }),
);

export type Status = typeof statusesTable.$inferSelect;
export type InsertStatus = typeof statusesTable.$inferInsert;
