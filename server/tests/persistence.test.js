import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { startTestDatabase } from './helpers/database.js'

const testSecret = 'feature04-persistence-test-secret'

const serverPath = fileURLToPath(new URL('../src/server.js', import.meta.url))

async function startServer(uri) {
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: '0', MONGODB_URI: uri, JWT_SECRET: testSecret },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  try {
    const baseUrl = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('API startup timed out')), 15000)
      child.once('error', error => { clearTimeout(timeout); reject(error) })
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`API exited: ${code}`)) })
      child.stdout.on('data', chunk => {
        const match = chunk.toString().match(/listening on port (\d+)/)
        if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`) }
      })
    })
    return { child, baseUrl }
  } catch (error) {
    child.kill()
    throw error
  }
}

async function stopServer(server) {
  if (!server || server.child.exitCode !== null) return
  const exited = once(server.child, 'exit')
  server.child.kill()
  await exited
}

// Allow the one-time MongoDB binary download on machines with an empty cache.
test('live MongoDB CRUD survives Express restarts, including updated metadata', { timeout: 600000 }, async () => {
  const database = await startTestDatabase()
  let server
  try {
    server = await startServer(database.getUri())
    const credentials = { name: 'Persistence User', email: 'persistence@example.com', password: 'TestPassword123' }
    const registered = await fetch(`${server.baseUrl}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) })
    assert.equal(registered.status, 201)
    const login = await fetch(`${server.baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) })
    assert.equal(login.status, 200)
    const { accessToken } = await login.json()
    const authorizedFetch = (url, options) => fetch(url, { ...options, headers: { ...options?.headers, Authorization: `Bearer ${accessToken}` } })
    const health = await fetch(`${server.baseUrl}/api/health`)
    assert.equal(health.status, 200)
    assert.deepEqual(await health.json(), { status: 'ok', message: 'InternTrack API is running' })
    assert.deepEqual(await (await authorizedFetch(`${server.baseUrl}/api/applications`)).json(), [])
    const body = { company: 'IFS', position: 'Intern', skills: { required: ['React'], matched: [] } }
    const post = await authorizedFetch(`${server.baseUrl}/api/applications`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    assert.equal(post.status, 201)
    const created = await post.json()
    assert.deepEqual(await (await authorizedFetch(`${server.baseUrl}/api/applications/${created.id}`)).json(), created)
    await stopServer(server)
    server = await startServer(database.getUri())
    let url = `${server.baseUrl}/api/applications/${created.id}`
    assert.deepEqual(await (await authorizedFetch(url)).json(), created)
    const put = await authorizedFetch(url, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, status: 'Interview', notes: 'Retained after restart' }),
    })
    assert.equal(put.status, 200)
    const updated = await put.json()
    await stopServer(server)
    server = await startServer(database.getUri())
    url = `${server.baseUrl}/api/applications/${created.id}`
    assert.deepEqual(await (await authorizedFetch(url)).json(), updated)
    const deleted = await authorizedFetch(url, { method: 'DELETE' })
    assert.equal(deleted.status, 204)
    assert.equal(await deleted.text(), '')
    assert.equal((await authorizedFetch(url)).status, 404)
    assert.deepEqual(await (await authorizedFetch(`${server.baseUrl}/api/applications`)).json(), [])
  } finally {
    await stopServer(server)
    await database.stop()
  }
})

test('startup with missing database configuration fails without leaking configuration', async () => {
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, MONGODB_URI: '' }, windowsHide: true,
  })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  const [code] = await once(child, 'exit')
  assert.equal(code, 1)
  assert.match(output, /MongoDB connection failed/)
  assert.doesNotMatch(output, /listening on port/)
})

test('startup with a rejected database URI fails without exposing credentials', async () => {
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, MONGODB_URI: 'invalid://test-user:fake-secret@127.0.0.1/interntrack' },
    windowsHide: true,
  })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  const [code] = await once(child, 'exit')
  assert.equal(code, 1)
  assert.match(output, /MongoDB connection failed/)
  assert.doesNotMatch(output, /listening on port|test-user|fake-secret|invalid:\/\//)
})
