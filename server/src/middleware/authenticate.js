import { getJwtSecret, verifyAccessToken } from '../config/jwt.js'

export default function authenticate(req, res, next) {
  const secret = getJwtSecret()
  if (!secret) return res.status(503).json({ message: 'Authentication is not configured' })
  const match = /^Bearer ([^\s]+)$/i.exec(req.get('Authorization') || '')
  if (!match) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const claims = verifyAccessToken(match[1], secret)
    req.auth = { userId: claims.sub }
  } catch {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  return next()
}
