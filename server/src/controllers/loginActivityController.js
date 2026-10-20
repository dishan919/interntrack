import LoginActivity from '../models/LoginActivity.js'
import { RECENT_LOGIN_ACTIVITY_LIMIT } from '../services/loginActivity.js'

export async function getLoginActivity(req, res) {
  const activities = await LoginActivity.find({ user: req.auth.userId })
    .sort({ loggedInAt: -1, _id: -1 })
    .limit(RECENT_LOGIN_ACTIVITY_LIMIT)
    .select('_id loggedInAt ipAddress userAgent')
  return res.json({ activities: activities.map(activity => activity.toJSON()) })
}
