import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Use shared schema
  schema: '../shared/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
