# 🏛️ Backend Architecture & Developer Handbook
**Legal Practice Management Platform (مكتب المحاماة)**  
*Engineered for Cloudflare Pages, Vercel Serverless, and Turso LibSQL.*

---

## 📑 Table of Contents
1. [Core Design Principles](#1-core-design-principles)
2. [Layered Architecture Overview](#2-layered-architecture-overview)
3. [Centralized Configuration (`src/config/env.ts`)](#3-centralized-configuration)
4. [Domain Exceptions & Centralized Error Handling](#4-domain-exceptions--error-handling)
5. [Query Builder & Server-Side Pagination (DRY Principle)](#5-query-builder--server-side-pagination)
6. [Object Storage Pipeline (R2 / S3 / Local Fallback)](#6-object-storage-pipeline)
7. [5-Minute Developer Quickstart: Adding a New Endpoint](#7-5-minute-developer-quickstart)
8. [Quality Gates & Automated Verification](#8-quality-gates--verification)

---

## 1. Core Design Principles

- **Zero In-Memory Volatility**: Serverless instances recycle frequently; state is strictly persisted to Turso LibSQL (remote) or SQLite files (local development).
- **Strict Layer Separation**: Handlers do not write raw SQL; Services do not touch HTTP responses; Routes only coordinate authentication, validation, and serialization.
- **DRY (Don't Repeat Yourself)**: Shared pagination math, wildcard escaping, count aggregation, and file validation logic are extracted into reusable utilities.
- **Fail Fast & Explicitly**: Inputs are validated at the perimeter with strongly-typed guards before reaching domain services.
- **Backward Compatibility**: API consumers receive standardized envelopes while legacy consumers continue to receive raw array responses via `all=1`.

---

## 2. Layered Architecture Overview

The backend follows a strict 4-tier layered architecture:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. HTTP Routing & Middleware Layer                          │
│    - Hono Router (src/routes/*.ts)                          │
│    - Security Headers, CORS, Auth Guard (requireUser)       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Validation & DTO Layer                                   │
│    - Request Guards (src/utils/validators.ts)               │
│    - Type Contracts (DTOs) & Constraint Assertions          │
│    - HTTP 400 with Structured Issue Details                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Domain Services Layer                                    │
│    - Business Logic (src/services/*.service.ts)             │
│    - SqlQueryBuilder (src/utils/query-builder.ts)           │
│    - Domain Exceptions (ValidationError, NotFoundError)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Infrastructure & Persistence Layer                       │
│    - Database Connection: Turso LibSQL / D1 (src/db/*)      │
│    - Object Storage: Cloudflare R2 / S3 / Local (src/storage)│
│    - Environment Configuration (src/config/env.ts)          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Centralized Configuration

All environment variables are parsed, typed, validated, and frozen in [`src/config/env.ts`](file:///W:/code%20help/%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/%D9%88%D9%8A%D8%A8%20%D9%85%D9%83%D8%AA%D8%A8%20%D9%85%D8%AD%D8%A7%D9%85%D9%8A1/genspark-cb675597-3730-4d0a-afdf-fd16edb52fb1-main/src/config/env.ts).

```typescript
import { config } from '../config/env'

// Access typed configuration properties safely:
const dbUrl = config.database.url
const isCloud = config.storage.isCloudConfigured
```

### Key Safety Guarantees:
- **No naked `process.env` calls**: Eliminates typos, undefined access, and platform discrepancies (Node vs Cloudflare Workers).
- **Environment Validation**: `validateEnvironment()` verifies the presence of required production credentials (`TURSO_DATABASE_URL`, `R2_BUCKET_NAME`, etc.).
- **Local Fallback**: Automatically defaults to local `./data/law_firm.db` and `./data/uploads` when cloud credentials are omitted, enabling seamless local test execution.

---

## 4. Domain Exceptions & Error Handling

Defined in [`src/utils/errors.ts`](file:///W:/code%20help/%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/%D9%88%D9%8A%D8%A8%20%D9%85%D9%83%D8%AA%D8%A8%20%D9%85%D8%AD%D8%A7%D9%85%D9%8A1/genspark-cb675597-3730-4d0a-afdf-fd16edb52fb1-main/src/utils/errors.ts) and caught by `app.onError` in [`src/app.ts`](file:///W:/code%20help/%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/%D9%88%D9%8A%D8%A8%20%D9%85%D9%83%D8%AA%D8%A8%20%D9%85%D8%AD%D8%A7%D9%85%D9%8A1/genspark-cb675597-3730-4d0a-afdf-fd16edb52fb1-main/src/app.ts):

| Exception Class | HTTP Status | Purpose | Example Response |
| :--- | :--- | :--- | :--- |
| `ValidationError` | 400 | Invalid payload / missing fields | `{"error": "...", "details": [...]}` |
| `AuthenticationError`| 401 | Missing or expired session | `{"error": "جلسة العمل غير صالحة"}` |
| `ForbiddenError` | 403 | Insufficient RBAC privileges | `{"error": "ليس لديك الصلاحية"}` |
| `NotFoundError` | 404 | Resource does not exist | `{"error": "المورد غير موجود"}` |
| `ConflictError` | 409 | Duplicate unique constraint | `{"error": "البريد مسجل مسبقاً"}` |

### Protection Against Stack Leaks:
`app.onError` catches all unhandled exceptions, logs them internally, and returns a sanitized generic error (`حدث خطأ غير متوقع في الخادم`, HTTP 500) to external clients in production.

---

## 5. Query Builder & Server-Side Pagination (DRY)

Dynamic filtering, count generation, and pagination are abstracted in [`src/utils/query-builder.ts`](file:///W:/code%20help/%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/%D9%88%D9%8A%D8%A8%20%D9%85%D9%83%D8%AA%D8%A8%20%D9%85%D8%AD%D8%A7%D9%85%D9%8A1/genspark-cb675597-3730-4d0a-afdf-fd16edb52fb1-main/src/utils/query-builder.ts).

### Using `SqlQueryBuilder`:
```typescript
import { SqlQueryBuilder } from '../utils/query-builder'
import { parsePaginationParams } from '../utils/pagination'

const { page, limit, offset, search } = parsePaginationParams(params)

const qb = new SqlQueryBuilder()
  .whereSearch(['c.title', 'c.case_no', 'cl.name'], search)
  .whereIf('c.status = ?', status, status)
  .whereIf('c.lead_lawyer_id = ?', lawyerId, Number(lawyerId))

return SqlQueryBuilder.executePaginated(db, {
  fromClause: 'cases c JOIN clients cl ON cl.id = c.client_id',
  selectColumns: 'c.*, cl.name AS client_name',
  whereBuilder: qb,
  orderBy: 'c.created_at DESC',
  page,
  limit,
  offset
})
```

### Standardized Response Envelope:
```json
{
  "data": [ ... ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasMore": true
  }
}
```

---

## 6. Object Storage Pipeline

The document pipeline ([`src/storage/service.ts`](file:///W:/code%20help/%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/%D9%88%D9%8A%D8%A8%20%D9%85%D9%83%D8%AA%D8%A8%20%D9%85%D8%AD%D8%A7%D9%85%D9%8A1/genspark-cb675597-3730-4d0a-afdf-fd16edb52fb1-main/src/storage/service.ts)) operates with dual-mode storage:
1. **Cloud Mode**: Uploads to S3-compatible storage (Cloudflare R2, AWS S3) using `@aws-sdk/client-s3`.
2. **Local Fallback Mode**: Writes to `./data/uploads` if cloud credentials are absent, ensuring offline and test suite functionality.

Security features:
- Path traversal sanitization (`../` removed, filenames sanitized).
- Max file size enforcement (15MB).
- Strict MIME type verification (`application/pdf`, `image/jpeg`, `image/png`).

---

## 7. 5-Minute Developer Quickstart

Follow this recipe to add a new endpoint or query in under 5 minutes:

### Step 1: Define DTO & Validation Guard ([`src/utils/validators.ts`](file:///W:/code%20help/%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/%D9%88%D9%8A%D8%A8%20%D9%85%D9%83%D8%AA%D8%A8%20%D9%85%D8%AD%D8%A7%D9%85%D9%8A1/genspark-cb675597-3730-4d0a-afdf-fd16edb52fb1-main/src/utils/validators.ts))
```typescript
export interface CreateTagDTO {
  name: string
  color?: string
}

export function validateCreateTag(data: any): ValidationResult<CreateTagDTO> {
  const errors: ValidationIssue[] = []
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    errors.push({ field: 'name', message: 'اسم الوسم إجباري' })
  }
  if (errors.length > 0) return { success: false, errors }
  return { success: true, data: { name: data.name.trim(), color: data.color } }
}
```

### Step 2: Implement Domain Service Method ([`src/services/tags.service.ts`](file:///W:/code%20help/%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/%D9%88%D9%8A%D8%A8%20%D9%85%D9%83%D8%AA%D8%A8%20%D9%85%D8%AD%D8%A7%D9%85%D9%8A1/genspark-cb675597-3730-4d0a-afdf-fd16edb52fb1-main/src/services/))
```typescript
import { SqlQueryBuilder } from '../utils/query-builder'
import { parsePaginationParams, PaginatedResponse } from '../utils/pagination'

export class TagsService {
  static async getPaginatedTags(db: D1Database, params: any = {}): Promise<PaginatedResponse<any>> {
    const { page, limit, offset, search } = parsePaginationParams(params)
    const qb = new SqlQueryBuilder().whereSearch(['name'], search)

    return SqlQueryBuilder.executePaginated(db, {
      fromClause: 'tags',
      selectColumns: '*',
      whereBuilder: qb,
      orderBy: 'name ASC',
      page,
      limit,
      offset
    })
  }
}
```

### Step 3: Wire Controller Route ([`src/routes/tags.ts`](file:///W:/code%20help/%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/%D9%88%D9%8A%D8%A8%20%D9%85%D9%83%D8%AA%D8%A8%20%D9%85%D8%AD%D8%A7%D9%85%D9%8A1/genspark-cb675597-3730-4d0a-afdf-fd16edb52fb1-main/src/routes/))
```typescript
import { Hono } from 'hono'
import { requireUser } from '../middleware/auth'
import { TagsService } from '../services/tags.service'
import { AppContext } from '../types'

export const tagRoutes = new Hono<AppContext>()

tagRoutes.get('/tags', async (c) => {
  const user = await requireUser(c)
  if (user instanceof Response) return user

  const result = await TagsService.getPaginatedTags(c.env.DB, c.req.query())
  return c.json(result)
})
```

### Step 4: Mount in Main Application ([`src/app.ts`](file:///W:/code%20help/%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/%D9%88%D9%8A%D8%A8%20%D9%85%D9%83%D8%AA%D8%A8%20%D9%85%D8%AD%D8%A7%D9%85%D9%8A1/genspark-cb675597-3730-4d0a-afdf-fd16edb52fb1-main/src/app.ts))
```typescript
import { tagRoutes } from './routes/tags'

app.route('/api', tagRoutes)
```

---

## 8. Quality Gates & Verification

All code changes must pass the 3 mandatory quality gates:

```bash
# Gate 1: Type Checking (0 errors)
npm run typecheck

# Gate 2: Full Test Suite (129/129 tests passing 100%)
npm test

# Gate 3: Production Serverless Build
npm run build
```

---
*Maintained by the Principal Architecture & Engineering Team.*
