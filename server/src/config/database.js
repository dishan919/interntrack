import mongoose from 'mongoose'

export async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('MONGODB_URI is required')
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
}

export async function disconnectDatabase() {
  await mongoose.disconnect()
}
