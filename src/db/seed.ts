import type { Client } from '@libsql/client'
import { SEED_SQL } from '../utils/embedded-data'

export { SEED_SQL }

/**
 * Seeds reference data (courts, legal categories/case types, staff users)
 * and essential initial data into the database idempotently.
 */
export async function seedDatabase(client: Client, force: boolean = false): Promise<{ seeded: boolean; count: number }> {
  try {
    if (!force) {
      // Check if reference tables are already populated
      const checkResult = await client.execute('SELECT COUNT(*) as count FROM case_types;')
      const count = Number(checkResult.rows[0]?.count || 0)
      if (count > 0) {
        return { seeded: false, count }
      }
    }

    await client.executeMultiple(SEED_SQL)

    const checkResult = await client.execute('SELECT COUNT(*) as count FROM case_types;')
    const count = Number(checkResult.rows[0]?.count || 0)
    return { seeded: true, count }
  } catch (err) {
    console.error('Error seeding database:', err)
    throw err
  }
}
