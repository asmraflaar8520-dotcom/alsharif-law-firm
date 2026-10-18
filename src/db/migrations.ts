import type { Client } from '@libsql/client'
import { SCHEMA_SQL } from './schema'

export interface MigrationResult {
  success: boolean
  tablesCreated: string[]
  indexesCreated: string[]
  columnsAdded: string[]
  timestamp: string
}

/**
 * Runs idempotent database migrations.
 * Creates all essential tables (clients, cases, hearings, documents, poas, time_entries, etc.),
 * constraints, generated columns, views, required indexes, and applies incremental column additions.
 */
export async function runMigrations(client: Client): Promise<MigrationResult> {
  try {
    // 1. Execute base idempotent schema DDL
    await client.executeMultiple(SCHEMA_SQL)

    const columnsAdded: string[] = []

    // 2. Incremental column check for documents table
    const docColsRes = await client.execute(`PRAGMA table_info(documents);`)
    const docCols = new Set(docColsRes.rows.map((r: any) => String(r.name).toLowerCase()))

    const requiredDocCols: Array<{ name: string; type: string }> = [
      { name: 'file_url', type: 'TEXT' },
      { name: 'file_name', type: 'TEXT' },
      { name: 'file_size', type: 'INTEGER' },
      { name: 'mime_type', type: 'TEXT' },
      { name: 'storage_key', type: 'TEXT' }
    ]

    for (const col of requiredDocCols) {
      if (!docCols.has(col.name)) {
        await client.execute(`ALTER TABLE documents ADD COLUMN ${col.name} ${col.type};`)
        columnsAdded.push(`documents.${col.name}`)
      }
    }

    // 3. Incremental column check for powers_of_attorney table
    const poaColsRes = await client.execute(`PRAGMA table_info(powers_of_attorney);`)
    const poaCols = new Set(poaColsRes.rows.map((r: any) => String(r.name).toLowerCase()))

    const requiredPoaCols: Array<{ name: string; type: string }> = [
      { name: 'file_url', type: 'TEXT' },
      { name: 'file_name', type: 'TEXT' },
      { name: 'file_size', type: 'INTEGER' },
      { name: 'mime_type', type: 'TEXT' },
      { name: 'storage_key', type: 'TEXT' }
    ]

    let poaUpdated = false
    for (const col of requiredPoaCols) {
      if (!poaCols.has(col.name)) {
        await client.execute(`ALTER TABLE powers_of_attorney ADD COLUMN ${col.name} ${col.type};`)
        columnsAdded.push(`powers_of_attorney.${col.name}`)
        poaUpdated = true
      }
    }

    // 4. Refresh poas view and triggers if columns were updated
    if (poaUpdated) {
      await client.executeMultiple(`
        DROP TRIGGER IF EXISTS trg_poas_insert;
        DROP TRIGGER IF EXISTS trg_poas_update;
        DROP TRIGGER IF EXISTS trg_poas_delete;
        DROP VIEW IF EXISTS poas;

        CREATE VIEW IF NOT EXISTS poas AS SELECT * FROM powers_of_attorney;

        CREATE TRIGGER IF NOT EXISTS trg_poas_insert INSTEAD OF INSERT ON poas
        BEGIN
          INSERT INTO powers_of_attorney (id, poa_no, client_id, case_id, lawyer_id, type, notary_office, issue_date, expiry_date, status, scope, notes, file_url, file_name, file_size, mime_type, storage_key, created_at)
          VALUES (new.id, new.poa_no, new.client_id, new.case_id, new.lawyer_id, new.type, new.notary_office, new.issue_date, new.expiry_date, new.status, new.scope, new.notes, new.file_url, new.file_name, new.file_size, new.mime_type, new.storage_key, coalesce(new.created_at, datetime('now')));
        END;

        CREATE TRIGGER IF NOT EXISTS trg_poas_update INSTEAD OF UPDATE ON poas
        BEGIN
          UPDATE powers_of_attorney SET
            poa_no = new.poa_no,
            client_id = new.client_id,
            case_id = new.case_id,
            lawyer_id = new.lawyer_id,
            type = new.type,
            notary_office = new.notary_office,
            issue_date = new.issue_date,
            expiry_date = new.expiry_date,
            status = new.status,
            scope = new.scope,
            notes = new.notes,
            file_url = new.file_url,
            file_name = new.file_name,
            file_size = new.file_size,
            mime_type = new.mime_type,
            storage_key = new.storage_key
          WHERE id = old.id;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_poas_delete INSTEAD OF DELETE ON poas
        BEGIN
          DELETE FROM powers_of_attorney WHERE id = old.id;
        END;
      `)
    }

    // 4. Ensure appeal_deadlines table and performance indexes exist
    await client.execute(`
      CREATE TABLE IF NOT EXISTS appeal_deadlines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        deadline_type TEXT NOT NULL,
        judgment_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
      );
    `)
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_appeal_deadlines_case_id ON appeal_deadlines(case_id);`)
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_appeal_deadlines_due_date ON appeal_deadlines(due_date);`)
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_appeal_deadlines_status ON appeal_deadlines(status);`)
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_appeal_deadlines_radar ON appeal_deadlines(status, due_date);`)

    // Inspect created tables to verify completion
    const tableResult = await client.execute(
      `SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name;`
    )
    const tablesCreated = tableResult.rows.map((r: any) => String(r.name))

    // Inspect created indexes
    const indexResult = await client.execute(
      `SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name;`
    )
    const indexesCreated = indexResult.rows.map((r: any) => String(r.name))

    return {
      success: true,
      tablesCreated,
      indexesCreated,
      columnsAdded,
      timestamp: new Date().toISOString()
    }
  } catch (err) {
    console.error('Migration failed:', err)
    throw err
  }
}
