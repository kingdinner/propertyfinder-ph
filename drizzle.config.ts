import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://kingrowellvidal@localhost:5432/propertyfinder_ph",
  },
  strict: true,
  verbose: true,
});
