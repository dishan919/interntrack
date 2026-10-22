import { randomUUID } from 'node:crypto'
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const profilePhotoDirectory = fileURLToPath(new URL('../../uploads/profile-photos/', import.meta.url))
const filenamePattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp$/
export const isManagedPhoto = reference => typeof reference === 'string' && filenamePattern.test(reference)
export const photoUrl = reference => isManagedPhoto(reference) ? `/api/profile-photos/${reference}` : undefined

/** Storage contract: save(Buffer) -> opaque reference; remove(reference); read(reference) -> Buffer.
 * References and public API URLs stay stable when the storage strategy changes.
 * Invalid references must never reach the underlying storage.
 */
export class LocalPhotoStorage {
  constructor(directory = profilePhotoDirectory) { this.directory = path.resolve(directory) }
  async save(buffer) {
    const reference = `${randomUUID()}.webp`
    await mkdir(this.directory, { recursive: true })
    const target = path.join(this.directory, reference)
    try { await writeFile(target, buffer, { flag: 'wx', mode: 0o600 }) }
    catch (error) {
      // A failed write may leave a partial file. Never unlink a preexisting file.
      if (error.code !== 'EEXIST') await this.remove(reference).catch(() => {})
      throw error
    }
    return reference
  }
  async remove(reference) {
    if (!isManagedPhoto(reference)) return
    try { await unlink(path.join(this.directory, reference)) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  async read(reference) {
    if (!isManagedPhoto(reference)) throw Object.assign(new Error('Photo not found'), { code: 'ENOENT' })
    return readFile(path.join(this.directory, reference))
  }
}

// Composition point: a future S3 strategy implements the same three operations.
export function createProfilePhotoStorage(strategy) {
  return {
    save: buffer => strategy.save(buffer),
    remove: reference => isManagedPhoto(reference) ? strategy.remove(reference) : Promise.resolve(),
    read: reference => {
      if (!isManagedPhoto(reference)) return Promise.reject(Object.assign(new Error('Photo not found'), { code: 'ENOENT' }))
      return strategy.read(reference)
    },
  }
}
export const profilePhotoStorage = createProfilePhotoStorage(new LocalPhotoStorage())
export const saveProfilePhoto = buffer => profilePhotoStorage.save(buffer)
export const removeProfilePhoto = reference => profilePhotoStorage.remove(reference)
