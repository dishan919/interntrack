import express from 'express'
import cors from 'cors'
import healthRoutes from './routes/healthRoutes.js'
import applicationRoutes from './routes/applicationRoutes.js'
import authRoutes from './routes/authRoutes.js'
import { createCorsOptions } from './config/cors.js'

export function createApp(env = process.env) {
  const app = express()

  app.use(cors(createCorsOptions(env)))
  app.use(express.json())

  app.use('/api/health', healthRoutes)
  app.use('/api/applications', applicationRoutes)
  app.use('/api/auth', authRoutes)

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
