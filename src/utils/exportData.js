export function exportApplicationData(applications) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(applications, null, 2)], { type: 'application/json' }))
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = 'interntrack-backup.json'
    link.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
