export const EVENTS = Object.freeze({
  STATUS_CHANGED: 'application.statusChanged',
  INTERVIEW_SCHEDULED: 'interview.scheduled',
  FOLLOW_UP_DUE: 'followUp.due',
})

// Side effects are best effort. Await every handler and contain each failure so
// one observer cannot reject a completed domain operation or block later ones.
export function createEventPublisher() {
  const subscribers = new Map()
  return {
    subscribe(name, handler) {
      if (!subscribers.has(name)) subscribers.set(name, new Set())
      subscribers.get(name).add(handler)
      return () => subscribers.get(name)?.delete(handler)
    },
    async publish(name, payload) {
      for (const handler of [...(subscribers.get(name) || [])]) {
        try { await handler(Object.freeze({ ...payload })) }
        catch { console.warn('Domain event observer failed.') }
      }
    },
  }
}
export const domainEvents = createEventPublisher()
