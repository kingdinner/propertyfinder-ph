import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

async function migrate(databaseUrl: string) {
  const sql = postgres(databaseUrl, { max: 1 });
  await sql`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id serial PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;
  const dir = path.join(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const hash = file;
    const existing = await sql`SELECT 1 FROM "__drizzle_migrations" WHERE hash = ${hash} LIMIT 1`;
    if (existing.length > 0) continue;
    const contents = readFileSync(path.join(dir, file), "utf8");
    await sql.unsafe(contents);
    await sql`INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (${hash}, ${Date.now()})`;
    console.log(`Applied ${file}`);
  }
  await sql.end();
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

migrate(url).catch((error) => {
  console.error(error);
  process.exit(1);
});
