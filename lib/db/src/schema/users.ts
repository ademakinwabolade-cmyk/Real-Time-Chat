import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users_app", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  lastLogoutAt: timestamp("last_logout_at", { withTimezone: true }),
  loginCount: integer("login_count").notNull().default(0),
});

export type AppUser = typeof usersTable.$inferSelect;
export type InsertAppUser = typeof usersTable.$inferInsert;
