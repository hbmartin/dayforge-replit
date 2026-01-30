import { offlineDb, type SyncOperation } from './db';
import { markEntrySynced } from './entries';
import { markMessageSynced } from './messages';

const MAX_RETRY_ATTEMPTS = 5;

interface SyncResult {
  localId: string;
  serverId: string;
  success: boolean;
  error?: string;
}

export async function getPendingSyncOperations(): Promise<SyncOperation[]> {
  return await offlineDb.syncQueue
    .where('attempts')
    .below(MAX_RETRY_ATTEMPTS)
    .sortBy('createdAt');
}

export async function processSyncQueue(
  syncFn: (operations: Array<{
    operation: 'create' | 'update' | 'delete';
    entityType: 'entry' | 'message';
    localId: string;
    payload: Record<string, unknown>;
  }>) => Promise<{ results: SyncResult[] }>
): Promise<{ synced: number; failed: number }> {
  const pendingOps = await getPendingSyncOperations();
  
  if (pendingOps.length === 0) {
    return { synced: 0, failed: 0 };
  }

  const operations = pendingOps.map(op => ({
    operation: op.operation,
    entityType: op.entityType,
    localId: op.localId,
    payload: op.payload,
  }));

  try {
    const { results } = await syncFn(operations);
    
    let synced = 0;
    let failed = 0;

    for (const result of results) {
      const op = pendingOps.find(o => o.localId === result.localId);
      if (!op || !op.id) continue;

      if (result.success) {
        if (op.entityType === 'entry') {
          await markEntrySynced(result.localId, result.serverId);
        } else if (op.entityType === 'message') {
          await markMessageSynced(result.localId, result.serverId);
        }

        await offlineDb.syncQueue.delete(op.id);
        synced++;
      } else {
        await offlineDb.syncQueue.update(op.id, {
          attempts: op.attempts + 1,
          lastAttempt: new Date(),
          error: result.error,
        });
        failed++;
      }
    }

    return { synced, failed };
  } catch (error) {
    for (const op of pendingOps) {
      if (op.id) {
        await offlineDb.syncQueue.update(op.id, {
          attempts: op.attempts + 1,
          lastAttempt: new Date(),
          error: error instanceof Error ? error.message : 'Sync failed',
        });
      }
    }
    return { synced: 0, failed: pendingOps.length };
  }
}

export async function clearSyncQueue(): Promise<void> {
  await offlineDb.syncQueue.clear();
}

export async function getSyncQueueCount(): Promise<number> {
  return await offlineDb.syncQueue.count();
}
