import { offlineDb, generateLocalId, type OfflineEntry } from './db';

export async function createOfflineEntry(
  userId: string,
  mode: OfflineEntry['mode']
): Promise<OfflineEntry> {
  const localId = generateLocalId();
  const now = new Date();

  const entry: OfflineEntry = {
    id: localId,
    localId,
    userId,
    mode,
    status: 'active',
    metadata: {},
    syncStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  await offlineDb.entries.add(entry);

  await offlineDb.syncQueue.add({
    operation: 'create',
    entityType: 'entry',
    localId,
    payload: { mode, status: 'active', metadata: {} },
    attempts: 0,
    createdAt: now,
  });

  return entry;
}

export async function getOfflineEntry(id: string): Promise<OfflineEntry | undefined> {
  return await offlineDb.entries.get(id);
}

export async function listOfflineEntries(
  userId: string,
  options?: {
    mode?: OfflineEntry['mode'];
    limit?: number;
  }
): Promise<OfflineEntry[]> {
  let query = offlineDb.entries
    .where('userId')
    .equals(userId)
    .reverse();

  if (options?.mode) {
    query = offlineDb.entries
      .where(['userId', 'mode'])
      .equals([userId, options.mode])
      .reverse();
  }

  const entries = await query.sortBy('createdAt');
  
  if (options?.limit) {
    return entries.slice(0, options.limit);
  }

  return entries;
}

export async function updateOfflineEntry(
  id: string,
  updates: Partial<Pick<OfflineEntry, 'status' | 'metadata'>>
): Promise<OfflineEntry | undefined> {
  const entry = await offlineDb.entries.get(id);
  if (!entry) return undefined;

  const now = new Date();
  const updatedEntry: OfflineEntry = {
    ...entry,
    ...updates,
    updatedAt: now,
    syncStatus: 'pending',
  };

  if (updates.status === 'completed' || updates.status === 'abandoned') {
    updatedEntry.completedAt = now;
  }

  await offlineDb.entries.put(updatedEntry);

  await offlineDb.syncQueue.add({
    operation: 'update',
    entityType: 'entry',
    localId: entry.localId,
    payload: updates,
    attempts: 0,
    createdAt: now,
  });

  return updatedEntry;
}

export async function deleteOfflineEntry(id: string): Promise<void> {
  const entry = await offlineDb.entries.get(id);
  if (!entry) return;

  await offlineDb.messages.where('entryLocalId').equals(entry.localId).delete();

  await offlineDb.entries.delete(id);

  await offlineDb.syncQueue.add({
    operation: 'delete',
    entityType: 'entry',
    localId: entry.localId,
    payload: {},
    attempts: 0,
    createdAt: new Date(),
  });
}

export async function markEntrySynced(localId: string, serverId: string): Promise<void> {
  const entry = await offlineDb.entries.where('localId').equals(localId).first();
  if (entry) {
    await offlineDb.entries.update(entry.id, {
      serverId,
      syncStatus: 'synced',
    });
  }
}
