// A shared delivery seam; no production provider, HTTP capture route or token logs.
export function createTokenDelivery() {
  let capture
  return {
    setCapture(callback) {
      if (process.env.NODE_ENV !== 'test') throw new Error('Token capture is test-only')
      capture = callback
    },
    async deliver(details) {
      if (process.env.NODE_ENV === 'test' && capture) await capture(details)
    },
  }
}
