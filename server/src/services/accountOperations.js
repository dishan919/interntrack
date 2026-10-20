// Serialize account deletion with application operations in the current single
// Node process. No database transaction/replica set or persistent deletion state.
const queues = new Map()
export async function withAccountOperation(userId, operation) {
  const key = String(userId)
  const previous = queues.get(key) || Promise.resolve()
  let release
  const gate = new Promise(resolve => { release = resolve })
  const tail = previous.then(() => gate)
  queues.set(key, tail)
  await previous
  try { return await operation() }
  finally {
    release()
    if (queues.get(key) === tail) queues.delete(key)
  }
}
