/**
 * Centralized, Strongly-Typed Application Environment Configuration
 * Provides validated runtime settings, environment guards, and safe fallbacks.
 */

export interface DatabaseEnvConfig {
  readonly url?: string
  readonly authToken?: string
  readonly localPath: string
  readonly isRemote: boolean
}

export interface StorageEnvConfig {
  readonly bucketName?: string
  readonly accessKeyId?: string
  readonly secretAccessKey?: string
  readonly endpoint?: string
  readonly region: string
  readonly publicUrl?: string
  readonly isCloudConfigured: boolean
}

export interface AppConfig {
  readonly nodeEnv: 'development' | 'production' | 'test'
  readonly isProduction: boolean
  readonly isTest: boolean
  readonly port: number
  readonly database: DatabaseEnvConfig
  readonly storage: StorageEnvConfig
}

function getRawEnv(key: string): string | undefined {
  const p = (globalThis as any).process?.env
  if (!p) return undefined
  const val = p[key]
  return typeof val === 'string' ? val.trim() : undefined
}

/**
 * Validates and loads application configuration.
 */
export function loadAppConfig(): AppConfig {
  const rawNodeEnv = getRawEnv('NODE_ENV') || 'development'
  const nodeEnv: 'development' | 'production' | 'test' =
    rawNodeEnv === 'production' || rawNodeEnv === 'test' ? rawNodeEnv : 'development'

  const rawPort = getRawEnv('PORT')
  const port = rawPort ? parseInt(rawPort, 10) : 3000

  // Database credentials & fallbacks
  const remoteUrl = getRawEnv('TURSO_DATABASE_URL') || getRawEnv('DATABASE_URL') || getRawEnv('LIBSQL_URL')
  const authToken = getRawEnv('TURSO_AUTH_TOKEN') || getRawEnv('DATABASE_AUTH_TOKEN')
  const localPath = getRawEnv('SQLITE_PATH') || getRawEnv('DATABASE_PATH') || './data/law_firm.db'
  const isRemote = Boolean(remoteUrl && !remoteUrl.startsWith('file:'))

  // Object Storage credentials & fallbacks
  const bucketName = getRawEnv('R2_BUCKET_NAME') || getRawEnv('S3_BUCKET_NAME') || getRawEnv('AWS_S3_BUCKET')
  const accessKeyId = getRawEnv('R2_ACCESS_KEY_ID') || getRawEnv('AWS_ACCESS_KEY_ID')
  const secretAccessKey = getRawEnv('R2_SECRET_ACCESS_KEY') || getRawEnv('AWS_SECRET_ACCESS_KEY')
  const accountId = getRawEnv('R2_ACCOUNT_ID')
  const endpoint = getRawEnv('R2_ENDPOINT') || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : getRawEnv('S3_ENDPOINT'))
  const region = getRawEnv('AWS_REGION') || getRawEnv('R2_REGION') || 'auto'
  const publicUrl = getRawEnv('R2_PUBLIC_URL') || getRawEnv('S3_PUBLIC_URL')
  const isCloudConfigured = Boolean(bucketName && accessKeyId && secretAccessKey)

  return Object.freeze({
    nodeEnv,
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
    port: isNaN(port) ? 3000 : port,
    database: Object.freeze({
      url: remoteUrl,
      authToken,
      localPath,
      isRemote
    }),
    storage: Object.freeze({
      bucketName,
      accessKeyId,
      secretAccessKey,
      endpoint,
      region,
      publicUrl,
      isCloudConfigured
    })
  })
}

/**
 * Validates presence of required variables for specific environments.
 * Throws informative error if mandatory production variables are missing.
 */
export function validateEnvironment(cfg: AppConfig = loadAppConfig()): { valid: boolean; issues: string[] } {
  const issues: string[] = []

  if (cfg.database.isRemote && !cfg.database.url) {
    issues.push('Remote database URL is missing but remote mode was flagged.')
  }

  if (cfg.storage.isCloudConfigured) {
    if (!cfg.storage.bucketName) issues.push('R2/S3 Bucket name is missing.')
    if (!cfg.storage.accessKeyId) issues.push('R2/S3 Access Key ID is missing.')
    if (!cfg.storage.secretAccessKey) issues.push('R2/S3 Secret Access Key is missing.')
  }

  return {
    valid: issues.length === 0,
    issues
  }
}

export const config = loadAppConfig()
export const env = config
