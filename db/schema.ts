import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

export const meetups = sqliteTable("meetups", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => members.id),
  title: text("title").notNull(),
  location: text("location").notNull(),
  startsAt: text("starts_at").notNull(),
  amount: integer("amount").notNull(),
  code: text("code").notNull().unique(),
  state: text("state").notNull().default("open"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const guests = sqliteTable(
  "guests",
  {
    id: text("id").primaryKey(),
    meetupId: text("meetup_id")
      .notNull()
      .references(() => meetups.id),
    userId: text("user_id")
      .notNull()
      .references(() => members.id),
    nickname: text("nickname"),
    payment: text("payment").notNull().default("unpaid"),
    provider: text("provider"),
    paymentRef: text("payment_ref"),
    checkedAt: text("checked_at"),
  },
  (t) => [
    uniqueIndex("one_guest").on(t.meetupId, t.userId),
    uniqueIndex("one_room_nickname").on(t.meetupId, t.nickname),
  ],
);
export const claims = sqliteTable(
  "claims",
  {
    id: text("id").primaryKey(),
    meetupId: text("meetup_id")
      .notNull()
      .references(() => meetups.id),
    targetId: text("target_id")
      .notNull()
      .references(() => members.id),
    creatorId: text("creator_id").notNull(),
    reason: text("reason").notNull(),
    state: text("state").notNull().default("pending"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("one_claim_per_guest").on(t.meetupId, t.targetId)],
);
export const votes = sqliteTable(
  "votes",
  {
    id: text("id").primaryKey(),
    claimId: text("claim_id")
      .notNull()
      .references(() => claims.id),
    voterId: text("voter_id")
      .notNull()
      .references(() => members.id),
    agree: integer("agree").notNull(),
  },
  (t) => [uniqueIndex("one_vote").on(t.claimId, t.voterId)],
);
export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  meetupId: text("meetup_id")
    .notNull()
    .references(() => meetups.id),
  amount: integer("amount").notNull(),
  memo: text("memo").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
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
