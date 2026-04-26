import { sql, type SQL } from "drizzle-orm";

/**
 * Builds a typed PostgreSQL `text[]` from JS strings so array ops don't degrade
 * to `array_cat(text[], record)` (Neon + Drizzle param binding quirk).
 */
export function sqlTextArray(values: string[]): SQL {
  if (values.length === 0) return sql`ARRAY[]::text[]`;
  return sql`ARRAY[${sql.join(values.map((v) => sql`${v}`), sql`, `)}]::text[]`;
}
