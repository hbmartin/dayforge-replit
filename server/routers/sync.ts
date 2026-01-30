import { z } from 'zod';
import { router, protectedProcedure } from '../trpc/trpc';
import { entries, messages } from '@/lib/db/journal-schema';
import { eq, and, gt, or } from 'drizzle-orm';

const entryCreateSchema = z.object({
  mode: z.enum(['notebook', 'plan', 'reflect', 'sleep', 'lift', 'clarity', 'unpack', 'create']),
  status: z.enum(['active', 'completed', 'abandoned']).default('active'),
  metadata: z.record(z.unknown()).optional(),
});

const entryUpdateSchema = z.object({
  status: z.enum(['active', 'completed', 'abandoned']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const messageCreateSchema = z.object({
  entryLocalId: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  type: z.enum(['text', 'question', 'artifact', 'tool_call', 'tool_result']).default('text'),
  content: z.string(),
});

const syncOperationSchema = z.object({
  operation: z.enum(['create', 'update', 'delete']),
  entityType: z.enum(['entry', 'message']),
  localId: z.string(),
  payload: z.union([entryCreateSchema, entryUpdateSchema, messageCreateSchema, z.object({})]),
});

export const syncRouter = router({
  push: protectedProcedure
    .input(z.object({
      operations: z.array(syncOperationSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      const results: Array<{ localId: string; serverId: string; success: boolean; error?: string }> = [];

      for (const op of input.operations) {
        try {
          if (op.entityType === 'entry') {
            if (op.operation === 'create') {
              const parsed = entryCreateSchema.safeParse(op.payload);
              if (!parsed.success) {
                results.push({ localId: op.localId, serverId: '', success: false, error: 'Invalid entry payload' });
                continue;
              }
              
              const [entry] = await ctx.db.insert(entries).values({
                userId: ctx.userId,
                mode: parsed.data.mode,
                status: parsed.data.status,
                localId: op.localId,
                metadata: parsed.data.metadata ?? {},
              }).returning();
              
              if (entry) {
                results.push({ localId: op.localId, serverId: entry.id, success: true });
              }
            } else if (op.operation === 'update') {
              const parsed = entryUpdateSchema.safeParse(op.payload);
              if (!parsed.success) {
                results.push({ localId: op.localId, serverId: '', success: false, error: 'Invalid update payload' });
                continue;
              }

              const updateData: Record<string, unknown> = { updatedAt: new Date() };
              if (parsed.data.status) updateData.status = parsed.data.status;
              if (parsed.data.metadata) updateData.metadata = parsed.data.metadata;

              const [entry] = await ctx.db
                .update(entries)
                .set(updateData)
                .where(and(
                  or(eq(entries.localId, op.localId), eq(entries.id, op.localId)),
                  eq(entries.userId, ctx.userId)
                )!)
                .returning();
              results.push({ localId: op.localId, serverId: entry?.id ?? '', success: !!entry });
            } else if (op.operation === 'delete') {
              const [deleted] = await ctx.db
                .delete(entries)
                .where(and(
                  or(eq(entries.localId, op.localId), eq(entries.id, op.localId)),
                  eq(entries.userId, ctx.userId)
                )!)
                .returning();
              results.push({ localId: op.localId, serverId: deleted?.id ?? '', success: !!deleted });
            }
          } else if (op.entityType === 'message') {
            if (op.operation === 'create') {
              const parsed = messageCreateSchema.safeParse(op.payload);
              if (!parsed.success) {
                results.push({ localId: op.localId, serverId: '', success: false, error: 'Invalid message payload' });
                continue;
              }
              
              const [entry] = await ctx.db
                .select()
                .from(entries)
                .where(and(
                  or(eq(entries.localId, parsed.data.entryLocalId), eq(entries.id, parsed.data.entryLocalId)),
                  eq(entries.userId, ctx.userId)
                )!);

              if (entry) {
                const [message] = await ctx.db.insert(messages).values({
                  entryId: entry.id,
                  role: parsed.data.role,
                  type: parsed.data.type,
                  content: parsed.data.content,
                  localId: op.localId,
                }).returning();
                
                if (message) {
                  results.push({ localId: op.localId, serverId: message.id, success: true });
                }
              } else {
                results.push({ localId: op.localId, serverId: '', success: false, error: 'Entry not found' });
              }
            }
          }
        } catch (error) {
          results.push({
            localId: op.localId,
            serverId: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { results };
    }),

  pull: protectedProcedure
    .input(z.object({
      lastSyncedAt: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      let updatedEntries;
      
      if (input.lastSyncedAt) {
        updatedEntries = await ctx.db
          .select()
          .from(entries)
          .where(and(
            eq(entries.userId, ctx.userId),
            gt(entries.updatedAt, input.lastSyncedAt)
          )!);
      } else {
        updatedEntries = await ctx.db
          .select()
          .from(entries)
          .where(eq(entries.userId, ctx.userId));
      }

      const entryIds = updatedEntries.map(e => e.id);
      
      let updatedMessages: typeof messages.$inferSelect[] = [];
      if (entryIds.length > 0) {
        for (const entryId of entryIds) {
          const entryMessages = await ctx.db
            .select()
            .from(messages)
            .where(eq(messages.entryId, entryId));
          updatedMessages = [...updatedMessages, ...entryMessages];
        }
      }

      return {
        entries: updatedEntries,
        messages: updatedMessages,
        syncedAt: new Date(),
      };
    }),
});
