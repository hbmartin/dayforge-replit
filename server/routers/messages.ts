import { z } from 'zod';
import { router, protectedProcedure } from '../trpc/trpc';
import { messages, entries } from '@/lib/db/journal-schema';
import { eq, and, asc } from 'drizzle-orm';

export const messagesRouter = router({
  create: protectedProcedure
    .input(z.object({
      entryId: z.string().uuid(),
      role: z.enum(['user', 'assistant', 'system']),
      type: z.enum(['text', 'question', 'artifact', 'tool_call', 'tool_result']).default('text'),
      content: z.string(),
      localId: z.string().optional(),
      toolData: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [entry] = await ctx.db
        .select()
        .from(entries)
        .where(and(
          eq(entries.id, input.entryId),
          eq(entries.userId, ctx.userId)
        )!);

      if (!entry) {
        throw new Error('Entry not found or unauthorized');
      }

      const [message] = await ctx.db.insert(messages).values({
        entryId: input.entryId,
        role: input.role,
        type: input.type,
        content: input.content,
        localId: input.localId ?? null,
        toolData: input.toolData ?? null,
      }).returning();

      await ctx.db
        .update(entries)
        .set({ updatedAt: new Date() })
        .where(eq(entries.id, input.entryId));

      return message;
    }),

  list: protectedProcedure
    .input(z.object({
      entryId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const [entry] = await ctx.db
        .select()
        .from(entries)
        .where(and(
          eq(entries.id, input.entryId),
          eq(entries.userId, ctx.userId)
        ));

      if (!entry) {
        throw new Error('Entry not found or unauthorized');
      }

      return await ctx.db
        .select()
        .from(messages)
        .where(eq(messages.entryId, input.entryId))
        .orderBy(asc(messages.createdAt));
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      content: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [message] = await ctx.db
        .select()
        .from(messages)
        .where(eq(messages.id, input.id));

      if (!message) {
        throw new Error('Message not found');
      }

      const [entry] = await ctx.db
        .select()
        .from(entries)
        .where(and(
          eq(entries.id, message.entryId),
          eq(entries.userId, ctx.userId)
        ));

      if (!entry) {
        throw new Error('Unauthorized');
      }

      const [updated] = await ctx.db
        .update(messages)
        .set({ content: input.content })
        .where(eq(messages.id, input.id))
        .returning();

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [message] = await ctx.db
        .select()
        .from(messages)
        .where(eq(messages.id, input.id));

      if (!message) {
        throw new Error('Message not found');
      }

      const [entry] = await ctx.db
        .select()
        .from(entries)
        .where(and(
          eq(entries.id, message.entryId),
          eq(entries.userId, ctx.userId)
        ));

      if (!entry) {
        throw new Error('Unauthorized');
      }

      const [deleted] = await ctx.db
        .delete(messages)
        .where(eq(messages.id, input.id))
        .returning();

      return deleted;
    }),
});
