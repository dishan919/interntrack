import { fileURLToPath } from 'node:url'
import { MongoMemoryServer } from 'mongodb-memory-server'

// A new real mongod process and temporary database; never reads MONGODB_URI.
export function startTestDatabase() {
  return MongoMemoryServer.create({
    binary: { downloadDir: fileURLToPath(new URL('../../node_modules/.cache/mongodb-binaries', import.meta.url)) },
    instance: { dbName: 'interntrack_test' },
  })
}
