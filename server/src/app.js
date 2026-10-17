import express from 'express'
import cors from 'cors'
import healthRoutes from './routes/healthRoutes.js'
import applicationRoutes from './routes/applicationRoutes.js'

const app = express()

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }))
app.use(express.json())

app.use('/api/health', healthRoutes)
app.use('/api/applications', applicationRoutes)

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

export default app
