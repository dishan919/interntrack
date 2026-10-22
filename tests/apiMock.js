// Isolated REST double; the Map represents server records, never browser storage.
export function installApi(store = new Map(), key = 'interntrack_applications', onWrite = () => {}) {
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    if (url.endsWith('/notifications')) return Promise.resolve(new Response('{"notifications":[],"unreadCount":0}'))
    const method = options.method || 'GET'
    const id = decodeURIComponent(new URL(url).pathname.split('/applications/')[1] || '')
    let records = JSON.parse(store.get(key) || '[]')
    calls.push({ method, id, data: options.body && JSON.parse(options.body) })
    let data
    if (method === 'GET') data = id ? records.find(app => app.id === id) : records
    if (method === 'POST') {
      data = { ...JSON.parse(options.body), id: crypto.randomUUID() }
      records.push(data)
    }
    if (method === 'PUT') {
      data = { ...JSON.parse(options.body), id }
      records = records.map(app => app.id === id ? data : app)
    }
    if (method === 'DELETE') records = records.filter(app => app.id !== id)
    if (method !== 'GET') { store.set(key, JSON.stringify(records)); onWrite() }
    return new Response(method === 'DELETE' ? null : JSON.stringify(data), { status: method === 'DELETE' ? 204 : method === 'POST' ? 201 : 200, headers: { 'Content-Type': 'application/json' } })
  }
  return calls
}
