import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, before, test } from 'node:test'
import { createApp } from '../src/app.js'
import { createCorsOptions } from '../src/config/cors.js'

const originalSecret = process.env.JWT_SECRET
before(() => { process.env.JWT_SECRET = 'disposable-cors-tests-only-secret' })
after(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalSecret
})

async function withServer(env, verify) {
  const server = createApp(env).listen(0, '127.0.0.1')
  try {
    await once(server, 'listening')
    await verify(`http://127.0.0.1:${server.address().port}`)
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
}

test('development retains both local origins and adds the configured origin exactly', async () => {
  await withServer({ NODE_ENV: 'development', CLIENT_ORIGIN: 'https://example.com' }, async base => {
    for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://example.com']) {
      const response = await fetch(`${base}/api/health`, { headers: { Origin: origin } })
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('access-control-allow-origin'), origin)
      assert.match(response.headers.get('vary'), /Origin/)
    }
  })
  await withServer({}, async base => {
    const response = await fetch(`${base}/api/health`, { headers: { Origin: 'http://localhost:5173' } })
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173')
  })
})

test('production allows only the configured origin, including authenticated-request preflight', async () => {
  await withServer({ NODE_ENV: 'production', CLIENT_ORIGIN: 'https://example.com' }, async base => {
    const response = await fetch(`${base}/api/auth/me`, {
      method: 'OPTIONS', headers: { Origin: 'https://example.com', 'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'authorization,content-type' },
    })
    assert.equal(response.status, 204)
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://example.com')
    assert.match(response.headers.get('access-control-allow-methods'), /PATCH/)
    assert.equal(response.headers.get('access-control-allow-headers'), 'authorization,content-type')

    for (const origin of ['https://unknown.example', 'https://example.com.evil.test', 'https://sub.example.com', 'http://example.com', 'https://example.com:444', 'http://localhost:5173', 'http://127.0.0.1:5173', 'null', '*']) {
      for (const method of ['GET', 'OPTIONS']) {
        const denied = await fetch(`${base}/api/health`, { method, headers: { Origin: origin, ...(method === 'OPTIONS' ? { 'Access-Control-Request-Method': 'GET' } : {}) } })
        assert.equal(denied.headers.get('access-control-allow-origin'), null)
      }
    }
    const protectedResponse = await fetch(`${base}/api/auth/me`, { headers: { Origin: 'https://example.com' } })
    assert.equal(protectedResponse.status, 401)
    assert.deepEqual(await protectedResponse.json(), { message: 'Unauthorized' })
  })
})

test('unknown development origins and unconfigured production origins receive no CORS permission', async () => {
  for (const env of [{}, { NODE_ENV: 'production' }, { NODE_ENV: 'production', CLIENT_ORIGIN: '' }]) {
    await withServer(env, async base => {
      const response = await fetch(`${base}/api/health`, { headers: { Origin: 'https://unknown.example' } })
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('access-control-allow-origin'), null)
    })
  }
})

test('requests without Origin retain normal health, error and authentication behavior', async () => {
  await withServer({ NODE_ENV: 'production', CLIENT_ORIGIN: 'https://example.com' }, async base => {
    const health = await fetch(`${base}/api/health`)
    assert.equal(health.status, 200)
    assert.equal((await health.json()).status, 'ok')
    assert.equal(health.headers.get('access-control-allow-origin'), null)
    assert.equal((await fetch(`${base}/api/missing`)).status, 404)
    const protectedResponse = await fetch(`${base}/api/auth/me`)
    assert.equal(protectedResponse.status, 401)
    assert.deepEqual(await protectedResponse.json(), { message: 'Unauthorized' })
  })
})

test('invalid CLIENT_ORIGIN fails closed without including its value in diagnostics', () => {
  for (const value of ['*', 'null', 'example.com', '//example.com', 'ftp://example.com', 'https://example.com/', 'https://example.com/path', 'https://user:private@example.com', 'https://example.com?secret=private', 'https://example.com#private', 'https://example.com?', 'https://example.com#', ' https://example.com', 'https://example.com\n', 'https://a.example,https://b.example', 'https://*.example.com', '   ']) {
    assert.throws(() => createApp({ CLIENT_ORIGIN: value }), error => {
      assert.equal(error.message, 'CLIENT_ORIGIN must be an HTTP or HTTPS origin without credentials, path, query or fragment')
      return true
    })
  }
})

test('valid HTTP and HTTPS origins including explicit ports and IPv6 are accepted', () => {
  for (const origin of ['http://example.com', 'https://example.com:8443', 'http://[::1]:5173']) {
    const options = createCorsOptions({ NODE_ENV: 'production', CLIENT_ORIGIN: origin })
    options.origin(origin, (error, allowed) => { assert.equal(error, null); assert.equal(allowed, true) })
  }
})
