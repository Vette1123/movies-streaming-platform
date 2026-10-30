import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/**
 * The real migrations and the real SQL on an in-memory SQLite, through a thin
 * D1-shaped wrapper. Upserts, `DELETE ... RETURNING` and single-use claims are
 * the parts worth proving, and a mock of them would only prove the mock.
 */
export function sqliteD1(...migrations: string[]): {
  db: D1Database
  sqlite: DatabaseSync
} {
  const sqlite = new DatabaseSync(':memory:')
  for (const name of migrations) {
    sqlite.exec(fs.readFileSync(path.join('migrations', name), 'utf8'))
  }
  const db = {
    prepare: (sql: string) => ({
      bind: (...args: never[]) => {
        const statement = sqlite.prepare(sql)
        return {
          first: async () => statement.get(...args) ?? null,
          all: async () => ({ results: statement.all(...args) }),
          run: async () => ({
            meta: { changes: Number(statement.run(...args).changes) },
          }),
        }
      },
    }),
  } as unknown as D1Database
  return { db, sqlite }
}

export const addUser = (
  sqlite: DatabaseSync,
  id: string,
  grants: string | null
) =>
  sqlite
    .prepare(
      'INSERT INTO users (id, google_sub, email, created_at, grants) VALUES (?, ?, ?, ?, ?)'
    )
    .run(id, id, `${id}@example.com`, Date.now(), grants)
