import path from 'node:path'
import fs from 'node:fs'

export interface StorageConfig {
  bucketName?: string
  endpoint?: string
  region: string
  accessKeyId?: string
  secretAccessKey?: string
  publicUrl?: string
  maxFileSizeBytes: number
  allowedMimeTypes: string[]
  isCloudConfigured: boolean
  localUploadDir: string
}

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png'
]

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024 // 15 Megabytes

export function getStorageConfig(): StorageConfig {
  const env = (globalThis as any).process?.env || {}

  const bucketName = env.R2_BUCKET_NAME || env.S3_BUCKET_NAME || env.AWS_S3_BUCKET
  const accessKeyId = env.R2_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY

  const accountId = env.R2_ACCOUNT_ID
  const endpoint = env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : env.S3_ENDPOINT)
  const region = env.AWS_REGION || env.R2_REGION || 'auto'
  const publicUrl = env.R2_PUBLIC_URL || env.S3_PUBLIC_URL

  const isCloudConfigured = Boolean(bucketName && accessKeyId && secretAccessKey)

  const localUploadDir = path.resolve(process.cwd(), 'data', 'uploads')
  if (!isCloudConfigured) {
    try {
      if (!fs.existsSync(localUploadDir)) {
        fs.mkdirSync(localUploadDir, { recursive: true })
      }
    } catch {
      // Best-effort directory creation
    }
  }

  return {
    bucketName,
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    publicUrl,
    maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
    isCloudConfigured,
    localUploadDir
  }
}
