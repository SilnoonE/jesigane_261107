import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
});
export const slots = sqliteTable(
  "slots",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(),
    time: text("time").notNull(),
    open: integer("open").notNull().default(1),
  },
  (t) => [uniqueIndex("slot_datetime").on(t.date, t.time)],
);
export const entries = sqliteTable(
  "entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slotId: text("slot_id")
      .notNull()
      .references(() => slots.id),
    userId: text("user_id")
      .notNull()
      .references(() => members.id),
    active: integer("active").notNull().default(1),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("one_active_entry")
      .on(t.slotId, t.userId)
      .where(sql`${t.active}=1`),
    index("queue_order").on(t.slotId, t.active, t.id),
  ],
);
