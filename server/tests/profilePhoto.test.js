import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { once } from 'node:events'
import { readFile, access, readdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import jwt from 'jsonwebtoken'
import app from '../src/app.js'
import User from '../src/models/User.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { profilePhotoDirectory, removeProfilePhoto, isManagedPhoto, profilePhotoStorage } from '../src/services/profilePhotoStorage.js'
import { startTestDatabase } from './helpers/database.js'

let database, server, base, a, b, tokenA, tokenB
const originalSecret = process.env.JWT_SECRET
const secret = 'disposable-profile-photo-test-secret'
const password = 'ProfilePassword123'
const images = {}
const references = new Set()
const tokenFor = user => jwt.sign({ sub: user.id }, secret, { expiresIn: '1h' })
const reference = user => user.profilePhotoUrl?.split('/').at(-1)
async function upload(buffer = images.png, type = 'image/png', token = tokenA, extra, filename = 'photo.png') {
  const body = new FormData()
  body.append('photo', new Blob([buffer], { type }), filename)
  if (extra) body.append('userId', extra)
  const response = await fetch(`${base}/api/auth/me/photo`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body })
  const data = await response.json()
  if (data.user?.profilePhotoUrl) references.add(reference(data.user))
  return { response, data }
}
const remove = (token = tokenA, body) => fetch(`${base}/api/auth/me/photo`, { method: 'DELETE', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
before(async () => {
  process.env.JWT_SECRET = secret
  database = await startTestDatabase()
  await connectDatabase(database.getUri())
  a = await User.create({ name: 'Photo A', email: 'photo-a@example.com', password })
  b = await User.create({ name: 'Photo B', email: 'photo-b@example.com', password })
  tokenA = tokenFor(a); tokenB = tokenFor(b)
  for (const format of ['jpeg', 'png', 'webp']) images[format] = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#6d5dfb' } }).toFormat(format).toBuffer()
  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  for (const ref of references) await removeProfilePhoto(ref)
  if (server) await new Promise(resolve => server.close(resolve))
  await disconnectDatabase()
  if (database) await database.stop()
  if (originalSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalSecret
})

test('JPEG/PNG/WebP uploads decode, reencode, return safe current user and safely replace previous file', async () => {
  let previous
  for (const [format, type] of [['jpeg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp']]) {
    const { response, data } = await upload(images[format], type, tokenA, null, '../../private-secret.exe')
    assert.equal(response.status, 200)
    assert.deepEqual(Object.keys(data.user).sort(), ['email', 'emailVerified', 'id', 'name', 'profilePhotoUrl'])
    assert.equal(data.user.id, a.id)
    const ref = reference(data.user)
    assert.ok(isManagedPhoto(ref))
    assert.notEqual(ref, previous)
    const stored = await User.collection.findOne({ _id: a._id })
    assert.equal(stored.profilePhoto, ref)
    assert.equal(typeof stored.profilePhoto, 'string')
    const bytes = await readFile(path.join(profilePhotoDirectory, ref))
    assert.equal((await sharp(bytes).metadata()).format, 'webp')
    assert.equal((await User.findById(a.id)).toJSON().profilePhoto, undefined)
    if (previous) await assert.rejects(access(path.join(profilePhotoDirectory, previous)), { code: 'ENOENT' })
    const served = await fetch(base + data.user.profilePhotoUrl)
    assert.equal(served.status, 200)
    assert.match(served.headers.get('content-type'), /image\/webp/)
    assert.equal(served.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(served.headers.get('cache-control'), 'no-store')
    assert.deepEqual(Buffer.from(await served.arrayBuffer()), bytes)
    const me = await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${tokenA}` } })
    assert.equal((await me.json()).user.profilePhotoUrl, data.user.profilePhotoUrl)
    previous = ref
  }
})

test('unauthenticated, invalid, expired and deleted-account uploads/removals are rejected', async () => {
  for (const token of [null, 'invalid', jwt.sign({ sub: a.id }, secret, { expiresIn: -1 }), jwt.sign({ sub: '0123456789abcdef01234567' }, secret, { expiresIn: '1h' })]) {
    assert.equal((await upload(images.png, 'image/png', token)).response.status, 401)
    assert.equal((await remove(token)).status, 401)
  }
})

test('unsupported, mislabeled, corrupt, truncated, empty and oversized uploads preserve current photo', async () => {
  const before = (await User.findById(a.id)).profilePhoto
  for (const [bytes, type, status] of [
    [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml', 400],
    [Buffer.from('<script>private</script>'), 'image/png', 400],
    [images.png, 'image/jpeg', 400], [images.jpeg, 'application/octet-stream', 400],
    [images.png.subarray(0, 25), 'image/png', 400], [Buffer.alloc(0), 'image/png', 400],
    [Buffer.alloc(2 * 1024 * 1024 + 1), 'image/png', 413],
  ]) {
    const result = await upload(bytes, type)
    assert.equal(result.response.status, status)
    assert.doesNotMatch(JSON.stringify(result.data), /stack|uploads|private|password|token/i)
    assert.equal((await User.findById(a.id)).profilePhoto, before)
  }
})

test('missing file, malformed multipart, extra identity fields and multiple files fail safely', async () => {
  assert.equal((await upload(images.png, 'image/png', tokenA, b.id)).response.status, 400)
  for (const options of [
    { body: new FormData() },
    { headers: { 'Content-Type': 'multipart/form-data' }, body: 'broken' },
    { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: b.id, photo: 'forged' }) },
  ]) {
    const response = await fetch(`${base}/api/auth/me/photo`, { method: 'POST', ...options, headers: { Authorization: `Bearer ${tokenA}`, ...options.headers } })
    assert.equal(response.status, 400)
  }
  const body = new FormData()
  body.append('photo', new Blob([images.png], { type: 'image/png' }), 'one.png')
  body.append('photo', new Blob([images.png], { type: 'image/png' }), 'two.png')
  assert.equal((await fetch(`${base}/api/auth/me/photo`, { method: 'POST', body, headers: { Authorization: `Bearer ${tokenA}` } })).status, 400)
  assert.equal((await remove(tokenA, { userId: b.id })).status, 400)
  assert.equal((await User.findById(b.id)).profilePhoto, undefined)
})

test('photo ownership cannot be redirected and another account removal leaves A photo untouched', async () => {
  const aRef = (await User.findById(a.id)).profilePhoto
  const result = await upload(images.jpeg, 'image/jpeg', tokenB)
  assert.equal(result.response.status, 200)
  assert.equal(result.data.user.id, b.id)
  assert.equal((await User.findById(a.id)).profilePhoto, aRef)
  assert.equal((await remove(tokenB)).status, 200)
  await access(path.join(profilePhotoDirectory, aRef))
  assert.equal((await User.findById(a.id)).profilePhoto, aRef)
  assert.equal((await fetch(`${base}/api/auth/${a.id}/photo`, { method: 'DELETE', headers: { Authorization: `Bearer ${tokenB}` } })).status, 404)
})

test('removal clears reference, deletes only managed photo and remains idempotent', async () => {
  const ref = (await User.findById(a.id)).profilePhoto
  const result = await remove()
  assert.equal(result.status, 200)
  assert.equal((await result.json()).user.profilePhotoUrl, undefined)
  assert.equal((await User.findById(a.id)).profilePhoto, undefined)
  await assert.rejects(access(path.join(profilePhotoDirectory, ref)), { code: 'ENOENT' })
  assert.equal((await remove()).status, 200)
  await removeProfilePhoto('../package.json')
  assert.ok(JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).name)
  for (const filename of ['package.json', '.gitkeep', 'not-a-photo.webp', '..%2Fpackage.json']) {
    assert.equal((await fetch(`${base}/api/profile-photos/${filename}`)).status, 404)
  }
})

test('database update failure removes the new file and preserves previous reference', async t => {
  const original = await upload()
  assert.equal(original.response.status, 200)
  const before = (await User.findById(a.id)).profilePhoto
  const filesBefore = (await readdir(profilePhotoDirectory)).sort()
  t.mock.method(User, 'findByIdAndUpdate', async () => { throw new Error('private diagnostic') })
  const result = await upload()
  assert.equal(result.response.status, 500)
  assert.deepEqual(result.data, { message: 'Internal server error' })
  assert.deepEqual((await readdir(profilePhotoDirectory)).sort(), filesBefore)
  assert.equal((await User.findById(a.id)).profilePhoto, before)
  await access(path.join(profilePhotoDirectory, before))
})

test('storage failure leaves previous photo and reference intact', async t => {
  const before = (await User.findById(a.id)).profilePhoto
  t.mock.method(profilePhotoStorage, 'save', async () => { throw new Error('private path') })
  const result = await upload()
  assert.equal(result.response.status, 500)
  assert.deepEqual(result.data, { message: 'Internal server error' })
  assert.equal((await User.findById(a.id)).profilePhoto, before)
  await access(path.join(profilePhotoDirectory, before))
})

test('old-file cleanup failure keeps the committed replacement usable', async t => {
  const before = (await User.findById(a.id)).profilePhoto
  references.add(before)
  t.mock.method(profilePhotoStorage, 'remove', async () => { throw new Error('private path') })
  const warnings = []
  t.mock.method(console, 'warn', message => warnings.push(message))
  const result = await upload()
  assert.equal(result.response.status, 200)
  assert.notEqual(reference(result.data.user), before)
  assert.equal((await User.findById(a.id)).profilePhoto, reference(result.data.user))
  assert.equal((await fetch(base + result.data.user.profilePhotoUrl)).status, 200)
  assert.deepEqual(warnings, ['Previous profile photo could not be removed.'])
})

test('account deletion reauthenticates and cleans up only that account photo', async () => {
  const aRef = (await User.findById(a.id)).profilePhoto
  const other = await upload(images.png, 'image/png', tokenB)
  assert.equal(other.response.status, 200)
  const bRef = reference(other.data.user)
  const deleted = await fetch(`${base}/api/auth/me`, { method: 'DELETE', headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: password }) })
  assert.equal(deleted.status, 200)
  await assert.rejects(access(path.join(profilePhotoDirectory, aRef)), { code: 'ENOENT' })
  await access(path.join(profilePhotoDirectory, bRef))
  assert.equal((await User.findById(b.id)).profilePhoto, bRef)
  assert.equal((await upload()).response.status, 401)
})
