import existingAccount from '../middleware/existingAccount.js'
import { Router } from 'express'
import authenticate from '../middleware/authenticate.js'
import {
  getApplications, getApplication, createApplication, updateApplication, deleteApplication,
} from '../controllers/applicationController.js'

const router = Router()

router.use(authenticate)

router.route('/').get(existingAccount(getApplications)).post(existingAccount(createApplication))
router.route('/:id').get(existingAccount(getApplication)).put(existingAccount(updateApplication)).delete(existingAccount(deleteApplication))

export default router
