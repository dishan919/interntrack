import { Router } from 'express'
import {
  getApplications, getApplication, createApplication, updateApplication, deleteApplication,
} from '../controllers/applicationController.js'

const router = Router()

router.route('/').get(getApplications).post(createApplication)
router.route('/:id').get(getApplication).put(updateApplication).delete(deleteApplication)

export default router
