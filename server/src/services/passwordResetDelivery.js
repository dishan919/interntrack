// Deliberately no production email provider or normal-log token delivery.
let capture
export function setTestResetCapture(callback) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Reset capture is test-only')
  capture = callback
}
export async function deliverPasswordReset(details) {
  if (process.env.NODE_ENV === 'test' && capture) await capture(details)
}
