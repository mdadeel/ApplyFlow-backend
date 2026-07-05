import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16
const KEY_LENGTH = 32

/**
 * Derive a 32-byte AES-256 key from an arbitrary-length secret by hashing it
 * with SHA-256. This lets us accept the JWT secret (which may be any length)
 * while satisfying AES-256's fixed key size.
 */
function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret, 'utf8').digest()
}

/**
 * Encrypt a plaintext string using AES-256-CBC.
 *
 * Output format: `<iv-hex>:<ciphertext-hex>`
 * - IV: 16 random bytes per encryption (hex)
 * - Ciphertext: AES-256-CBC output (hex)
 */
export function encrypt(text: string, secret: string): string {
  if (typeof text !== 'string') {
    throw new TypeError('encrypt: text must be a string')
  }
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error('encrypt: secret must be a non-empty string')
  }

  const key = deriveKey(secret)
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypt a string produced by `encrypt`. Throws if the input is malformed
 * or if decryption fails (which can indicate tampering or a wrong key).
 */
export function decrypt(encrypted: string, secret: string): string {
  if (typeof encrypted !== 'string' || !encrypted.includes(':')) {
    throw new Error('decrypt: invalid ciphertext format')
  }
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error('decrypt: secret must be a non-empty string')
  }

  const [ivHex, ciphertextHex] = encrypted.split(':', 2)
  if (!ivHex || !ciphertextHex) {
    throw new Error('decrypt: invalid ciphertext format')
  }
  if (ivHex.length !== IV_LENGTH * 2) {
    throw new Error('decrypt: invalid IV length')
  }

  const key = deriveKey(secret)
  const iv = Buffer.from(ivHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}
