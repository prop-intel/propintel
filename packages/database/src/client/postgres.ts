import { drizzle } from "drizzle-orm/postgres-js";
import type postgres from "postgres";
import * as schema from "../schema";

export type PostgresDatabase = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Create a Drizzle database client using postgres-js
 * Use this in Next.js/frontend applications
 */
export function createPostgresClient(connection: postgres.Sql): PostgresDatabase {
  return drizzle(connection, { schema });
}
