import { relations } from "drizzle-orm";
import { index, pgTableCreator, primaryKey } from "drizzle-orm/pg-core";
import { type AdapterAccount } from "next-auth/adapters";

const createAuthTable = pgTableCreator((name) => `auth_${name}`);

export const users = createAuthTable("user", (d) => ({
  id: d
    .varchar("id", { length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.varchar("name", { length: 255 }),
  email: d.varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: d
    .timestamp("email_verified", { mode: "date", withTimezone: true })
    .$defaultFn(() => new Date()),
  image: d.varchar("image", { length: 255 }),
  password: d.varchar("password", { length: 255 }),
  role: d.varchar("role", { length: 50 }).$default(() => "user"),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const accounts = createAuthTable(
  "account",
  (d) => ({
    userId: d
      .varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: d.varchar("type", { length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: d.varchar("provider", { length: 255 }).notNull(),
    providerAccountId: d.varchar("provider_account_id", { length: 255 }).notNull(),
    refresh_token: d.text("refresh_token"),
    access_token: d.text("access_token"),
    expires_at: d.integer("expires_at"),
    token_type: d.varchar("token_type", { length: 255 }),
    scope: d.varchar("scope", { length: 255 }),
    id_token: d.text("id_token"),
    session_state: d.varchar("session_state", { length: 255 }),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createAuthTable(
  "session",
  (d) => ({
    sessionToken: d.varchar("session_token", { length: 255 }).notNull().primaryKey(),
    userId: d
      .varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: d.timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createAuthTable(
  "verification_token",
  (d) => ({
    identifier: d.text("identifier").notNull(),
    token: d.text("token").notNull(),
    expires: d.timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);
