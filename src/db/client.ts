import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

type DB = ReturnType<typeof drizzle<typeof schema>>;

let _db: DB | undefined;

function getDb(): DB {
  if (!_db) {
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    _db = drizzle(client, { schema });
  }
  return _db;
}

// Lazy proxy — createClient() is deferred until first property access
// (inside a request handler), not at module import time. This prevents
// Next.js static analysis from throwing when env vars aren't yet injected.
export const db = new Proxy({} as DB, {
  get(_target, prop: string | symbol) {
    return getDb()[prop as keyof DB];
  },
});
