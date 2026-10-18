import { Hono } from 'hono'
import { requireUser, getCurrentUser } from '../middleware/auth'
import { DocumentsService } from '../services/documents.service'
import { StorageService } from '../storage'
import { AppContext, User } from '../types'
import { validateFileUploadMetadata } from '../utils/validators'

export const documentRoutes = new Hono<AppContext>()

/**
 * POST /api/upload
 * Controller uploading a document or POA scan to Cloudflare R2 / S3 or persistent storage fallback
 */
documentRoutes.post('/upload', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  try {
    const contentType = c.req.header('content-type') || ''
    let buffer: Buffer | null = null
    let filename = ''
    let mimeType = ''
    let folder = 'documents'

    if (contentType.includes('application/json')) {
      const body = await c.req.json().catch(() => ({}))
      if (!body.base64 || !body.filename) {
        return c.json({ error: 'يرجى تقديم محتوى الملف بصيغة base64 واسم الملف' }, 400)
      }
      buffer = Buffer.from(body.base64, 'base64')
      filename = body.filename
      mimeType = body.mime_type || body.mimeType || 'application/pdf'
      folder = body.folder || 'documents'
    } else {
      const body = await c.req.parseBody()
      const rawFile = body['file']
      if (!rawFile || !(rawFile instanceof File)) {
        return c.json({ error: 'لم يتم توفير أي ملف للرفع' }, 400)
      }
      const arrayBuf = await rawFile.arrayBuffer()
      buffer = Buffer.from(arrayBuf)
      filename = rawFile.name
      mimeType = rawFile.type || 'application/octet-stream'
      folder = typeof body['folder'] === 'string' ? body['folder'] : 'documents'
    }

    if (!buffer) {
      return c.json({ error: 'لم يتم توفير أي ملف للرفع' }, 400)
    }

    const validation = validateFileUploadMetadata({
      filename,
      mimeType,
      size: buffer.length,
      folder
    })

    if (!validation.success) {
      return c.json({
        error: validation.errors?.[0]?.message || 'بيانات الملف غير صالحة',
        details: validation.errors
      }, 400)
    }

    const uploaded = await StorageService.uploadFile({
      buffer,
      filename: validation.data!.filename,
      mimeType: validation.data!.mimeType,
      folder: validation.data!.folder
    })

    return c.json(uploaded, 201)
  } catch (err: any) {
    return c.json({
      error: err.message || 'فشل رفع الملف',
      ...(err.details ? { details: err.details } : {})
    }, 400)
  }
})

/**
 * GET /api/files/:folder/:filename
 * Streaming & preview endpoint for stored files
 */
documentRoutes.get('/files/:folder/:filename', async (c) => {
  const user = await getCurrentUser(c)
  if (!user) {
    return c.json({ error: 'غير مصرح للوصول إلى هذا الملف' }, 401)
  }

  const folder = c.req.param('folder')
  const filename = c.req.param('filename')
  const storageKey = `${folder}/${filename}`

  try {
    const fileResult = await StorageService.getFile(storageKey)
    if (!fileResult) {
      return c.json({ error: 'الملف غير موجود' }, 404)
    }

    const isDownload = c.req.query('download') === '1'
    const disposition = isDownload ? 'attachment' : 'inline'

    return new Response(new Uint8Array(fileResult.data), {
      headers: {
        'Content-Type': fileResult.mimeType,
        'Content-Length': String(fileResult.size),
        'Content-Disposition': `${disposition}; filename="${encodeURIComponent(fileResult.filename)}"`,
        'Cache-Control': 'private, max-age=3600'
      }
    })
  } catch (err: any) {
    return c.json({ error: err.message || 'تعذر جلب الملف' }, 400)
  }
})

/**
 * DELETE /api/files/:folder/:filename
 * Removes file from storage
 */
documentRoutes.delete('/files/:folder/:filename', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const folder = c.req.param('folder')
  const filename = c.req.param('filename')
  const storageKey = `${folder}/${filename}`

  try {
    const deleted = await StorageService.deleteFile(storageKey)
    return c.json({ ok: deleted })
  } catch (err: any) {
    return c.json({ error: err.message || 'تعذر حذف الملف' }, 400)
  }
})

/**
 * GET /api/documents
 * Controller listing uploaded documents with pagination and filters
 */
documentRoutes.get('/documents', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const query = c.req.query()
  const result = await DocumentsService.getPaginatedDocuments(c.env.DB, query)
  if (query.all === 'true' || query.all === '1' || query.raw === 'true') {
    return c.json(result.data)
  }
  return c.json(result)
})

/**
 * GET /api/documents/:id
 * Controller fetching a single document record
 */
documentRoutes.get('/documents/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const doc = await DocumentsService.getDocumentById(c.env.DB, c.req.param('id'))
  if (!doc) {
    return c.json({ error: 'المستند غير موجود' }, 404)
  }
  return c.json(doc)
})

/**
 * POST /api/documents
 * Controller creating a new document record
 */
documentRoutes.post('/documents', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    const id = await DocumentsService.createDocument(c.env.DB, body, (user as User).id)
    return c.json({ id })
  } catch (err: any) {
    return c.json({ error: err.message, ...(err.details ? { details: err.details } : {}) }, 400)
  }
})

/**
 * GET /api/poas
 * Controller listing powers of attorney
 */
documentRoutes.get('/poas', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const poas = await DocumentsService.getPoas(c.env.DB)
  return c.json(poas)
})

/**
 * GET /api/poas/:id
 * Controller fetching a single POA
 */
documentRoutes.get('/poas/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const poa = await DocumentsService.getPoaById(c.env.DB, c.req.param('id'))
  if (!poa) {
    return c.json({ error: 'التوكيل غير موجود' }, 404)
  }
  return c.json(poa)
})

/**
 * POST /api/poas
 * Controller registering a new Power of Attorney
 */
documentRoutes.post('/poas', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    const id = await DocumentsService.createPoa(c.env.DB, body, (user as User).id)
    return c.json({ id })
  } catch (err: any) {
    return c.json({ error: err.message, ...(err.details ? { details: err.details } : {}) }, 400)
  }
})

/**
 * PUT /api/poas/:id
 * Controller updating power of attorney record
 */
documentRoutes.put('/poas/:id', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    await DocumentsService.updatePoa(c.env.DB, c.req.param('id'), body, (user as User).id)
    return c.json({ ok: true })
  } catch (err: any) {
    const status: 400 | 404 = err.message === 'التوكيل غير موجود' ? 404 : 400
    return c.json({ error: err.message, ...(err.details ? { details: err.details } : {}) }, status)
  }
})

/**
 * POST /api/notes
 * Controller appending memo or quick note
 */
documentRoutes.post('/notes', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const body = await c.req.json().catch(() => ({}))
  try {
    const id = await DocumentsService.createNote(c.env.DB, body, (user as User).id)
    return c.json({ id })
  } catch (err: any) {
    return c.json({ error: err.message, ...(err.details ? { details: err.details } : {}) }, 400)
  }
})

