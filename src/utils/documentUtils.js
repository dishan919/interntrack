export const DOCUMENTS = [
  ['resume', 'Resume / CV'],
  ['coverLetter', 'Cover Letter'],
  ['portfolio', 'Portfolio'],
  ['transcript', 'Transcript'],
]

export function normalizeDocuments(documents) {
  return Object.fromEntries(DOCUMENTS.map(([key]) => [key, documents?.[key] === true]))
}

export function getDocumentProgress(documents) {
  const ready = Object.values(normalizeDocuments(documents)).filter(Boolean).length
  return `${ready} of ${DOCUMENTS.length} ready`
}

export function updateApplicationDocument(id, key, checked, getApplication, updateApplication) {
  if (!DOCUMENTS.some(([name]) => name === key) || typeof checked !== 'boolean') return false
  const application = getApplication(id)
  if (!application) return false
  const documents = normalizeDocuments(application.documents)
  if (documents[key] === checked) return false
  updateApplication(id, { documents: { ...documents, [key]: checked } })
  return true
}
