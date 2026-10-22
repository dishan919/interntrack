import { getLoginActivity } from '../controllers/loginActivityController.js'
import existingAccount from '../middleware/existingAccount.js'
import { deleteAccount } from '../controllers/accountDeletionController.js'
import { verifyEmail, resendVerification } from '../controllers/emailVerificationController.js'
import { forgotPassword, resetPassword } from '../controllers/passwordResetController.js'
import { Router } from 'express'
import { login, me, register, updateMe, changePassword } from '../controllers/authController.js'
import authenticate from '../middleware/authenticate.js'
import { uploadProfilePhoto, deleteProfilePhoto } from '../controllers/profilePhotoController.js'

const router = Router()

router.post('/verify-email', verifyEmail)
router.post('/resend-verification', authenticate, resendVerification)
router.post('/register', register)
router.post('/login', login)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)
router.get('/login-activity', authenticate, existingAccount(getLoginActivity))
router.get('/me', authenticate, me)
router.delete('/me', authenticate, deleteAccount)
router.patch('/me', authenticate, updateMe)
router.patch('/password', authenticate, changePassword)
router.post('/me/photo', authenticate, existingAccount(uploadProfilePhoto))
router.delete('/me/photo', authenticate, existingAccount(deleteProfilePhoto))

export default router
