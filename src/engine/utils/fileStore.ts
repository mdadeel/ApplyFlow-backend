/**
 * FileStore — Simple JSON file persistence for in-memory stores.
 *
 * Saves and loads JSON-serializable data to/from the backend data directory.
 * Each store gets its own file within the .data/ subdirectory.
 * Files are written atomically (write to temp, then rename).
 */

import * as fs from 'fs'
import * as path from 'path'

const DATA_DIR = process.env.APPLYFLOW_DATA_DIR || path.join(process.cwd(), '.data')

/** Ensure the data directory exists. */
function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

/** Build the full path for a given store name. */
function storePath(name: string): string {
  return path.join(DATA_DIR, `${name}.json`)
}

/**
 * Save JSON-serializable data to a file atomically.
 *
 * @param name - Logical store name (e.g. 'metrics', 'analytics', 'feedback')
 * @param data - JSON-serializable data to persist
 */
export function saveJSON(name: string, data: unknown): void {
  try {
    ensureDir()
    const targetPath = storePath(name)
    const tmpFile = targetPath + '.tmp'
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8')
    fs.renameSync(tmpFile, targetPath)
  } catch (err) {
    console.error(`[FileStore] Failed to save "${name}":`, (err as Error).message)
  }
}

/**
 * Load JSON-serializable data from a file.
 *
 * @param name - Logical store name
 * @param fallback - Default value returned if file does not exist or is corrupt
 * @returns Parsed data or the fallback value
 */
export function loadJSON<T>(name: string, fallback: T): T {
  try {
    const filePath = storePath(name)
    if (!fs.existsSync(filePath)) return fallback
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch (err) {
    console.error(`[FileStore] Failed to load "${name}":`, (err as Error).message)
    return fallback
  }
}

/**
 * Check if a persisted file exists for the given store name.
 */
export function hasStore(name: string): boolean {
  return fs.existsSync(storePath(name))
}

/**
 * Delete a persisted file for the given store name.
 */
export function deleteStore(name: string): void {
  try {
    const filePath = storePath(name)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (err) {
    console.error(`[FileStore] Failed to delete "${name}":`, (err as Error).message)
  }
}

export { DATA_DIR }
