import { isIP } from 'node:net'
import User from '../models/User.js'
import LoginActivity, { MAX_USER_AGENT_LENGTH } from '../models/LoginActivity.js'
import { withAccountOperation } from './accountOperations.js'

export const RECENT_LOGIN_ACTIVITY_LIMIT = 20
export async function recordSuccessfulLogin(userId, req) {
  const loggedInAt = new Date()
  const ipAddress = typeof req.ip === 'string' && isIP(req.ip) ? req.ip : ''
  const header = req.get('User-Agent')
  // Bounded plain display data; no JSON metadata, auth/cookie headers or fingerprinting.
  const userAgent = typeof header === 'string' ? header.replace(/\p{Cc}/gu, ' ').trim().slice(0, MAX_USER_AGENT_LENGTH) : ''
  try {
    await withAccountOperation(userId, async () => {
      // A login that waited behind account deletion must not recreate audit data.
      if (!await User.exists({ _id: userId })) return
      await LoginActivity.create({ user: userId, loggedInAt, ipAddress, userAgent })
    })
  } catch {
    // Best effort: no retry queue and no password/token/metadata/error-object logging.
    console.warn('Login activity could not be recorded.')
  }
}
