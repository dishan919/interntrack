import jwt from 'jsonwebtoken'

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  return typeof secret === 'string' && secret.trim() ? secret : undefined
}

export function createAccessToken(userId, secret) {
  return jwt.sign({}, secret, { algorithm: 'HS256', subject: userId, expiresIn: '1h' })
}

export function verifyAccessToken(token, secret) {
  const claims = jwt.verify(token, secret, { algorithms: ['HS256'] })
  if (typeof claims.sub !== 'string' || !/^[a-f0-9]{24}$/.test(claims.sub)
    || !Number.isFinite(claims.exp) || !Number.isFinite(claims.iat)) {
    throw new Error('Invalid access token claims')
  }
  return claims
}
