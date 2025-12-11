import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import * as schema from "../schema";

export type PgDatabase = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Create a Drizzle database client using node-postgres
 * Use this in Node.js/Lambda applications
 */
export function createPgClient(pool: Pool): PgDatabase {
  return drizzle(pool, { schema });
}
