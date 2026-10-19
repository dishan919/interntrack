import { Router } from 'express'
import { login, me, register, updateMe, changePassword } from '../controllers/authController.js'
import authenticate from '../middleware/authenticate.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.get('/me', authenticate, me)
router.patch('/me', authenticate, updateMe)
router.patch('/password', authenticate, changePassword)

export default router
