import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getPostgresUrl } from '../config';
import * as journalSchema from './journal-schema';

const client = postgres(getPostgresUrl());
export const db = drizzle(client, { schema: journalSchema });

export * from './journal-schema';
