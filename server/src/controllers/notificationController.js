import mongoose from 'mongoose'
import Notification from '../models/Notification.js'
import Application from '../models/Application.js'
import { discoverDueFollowUps } from '../services/applicationEvents.js'

export async function listNotifications(req, res) {
  // Discovery is secondary too: a reminder check outage must not hide history.
  try { await discoverDueFollowUps(req.auth.userId) }
  catch { console.warn('Follow-up notification discovery failed.') }
  const filter = { user: req.auth.userId }
  const [records, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1, _id: -1 }).limit(50).lean(),
    Notification.countDocuments({ ...filter, read: false }),
  ])
  const applications = await Application.find({ owner: req.auth.userId, _id: { $in: records.map(item => item.application).filter(Boolean) } }).select('_id').lean()
  const accessible = new Set(applications.map(item => String(item._id)))
  return res.json({ notifications: records.map(item => ({
    id: String(item._id), type: item.type, title: item.title, message: item.message,
    read: item.read, createdAt: item.createdAt,
    ...(accessible.has(String(item.application)) ? { applicationId: String(item.application) } : {}),
  })), unreadCount })
}
function invalidBody(req) { return req.body !== undefined && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length > 0) }
export async function markNotificationRead(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(404).json({ message: 'Notification not found' })
  if (invalidBody(req)) return res.status(400).json({ message: 'Invalid notification request' })
  const result = await Notification.updateOne({ _id: req.params.id, user: req.auth.userId }, { $set: { read: true } })
  if (!result.matchedCount) return res.status(404).json({ message: 'Notification not found' })
  return res.json({ message: 'Notification marked as read.' })
}
export async function markAllNotificationsRead(req, res) {
  if (invalidBody(req)) return res.status(400).json({ message: 'Invalid notification request' })
  await Notification.updateMany({ user: req.auth.userId, read: false }, { $set: { read: true } })
  return res.json({ message: 'Notifications marked as read.' })
}
