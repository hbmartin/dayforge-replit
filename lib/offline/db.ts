import Dexie, { type Table } from 'dexie';

export interface OfflineEntry {
  id: string;
  localId: string;
  serverId?: string;
  userId: string;
  mode: 'notebook' | 'plan' | 'reflect' | 'sleep' | 'lift' | 'clarity' | 'unpack' | 'create';
  status: 'active' | 'completed' | 'abandoned';
  metadata: Record<string, unknown>;
  syncStatus: 'synced' | 'pending' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface OfflineMessage {
  id: string;
  localId: string;
  serverId?: string;
  entryLocalId: string;
  entryId?: string;
  role: 'user' | 'assistant' | 'system';
  type: 'text' | 'question' | 'artifact' | 'tool_call' | 'tool_result';
  content: string;
  toolData?: Record<string, unknown>;
  syncStatus: 'synced' | 'pending' | 'failed';
  createdAt: Date;
}

export interface SyncOperation {
  id?: number;
  operation: 'create' | 'update' | 'delete';
  entityType: 'entry' | 'message';
  localId: string;
  payload: Record<string, unknown>;
  attempts: number;
  lastAttempt?: Date;
  error?: string;
  createdAt: Date;
}

export interface UserPreferences {
  id: string;
  userId: string;
  data: Record<string, unknown>;
  lastSyncedAt: Date;
}

class JournalDatabase extends Dexie {
  entries!: Table<OfflineEntry, string>;
  messages!: Table<OfflineMessage, string>;
  syncQueue!: Table<SyncOperation, number>;
  preferences!: Table<UserPreferences, string>;

  constructor() {
    super('StructuredJournal');

    this.version(2).stores({
      entries: 'id, localId, serverId, userId, mode, status, syncStatus, createdAt, updatedAt, [userId+mode]',
      messages: 'id, localId, serverId, entryLocalId, entryId, role, type, syncStatus, createdAt',
      syncQueue: '++id, entityType, localId, createdAt',
      preferences: 'id, userId',
    });
  }
}

export const offlineDb = new JournalDatabase();

export function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
