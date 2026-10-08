import { useEffect, useState } from 'react'
// Refresh indicators while the page remains open or the user returns to the tab.
export default function useDeadlineToday() {
  const [today, setToday] = useState(() => new Date())
  useEffect(() => {
    function refresh() { setToday(new Date()) }
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])
  return today
}
