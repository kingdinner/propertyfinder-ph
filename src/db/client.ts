import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

const globalForDb = globalThis as unknown as {
  pg?: ReturnType<typeof postgres>;
};

function getConnectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

export function createDb(connectionString = getConnectionString()) {
  const client = postgres(connectionString, { max: 10 });
  return drizzle(client, { schema });
}

export function getDb() {
  if (!globalForDb.pg) {
    globalForDb.pg = postgres(getConnectionString(), { max: 10 });
  }
  return drizzle(globalForDb.pg, { schema });
}

export async function resetDbConnection() {
  if (globalForDb.pg) {
    await globalForDb.pg.end({ timeout: 1 });
    globalForDb.pg = undefined;
  }
}

export type Database = ReturnType<typeof createDb>;
