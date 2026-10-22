import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { LocalPhotoStorage, createProfilePhotoStorage, isManagedPhoto } from '../src/services/profilePhotoStorage.js'

test('storage contract supports a substitute strategy without filesystem dependencies', async () => {
  const ref = '12345678-1234-4123-8123-123456789abc.webp'
  const objects = new Map()
  const storage = createProfilePhotoStorage({
    async save(bytes) { objects.set(ref, bytes); return ref },
    async read(key) { return objects.get(key) },
    async remove(key) { objects.delete(key) },
  })
  const bytes = Buffer.from('image')
  assert.equal(await storage.save(bytes), ref)
  assert.deepEqual(await storage.read(ref), bytes)
  await storage.remove('../outside')
  assert.equal(objects.size, 1)
  await assert.rejects(storage.read('../outside'), { code: 'ENOENT' })
  await storage.remove(ref)
  assert.equal(objects.size, 0)
})

test('local strategy isolates generated files and rejects traversal and absolute paths', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'interntrack-photos-'))
  try {
    const sentinel = path.join(root, 'outside.webp')
    await writeFile(sentinel, 'keep')
    const storage = new LocalPhotoStorage(path.join(root, 'managed'))
    const ref = await storage.save(Buffer.from('photo'))
    assert.ok(isManagedPhoto(ref))
    for (const invalid of ['../outside.webp', sentinel, '..\\outside.webp', '%2e%2e%2foutside.webp', ref + '/..']) {
      await storage.remove(invalid)
      await assert.rejects(storage.read(invalid), { code: 'ENOENT' })
    }
    assert.equal(await readFile(sentinel, 'utf8'), 'keep')
    assert.equal((await storage.read(ref)).toString(), 'photo')
    await storage.remove(ref)
    await storage.remove(ref)
    await assert.rejects(storage.read(ref), { code: 'ENOENT' })
  } finally { await rm(root, { recursive: true, force: true }) }
})
