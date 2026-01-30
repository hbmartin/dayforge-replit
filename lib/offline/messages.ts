import { offlineDb, generateLocalId, type OfflineMessage } from './db';

export async function createOfflineMessage(
  entryLocalId: string,
  content: string,
  role: OfflineMessage['role'] = 'user',
  type: OfflineMessage['type'] = 'text'
): Promise<OfflineMessage> {
  const localId = generateLocalId();
  const now = new Date();

  const message: OfflineMessage = {
    id: localId,
    localId,
    entryLocalId,
    role,
    type,
    content,
    syncStatus: 'pending',
    createdAt: now,
  };

  await offlineDb.messages.add(message);

  await offlineDb.syncQueue.add({
    operation: 'create',
    entityType: 'message',
    localId,
    payload: { entryLocalId, role, type, content },
    attempts: 0,
    createdAt: now,
  });

  return message;
}

export async function getOfflineMessage(id: string): Promise<OfflineMessage | undefined> {
  return await offlineDb.messages.get(id);
}

export async function listOfflineMessages(entryLocalId: string): Promise<OfflineMessage[]> {
  return await offlineDb.messages
    .where('entryLocalId')
    .equals(entryLocalId)
    .sortBy('createdAt');
}

export async function updateOfflineMessage(
  id: string,
  content: string
): Promise<OfflineMessage | undefined> {
  const message = await offlineDb.messages.get(id);
  if (!message) return undefined;

  const updatedMessage: OfflineMessage = {
    ...message,
    content,
    syncStatus: 'pending',
  };

  await offlineDb.messages.put(updatedMessage);

  await offlineDb.syncQueue.add({
    operation: 'update',
    entityType: 'message',
    localId: message.localId,
    payload: { content },
    attempts: 0,
    createdAt: new Date(),
  });

  return updatedMessage;
}

export async function deleteOfflineMessage(id: string): Promise<void> {
  const message = await offlineDb.messages.get(id);
  if (!message) return;

  await offlineDb.messages.delete(id);

  await offlineDb.syncQueue.add({
    operation: 'delete',
    entityType: 'message',
    localId: message.localId,
    payload: {},
    attempts: 0,
    createdAt: new Date(),
  });
}

export async function markMessageSynced(localId: string, serverId: string): Promise<void> {
  const message = await offlineDb.messages.where('localId').equals(localId).first();
  if (message) {
    await offlineDb.messages.update(message.id, {
      serverId,
      syncStatus: 'synced',
    });
  }
}
