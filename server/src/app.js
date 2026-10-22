import notificationRoutes from './routes/notificationRoutes.js'
import { domainEvents } from './services/domainEvents.js'
import { registerNotificationObserver } from './services/notificationObserver.js'
import express from 'express'
import cors from 'cors'
import healthRoutes from './routes/healthRoutes.js'
import applicationRoutes from './routes/applicationRoutes.js'
import authRoutes from './routes/authRoutes.js'
import { createCorsOptions } from './config/cors.js'
import { isManagedPhoto, profilePhotoStorage } from './services/profilePhotoStorage.js'

// Register once per module, not once per Express instance.
registerNotificationObserver(domainEvents)

export function createApp(env = process.env) {
  const app = express()

  app.use(cors(createCorsOptions(env)))
  app.use(express.json())

  app.use('/api/notifications', notificationRoutes)
  app.use('/api/health', healthRoutes)
  app.use('/api/applications', applicationRoutes)
  app.use('/api/auth', authRoutes)

  app.get('/api/profile-photos/:filename', async (req, res, next) => {
    if (!isManagedPhoto(req.params.filename)) return res.status(404).json({ message: 'Photo not found' })
    try {
      const bytes = await profilePhotoStorage.read(req.params.filename)
      res.set('X-Content-Type-Options', 'nosniff')
      res.set('Cache-Control', 'no-store')
      return res.type('webp').send(bytes)
    } catch (error) {
      if (error.code === 'ENOENT') return res.status(404).json({ message: 'Photo not found' })
      return next(error)
    }
  })

  app.use((_req, res) => {
    res.status(404).json({ message: 'Route not found' })
  })

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err)
    const status = err.status >= 400 && err.status < 500 ? err.status : 500
    res.status(status).json({
      message: status === 500 ? 'Internal server error' : 'Invalid request',
    })
  })

  return app
}

export default createApp()
