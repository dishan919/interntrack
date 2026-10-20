// User-Agent is a self-reported hint, never proof of device identity or location.
export function formatUserAgent(value) {
  if (typeof value !== 'string' || !value) return 'Unknown browser/device'
  const ua = value.slice(0, 512)
  let browser
  if (/Edg(?:e|A|iOS)?\//i.test(ua)) browser = 'Edge'
  else if (/OPR\/|Opera\//i.test(ua)) browser = 'Opera'
  else if (/Firefox\/|FxiOS\//i.test(ua)) browser = 'Firefox'
  else if (/Chrome\/|CriOS\//i.test(ua)) browser = 'Chrome'
  else if (/Version\/.*Safari\//i.test(ua)) browser = 'Safari'
  let platform
  if (/iPhone|iPad|iPod/i.test(ua)) platform = 'iOS'
  else if (/Android/i.test(ua)) platform = 'Android'
  else if (/Windows NT/i.test(ua)) platform = 'Windows'
  else if (/Macintosh|Mac OS X/i.test(ua)) platform = 'macOS'
  else if (/Linux/i.test(ua)) platform = 'Linux'
  return browser && platform ? `${browser} on ${platform}` : 'Unknown browser/device'
}
export function formatLoginTime(value) {
  if (typeof value !== 'string' || !value) return 'Unknown date/time'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Unknown date/time'
}
