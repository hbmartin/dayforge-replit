import type { inferAsyncReturnType } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { getAuthSecret } from '@/lib/config';

export async function createContext(opts: FetchCreateContextFnOptions) {
  const token = await getToken({
    req: opts.req,
    secret: getAuthSecret(),
  });

  return {
    db,
    userId: token?.id as string | undefined,
    userEmail: token?.email as string | undefined,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
