import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  real,
  index,
  unique,
} from 'drizzle-orm/pg-core';

export const journalUsers = pgTable('journal_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  password: text('password'),
  preferencesCache: jsonb('preferences_cache').default({}),
  preferencesLastSync: timestamp('preferences_last_sync', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type JournalUser = InferSelectModel<typeof journalUsers>;
export type NewJournalUser = InferInsertModel<typeof journalUsers>;

export const entries = pgTable('entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => journalUsers.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull().$type<'notebook' | 'plan' | 'reflect' | 'sleep' | 'lift' | 'clarity' | 'unpack' | 'create'>(),
  status: text('status').notNull().default('active').$type<'active' | 'completed' | 'abandoned'>(),
  metadata: jsonb('metadata').default({}),
  syncStatus: text('sync_status').notNull().default('synced').$type<'synced' | 'pending' | 'failed'>(),
  localId: text('local_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  userIdIdx: index('entries_user_id_idx').on(table.userId),
  userCreatedIdx: index('entries_user_created_idx').on(table.userId, table.createdAt),
  modeIdx: index('entries_mode_idx').on(table.userId, table.mode),
  localIdIdx: index('entries_local_id_idx').on(table.localId),
}));

export type Entry = InferSelectModel<typeof entries>;
export type NewEntry = InferInsertModel<typeof entries>;

export const messages = pgTable('journal_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  entryId: uuid('entry_id').notNull().references(() => entries.id, { onDelete: 'cascade' }),
  role: text('role').notNull().$type<'user' | 'assistant' | 'system'>(),
  type: text('type').notNull().default('text').$type<'text' | 'question' | 'artifact' | 'tool_call' | 'tool_result'>(),
  content: text('content').notNull(),
  toolData: jsonb('tool_data'),
  syncStatus: text('sync_status').notNull().default('synced').$type<'synced' | 'pending' | 'failed'>(),
  localId: text('local_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  entryIdIdx: index('messages_entry_id_idx').on(table.entryId),
  entryCreatedIdx: index('messages_entry_created_idx').on(table.entryId, table.createdAt),
}));

export type JournalMessage = InferSelectModel<typeof messages>;
export type NewJournalMessage = InferInsertModel<typeof messages>;

export const artifacts = pgTable('artifacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => journalUsers.id, { onDelete: 'cascade' }),
  entryId: uuid('entry_id').references(() => entries.id, { onDelete: 'set null' }),
  type: text('type').notNull().$type<'if_then_plan' | 'todo' | 'todo_list' | 'balanced_thought' | 'insight' | 'open_loop' | 'gratitude_list' | 'vision_narrative' | 'weekly_review'>(),
  data: jsonb('data').notNull(),
  status: text('status').$type<'pending' | 'completed' | 'skipped' | 'expired'>(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolutionNotes: text('resolution_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('artifacts_user_id_idx').on(table.userId),
  typeIdx: index('artifacts_type_idx').on(table.userId, table.type),
  statusIdx: index('artifacts_status_idx').on(table.userId, table.status),
  entryIdIdx: index('artifacts_entry_id_idx').on(table.entryId),
}));

export type Artifact = InferSelectModel<typeof artifacts>;
export type NewArtifact = InferInsertModel<typeof artifacts>;

export const entities = pgTable('entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => journalUsers.id, { onDelete: 'cascade' }),
  type: text('type').notNull().$type<'person' | 'project' | 'topic' | 'place' | 'custom'>(),
  name: text('name').notNull(),
  aliases: text('aliases').array().default([]),
  shouldRemember: boolean('should_remember').notNull().default(true),
  zepEntityId: text('zep_entity_id'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('entities_user_id_idx').on(table.userId),
  nameIdx: index('entities_name_idx').on(table.userId, table.name),
  uniqueName: unique('entities_user_type_name').on(table.userId, table.type, table.name),
}));

export type Entity = InferSelectModel<typeof entities>;
export type NewEntity = InferInsertModel<typeof entities>;

export const entityRelationships = pgTable('entity_relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => journalUsers.id, { onDelete: 'cascade' }),
  fromEntityId: uuid('from_entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  toEntityId: uuid('to_entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  relationshipType: text('relationship_type').notNull(),
  confidence: real('confidence').notNull().default(0.5),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type EntityRelationship = InferSelectModel<typeof entityRelationships>;
export type NewEntityRelationship = InferInsertModel<typeof entityRelationships>;

export const syncQueue = pgTable('sync_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => journalUsers.id, { onDelete: 'cascade' }),
  operation: text('operation').notNull().$type<'create' | 'update' | 'delete'>(),
  entityType: text('entity_type').notNull().$type<'entry' | 'message' | 'artifact'>(),
  entityId: uuid('entity_id').notNull(),
  localId: text('local_id').notNull(),
  payload: jsonb('payload').notNull(),
  attempts: text('attempts').notNull().default('0'),
  lastAttempt: timestamp('last_attempt', { withTimezone: true }),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userPendingIdx: index('sync_queue_user_pending_idx').on(table.userId, table.createdAt),
}));

export type SyncQueueItem = InferSelectModel<typeof syncQueue>;
export type NewSyncQueueItem = InferInsertModel<typeof syncQueue>;
