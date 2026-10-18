import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getStorageConfig, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from './config'

export interface UploadInput {
  buffer: Buffer | Uint8Array
  filename: string
  mimeType: string
  folder?: string
}

export interface UploadedFileResult {
  file_url: string
  file_name: string
  file_size: number
  mime_type: string
  storage_key: string
}

export interface FileDownloadResult {
  data: Buffer
  mimeType: string
  filename: string
  size: number
}

let cachedS3Client: S3Client | null = null

export class StorageService {
  /**
   * Sanitizes user-provided filenames to prevent path traversal and shell injection.
   */
  static sanitizeFilename(rawName: string): string {
    if (!rawName || !rawName.trim()) return 'document.pdf'
    const base = path.basename(rawName.trim())
    const sanitized = base
      .replace(/[^\w\u0600-\u06FF.-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .trim()
    return sanitized || 'document.pdf'
  }

  /**
   * Enforces server-side file security constraints.
   */
  static validateFile(size: number, mimeType: string, filename: string): { valid: boolean; error?: string } {
    if (!size || size <= 0) {
      return { valid: false, error: 'الملف فارغ أو غير صالح' }
    }

    if (size > MAX_FILE_SIZE_BYTES) {
      return { valid: false, error: 'حجم الملف يتجاوز الحد الأقصى المسموح به (15 ميجابايت)' }
    }

    const cleanMime = (mimeType || '').toLowerCase().trim()
    if (!ALLOWED_MIME_TYPES.includes(cleanMime)) {
      return {
        valid: false,
        error: 'نوع الملف غير مدعوم. الصيغ المدعومة هي: PDF (مستندات), JPEG, PNG (صور)'
      }
    }

    const ext = path.extname(filename).toLowerCase()
    const validExtensions: Record<string, string[]> = {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    }

    const expectedExts = validExtensions[cleanMime] || []
    if (!expectedExts.includes(ext)) {
      return {
        valid: false,
        error: `امتداد الملف (${ext}) لا يتطابق مع نوع المحتوى (${cleanMime})`
      }
    }

    return { valid: true }
  }

  /**
   * Lazily initializes and caches the S3Client instance for Cloudflare R2 / AWS S3.
   */
  private static getS3Client(): S3Client | null {
    const config = getStorageConfig()
    if (!config.isCloudConfigured) return null

    if (!cachedS3Client) {
      cachedS3Client = new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        credentials: {
          accessKeyId: config.accessKeyId!,
          secretAccessKey: config.secretAccessKey!
        }
      })
    }
    return cachedS3Client
  }

  /**
   * Uploads a file to Cloudflare R2 / AWS S3 or the local persistent storage fallback.
   */
  static async uploadFile(input: UploadInput): Promise<UploadedFileResult> {
    const config = getStorageConfig()
    const sanitizedName = this.sanitizeFilename(input.filename)
    const validation = this.validateFile(input.buffer.length, input.mimeType, sanitizedName)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const folder = (input.folder || 'documents').replace(/[^a-zA-Z0-9_-]/g, '')
    const randHex = Array.from(crypto.randomBytes(6)).map((b: number) => b.toString(16).padStart(2, '0')).join('')
    const uniquePrefix = `${Date.now()}-${randHex}`
    const storageKey = `${folder}/${uniquePrefix}-${sanitizedName}`

    const s3 = this.getS3Client()

    if (s3 && config.bucketName) {
      // Cloud Storage (Cloudflare R2 / AWS S3)
      await s3.send(
        new PutObjectCommand({
          Bucket: config.bucketName,
          Key: storageKey,
          Body: input.buffer,
          ContentType: input.mimeType,
          Metadata: {
            'original-filename': encodeURIComponent(sanitizedName),
            'uploaded-at': new Date().toISOString()
          }
        })
      )

      const file_url = config.publicUrl
        ? `${config.publicUrl.replace(/\/$/, '')}/${storageKey}`
        : `/api/files/${storageKey}`

      return {
        file_url,
        file_name: sanitizedName,
        file_size: input.buffer.length,
        mime_type: input.mimeType,
        storage_key: storageKey
      }
    } else {
      // Local Persistent Storage Fallback
      const targetPath = path.resolve(config.localUploadDir, storageKey)
      const targetDir = path.dirname(targetPath)
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }

      fs.writeFileSync(targetPath, Buffer.from(input.buffer))

      return {
        file_url: `/api/files/${storageKey}`,
        file_name: sanitizedName,
        file_size: input.buffer.length,
        mime_type: input.mimeType,
        storage_key: storageKey
      }
    }
  }

  /**
   * Retrieves a file for streaming or preview.
   */
  static async getFile(storageKey: string): Promise<FileDownloadResult | null> {
    const config = getStorageConfig()

    // Guard against directory traversal
    if (!storageKey || storageKey.includes('..') || path.isAbsolute(storageKey)) {
      throw new Error('مسار غير مصرح به')
    }

    const normalizedKey = path.normalize(storageKey).replace(/\\/g, '/')
    if (normalizedKey.includes('..') || path.isAbsolute(normalizedKey)) {
      throw new Error('مسار غير مصرح به')
    }

    const s3 = this.getS3Client()

    if (s3 && config.bucketName) {
      try {
        const response = await s3.send(
          new GetObjectCommand({
            Bucket: config.bucketName,
            Key: normalizedKey
          })
        )

        if (!response.Body) return null

        const bytes = await response.Body.transformToByteArray()
        const filename = this.sanitizeFilename(path.basename(normalizedKey))

        return {
          data: Buffer.from(bytes),
          mimeType: response.ContentType || 'application/octet-stream',
          filename,
          size: Number(response.ContentLength || bytes.length)
        }
      } catch (err: any) {
        if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
          return null
        }
        throw err
      }
    } else {
      // Local Persistent Storage Fallback
      const localPath = path.resolve(config.localUploadDir, normalizedKey)
      if (!fs.existsSync(localPath)) {
        return null
      }

      const data = fs.readFileSync(localPath)
      const ext = path.extname(localPath).toLowerCase()
      const mimes: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png'
      }

      return {
        data,
        mimeType: mimes[ext] || 'application/octet-stream',
        filename: path.basename(localPath),
        size: data.length
      }
    }
  }

  /**
   * Deletes a file from storage.
   */
  static async deleteFile(storageKey: string): Promise<boolean> {
    const config = getStorageConfig()
    const normalizedKey = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, '')
    const s3 = this.getS3Client()

    if (s3 && config.bucketName) {
      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: config.bucketName,
            Key: normalizedKey
          })
        )
        return true
      } catch {
        return false
      }
    } else {
      const localPath = path.resolve(config.localUploadDir, normalizedKey)
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath)
        return true
      }
      return false
    }
  }
}
