import { getLibSqlClient, runMigrations, getDatabaseConfig } from '../src/db'

async function main() {
  const config = getDatabaseConfig()
  console.log(`[Migration] Connecting to ${config.isRemote ? 'Remote Turso/Serverless DB' : 'Local Persistent LibSQL'}...`)
  console.log(`[Migration] Target URL: ${config.url.replace(/:[^:]*@/, ':***@')}`)

  const client = getLibSqlClient()
  const result = await runMigrations(client)

  console.log('✅ Migrations applied successfully!')
  console.log(`- Tables verified (${result.tablesCreated.length}):`, result.tablesCreated.join(', '))
  console.log(`- Indexes verified (${result.indexesCreated.length}):`, result.indexesCreated.join(', '))
  client.close()
}

main().catch((err) => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})
