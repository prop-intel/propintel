// Re-export all schemas
export * from "./schema";

// Re-export client factories
export { createPostgresClient, type PostgresDatabase } from "./client/postgres";
export { createPgClient, type PgDatabase } from "./client/pg";
