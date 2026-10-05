/**
 * Audit Logging Utility
 * Records key user operations in the database activities table
 */
export async function logActivity(
  db: D1Database,
  userId: number | null,
  entityType: string,
  entityId: number | null,
  action: string,
  detail: string
): Promise<void> {
  try {
    await db.prepare(
      `INSERT INTO activities (user_id, entity_type, entity_id, action, detail) VALUES (?, ?, ?, ?, ?)`
    ).bind(userId, entityType, entityId, action, detail).run()
  } catch (err) {
    console.error('Failed to log activity:', err)
  }
}
