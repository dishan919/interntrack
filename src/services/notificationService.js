import { bearerHeaders, invalidateSession } from './authSession.js'
const API_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '')
const objectId = /^[a-f0-9]{24}$/i
const failure = () => new Error('Unable to load or update notifications. Please try again.')
async function request(token, path = '', method = 'GET') {
  let response
  try { response = await fetch(`${API_URL}/notifications${path}`, { method, headers: bearerHeaders(token) }) }
  catch { throw failure() }
  if (response.status === 401) { invalidateSession(token); throw new Error('Your session has expired. Please sign in again.') }
  if (!response.ok) throw failure()
  try { return await response.json() } catch { throw failure() }
}
export async function getNotifications(token) {
  const data = await request(token)
  if (!Array.isArray(data?.notifications) || data.notifications.length > 50 || !Number.isSafeInteger(data.unreadCount) || data.unreadCount < 0) throw failure()
  const notifications = data.notifications.map(item => {
    if (!item || typeof item.id !== 'string' || !objectId.test(item.id) || !['status', 'interview', 'followUp'].includes(item.type) || typeof item.title !== 'string' || item.title.length > 120 || typeof item.message !== 'string' || item.message.length > 400 || typeof item.read !== 'boolean' || typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt))) throw failure()
    return { id: item.id, type: item.type, title: item.title, message: item.message, read: item.read, createdAt: item.createdAt, ...(typeof item.applicationId === 'string' && objectId.test(item.applicationId) ? { applicationId: item.applicationId } : {}) }
  })
  return { notifications, unreadCount: data.unreadCount }
}
export async function markNotificationRead(token, id) {
  if (typeof id !== 'string' || !objectId.test(id)) throw failure()
  await request(token, `/${encodeURIComponent(id)}/read`, 'PATCH')
}
export async function markAllNotificationsRead(token) { await request(token, '/read-all', 'PATCH') }
