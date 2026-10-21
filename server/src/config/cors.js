const developmentOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173']

export function createCorsOptions(env = process.env) {
  const configured = env.CLIENT_ORIGIN
  const allowedOrigins = new Set(env.NODE_ENV === 'production' ? [] : developmentOrigins)

  if (configured !== undefined && configured !== '') {
    let url
    try { url = new URL(configured) } catch { /* Reject below without exposing the value. */ }
    // Require the serialized origin itself: no path (including trailing slash),
    // credentials, query, fragment, whitespace, wildcard or origin list.
    if (!url || !['http:', 'https:'].includes(url.protocol) || url.hostname.includes('*') || url.origin !== configured) {
      throw new Error('CLIENT_ORIGIN must be an HTTP or HTTPS origin without credentials, path, query or fragment')
    }
    allowedOrigins.add(configured)
  }

  return {
    origin(origin, callback) {
      callback(null, typeof origin === 'string' && allowedOrigins.has(origin))
    },
  }
}
