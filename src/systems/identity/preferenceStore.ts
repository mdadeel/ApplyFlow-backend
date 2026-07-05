import { User, IUserPreferences } from '../../models/User'
import { encrypt, decrypt } from '../../utils/encryption'
import { config } from '../../config'

/**
 * Encrypt all values under `updates.apiKeys` (if present) before persisting.
 * Returns a new object so we never mutate the caller-supplied input.
 */
function encryptApiKeys(updates: Partial<IUserPreferences>): Partial<IUserPreferences> {
  if (!updates.apiKeys || typeof updates.apiKeys !== 'object') {
    return updates
  }
  const encrypted: Record<string, string> = {}
  for (const [provider, value] of Object.entries(updates.apiKeys)) {
    if (typeof value !== 'string' || value.length === 0) continue
    encrypted[provider] = encrypt(value, config.jwtSecret)
  }
  return { ...updates, apiKeys: encrypted }
}

/**
 * Decrypt all values under `preferences.apiKeys` (if present) before returning.
 * Failures are tolerated: a malformed entry is dropped so a single bad row
 * cannot lock the user out of their preferences.
 */
function decryptApiKeys(preferences: IUserPreferences): IUserPreferences {
  if (!preferences.apiKeys || typeof preferences.apiKeys !== 'object') {
    return preferences
  }
  const decrypted: Record<string, string> = {}
  for (const [provider, value] of Object.entries(preferences.apiKeys)) {
    if (typeof value !== 'string' || value.length === 0) continue
    try {
      decrypted[provider] = decrypt(value, config.jwtSecret)
    } catch {
      // Skip undecryptable entries rather than throw — the user can re-save them.
    }
  }
  return { ...preferences, apiKeys: decrypted }
}

/**
 * Return a public-safe copy of preferences with `apiKeys` stripped entirely.
 * Use this when serializing to clients.
 */
export function redactApiKeys(preferences: IUserPreferences): Partial<IUserPreferences> {
  const { apiKeys: _apiKeys, ...safe } = preferences
  return safe
}

export async function getPreferences(userId: string): Promise<IUserPreferences> {
  const user = await User.findById(userId).select('preferences')
  if (!user) throw new Error('User not found')
  return decryptApiKeys(user.preferences)
}

export async function updatePreferences(userId: string, updates: Partial<IUserPreferences>): Promise<IUserPreferences> {
  const safeUpdates = encryptApiKeys(updates)

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: Object.fromEntries(Object.entries(safeUpdates).map(([k, v]) => [`preferences.${k}`, v])) },
    { new: true },
  ).select('preferences')
  if (!user) throw new Error('User not found')
  return decryptApiKeys(user.preferences)
}
