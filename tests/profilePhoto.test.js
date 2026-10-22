import assert from 'node:assert/strict'
import { test } from 'node:test'
import { photoFileError, photoSource, photoState } from '../src/utils/profilePhoto.js'
import { changeProfilePhoto } from '../src/services/profilePhotoService.js'
import { getCurrentUser, login, updateProfile } from '../src/services/authService.js'
import { getAccessToken, setAccessToken } from '../src/services/authSession.js'

const url = '/api/profile-photos/12345678-1234-4123-8123-123456789abc.webp'
const user = { id: 'photo-user', name: 'Photo User', email: 'photo@example.com', emailVerified: true, profilePhotoUrl: url }
test('photo validation and URL resolution accept only bounded supported files and managed references', () => {
  assert.match(photoFileError(null), /Choose a photo/)
  assert.match(photoFileError({ type: 'image/svg+xml', size: 100 }), /JPEG, PNG or WebP/)
  assert.match(photoFileError({ type: 'image/png', size: 2 * 1024 * 1024 + 1 }), /2 MB/)
  assert.match(photoFileError({ type: 'image/png', size: 0 }), /nonempty/)
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) assert.equal(photoFileError({ type, size: 2 * 1024 * 1024 }), undefined)
  assert.equal(photoSource(url), `http://localhost:5000${url}`)
  for (const value of ['javascript:alert(1)', 'data:image/png;base64,secret', '/server/.env', 'https://evil.example/photo', '/../secret']) {
    assert.equal(photoSource(value), null)
    assert.deepEqual(photoState({ profilePhotoUrl: value }), {})
  }
})

test('multipart upload/removal service preserves Bearer auth and returns only safe user fields', async t => {
  let call
  t.mock.method(globalThis, 'fetch', async (target, options) => {
    call = { target, options }
    return new Response(JSON.stringify({ user: { ...user, password: 'private', accessToken: 'private', profilePhoto: '/private/path' } }))
  })
  const file = new File(['photo'], 'image.png', { type: 'image/png' })
  const result = await changeProfilePhoto('photo-token', file)
  assert.deepEqual(result, { user })
  assert.equal(call.target, 'http://localhost:5000/api/auth/me/photo')
  assert.equal(call.options.method, 'POST')
  assert.deepEqual(call.options.headers, { Authorization: 'Bearer photo-token' })
  assert.deepEqual([...call.options.body.keys()], ['photo'])
  assert.equal(call.options.body.get('photo').name, 'image.png')
  t.mock.method(globalThis, 'fetch', async (target, options) => { call = { target, options }; const cleared = { ...user }; delete cleared.profilePhotoUrl; return new Response(JSON.stringify({ user: cleared })) })
  assert.equal((await changeProfilePhoto('photo-token', null)).user.profilePhotoUrl, undefined)
  assert.equal(call.options.method, 'DELETE')
  assert.equal(call.options.body, undefined)
})

test('photo failures are sanitized and preserve existing stale/current token invalidation behavior', async t => {
  const previous = getAccessToken()
  try {
    for (const status of [400, 413, 500]) {
      t.mock.method(globalThis, 'fetch', async () => new Response('private credentials', { status }))
      await assert.rejects(changeProfilePhoto('token', null), error => !error.message.includes('private'))
    }
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('private filesystem path') })
    await assert.rejects(changeProfilePhoto('token', null), /Unable to update/)
    t.mock.method(globalThis, 'fetch', async () => new Response('invalid json'))
    await assert.rejects(changeProfilePhoto('token', null), /Unable to update/)
    setAccessToken('current')
    t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 401 }))
    await assert.rejects(changeProfilePhoto('old', null), /expired/)
    assert.equal(getAccessToken(), 'current')
    await assert.rejects(changeProfilePhoto('current', null), /expired/)
    assert.equal(getAccessToken(), null)
  } finally { setAccessToken(previous) }
})

test('login, restoration and ordinary profile edits preserve only the safe photo URL', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ user: { ...user, password: 'private', profilePhoto: 'private' }, accessToken: 'token' })))
  for (const result of [await getCurrentUser('token'), await login({ email: user.email, password: 'Password123' }), await updateProfile('token', { name: user.name })]) {
    assert.deepEqual(result.user, user)
  }
})
