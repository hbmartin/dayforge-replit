import { router } from '../trpc/trpc';
import { entriesRouter } from './entries';
import { messagesRouter } from './messages';
import { syncRouter } from './sync';

export const appRouter = router({
  entries: entriesRouter,
  messages: messagesRouter,
  sync: syncRouter,
});

export type AppRouter = typeof appRouter;
