import app from './app.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'

const port = process.env.PORT || 5000

try {
  await connectDatabase()
  const server = app.listen(port, () => {
    console.log(`InternTrack API listening on port ${server.address().port}`)
  })
  server.on('error', async () => {
    console.error('InternTrack API failed to listen. Check PORT and whether it is already in use.')
    await disconnectDatabase()
    process.exitCode = 1
  })
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close(async () => {
        await disconnectDatabase()
      })
    })
  }
} catch {
  console.error('MongoDB connection failed. Set MONGODB_URI and ensure MongoDB is reachable. API was not started.')
  await disconnectDatabase()
  process.exitCode = 1
}
