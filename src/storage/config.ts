import path from 'node:path'
import fs from 'node:fs'
import { config } from '../config/env'

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
  const bucketName = config.storage.bucketName
  const accessKeyId = config.storage.accessKeyId
  const secretAccessKey = config.storage.secretAccessKey
  const endpoint = config.storage.endpoint
  const region = config.storage.region
  const publicUrl = config.storage.publicUrl
  const isCloudConfigured = config.storage.isCloudConfigured

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
