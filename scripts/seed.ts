import { getLibSqlClient, seedDatabase, getDatabaseConfig } from '../src/db'

async function main() {
  const config = getDatabaseConfig()
  console.log(`[Seed] Connecting to ${config.isRemote ? 'Remote Turso/Serverless DB' : 'Local Persistent LibSQL'}...`)

  const client = getLibSqlClient()
  const result = await seedDatabase(client, true)

  if (result.seeded) {
    console.log(`✅ Seed data successfully populated! (${result.count} case types verified)`)
  } else {
    console.log(`ℹ️ Seed data already present (${result.count} case types). Skipped to preserve idempotency.`)
  }
  client.close()
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err)
  process.exit(1)
})
