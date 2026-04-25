import { pgTable, text, serial, timestamp, index } from "drizzle-orm/pg-core";

export const loginEventsTable = pgTable(
  "login_events",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    eventType: text("event_type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
  },
  (table) => ({
    userIdx: index("login_events_user_idx").on(table.userId, table.occurredAt),
  }),
);

export type LoginEvent = typeof loginEventsTable.$inferSelect;
export type InsertLoginEvent = typeof loginEventsTable.$inferInsert;
