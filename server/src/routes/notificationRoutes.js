import { Router } from 'express'
import authenticate from '../middleware/authenticate.js'
import existingAccount from '../middleware/existingAccount.js'
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../controllers/notificationController.js'
const router = Router()
router.use(authenticate)
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
router.get('/', existingAccount(listNotifications))
router.patch('/read-all', existingAccount(markAllNotificationsRead))
router.patch('/:id/read', existingAccount(markNotificationRead))
export default router
