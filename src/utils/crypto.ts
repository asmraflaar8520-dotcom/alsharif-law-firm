/**
 * Cryptographic helpers for password hashing and token generation
 * Uses Web Crypto API (PBKDF2 with SHA-256, 100,000 iterations and 16-byte random salt)
 */

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function generateToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  const iterations = 100000

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 32 bytes
  )

  const saltHex = [...salt].map((b) => b.toString(16).padStart(2, '0')).join('')
  const hashHex = [...new Uint8Array(derivedBits)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${iterations}$${saltHex}$${hashHex}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored || !password) return false

  // Handle PBKDF2 format: iterations$saltHex$hashHex
  if (stored.includes('$')) {
    const parts = stored.split('$')
    if (parts.length !== 3) return false
    const iterations = parseInt(parts[0], 10)
    const saltHex = parts[1]
    const expectedHashHex = parts[2]

    if (isNaN(iterations) || !saltHex || !expectedHashHex) return false

    const matches = saltHex.match(/.{1,2}/g)
    if (!matches) return false
    const salt = new Uint8Array(matches.map((byte) => parseInt(byte, 16)))

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    )

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    )

    const computedHashHex = [...new Uint8Array(derivedBits)].map((b) => b.toString(16).padStart(2, '0')).join('')

    // Constant-time comparison to prevent timing attacks
    if (computedHashHex.length !== expectedHashHex.length) return false
    let diff = 0
    for (let i = 0; i < computedHashHex.length; i++) {
      diff |= computedHashHex.charCodeAt(i) ^ expectedHashHex.charCodeAt(i)
    }
    return diff === 0
  }

  // Fallback for legacy plain SHA-256
  const legacyHash = await sha256(password)
  if (legacyHash.length !== stored.length) return false
  let diff = 0
  for (let i = 0; i < legacyHash.length; i++) {
    diff |= legacyHash.charCodeAt(i) ^ stored.charCodeAt(i)
  }
  return diff === 0
}
