// Re-export all schemas
export * from "./schema";

// Re-export postgres.js client (safe for Next.js bundling)
export { createPostgresClient, type PostgresDatabase } from "./client/postgres";
