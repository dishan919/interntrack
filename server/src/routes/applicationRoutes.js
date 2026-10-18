import { Router } from 'express'
import authenticate from '../middleware/authenticate.js'
import {
  getApplications, getApplication, createApplication, updateApplication, deleteApplication,
} from '../controllers/applicationController.js'

const router = Router()

router.use(authenticate)

router.route('/').get(getApplications).post(createApplication)
router.route('/:id').get(getApplication).put(updateApplication).delete(deleteApplication)

export default router
