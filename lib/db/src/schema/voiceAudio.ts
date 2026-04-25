import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  customType,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return "bytea";
  },
});

export const voiceAudioTable = pgTable("voice_audio", {
  id: serial("id").primaryKey(),
  mimeType: text("mime_type").notNull(),
  durationMs: integer("duration_ms").notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type VoiceAudio = typeof voiceAudioTable.$inferSelect;
export type InsertVoiceAudio = typeof voiceAudioTable.$inferInsert;
