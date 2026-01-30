import { z } from 'zod';
import { router, protectedProcedure } from '../trpc/trpc';
import { entries, messages } from '@/lib/db/journal-schema';
import { eq, desc, and, lt, asc } from 'drizzle-orm';

export const entriesRouter = router({
  create: protectedProcedure
    .input(z.object({
      mode: z.enum(['notebook', 'plan', 'reflect', 'sleep', 'lift', 'clarity', 'unpack', 'create']),
      localId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [entry] = await ctx.db.insert(entries).values({
        userId: ctx.userId,
        mode: input.mode,
        status: 'active',
        localId: input.localId ?? null,
        metadata: {},
      }).returning();
      return entry;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [entry] = await ctx.db
        .select()
        .from(entries)
        .where(and(
          eq(entries.id, input.id),
          eq(entries.userId, ctx.userId)
        ));

      if (!entry) return null;

      const entryMessages = await ctx.db
        .select()
        .from(messages)
        .where(eq(messages.entryId, input.id))
        .orderBy(asc(messages.createdAt));

      return { entry, messages: entryMessages };
    }),

  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      cursor: z.string().uuid().optional(),
      mode: z.enum(['notebook', 'plan', 'reflect', 'sleep', 'lift', 'clarity', 'unpack', 'create']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(entries.userId, ctx.userId)];
      
      if (input.mode) {
        conditions.push(eq(entries.mode, input.mode));
      }

      if (input.cursor) {
        const [cursorEntry] = await ctx.db
          .select()
          .from(entries)
          .where(eq(entries.id, input.cursor));
        
        if (cursorEntry) {
          conditions.push(lt(entries.createdAt, cursorEntry.createdAt));
        }
      }

      const items = await ctx.db
        .select()
        .from(entries)
        .where(and(...conditions))
        .orderBy(desc(entries.createdAt))
        .limit(input.limit + 1);

      const hasMore = items.length > input.limit;
      const data = hasMore ? items.slice(0, -1) : items;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

      return { items: data, nextCursor, hasMore };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(['active', 'completed', 'abandoned']).optional(),
      metadata: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updateData: { updatedAt: Date; status?: string; completedAt?: Date; metadata?: Record<string, unknown> } = { updatedAt: new Date() };
      
      if (input.status) {
        updateData.status = input.status;
        if (input.status === 'completed' || input.status === 'abandoned') {
          updateData.completedAt = new Date();
        }
      }
      
      if (input.metadata) {
        updateData.metadata = input.metadata;
      }

      const [updated] = await ctx.db
        .update(entries)
        .set(updateData)
        .where(and(
          eq(entries.id, input.id),
          eq(entries.userId, ctx.userId)
        )!)
        .returning();

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(entries)
        .where(and(
          eq(entries.id, input.id),
          eq(entries.userId, ctx.userId)
        ))
        .returning();

      return deleted;
    }),
});
