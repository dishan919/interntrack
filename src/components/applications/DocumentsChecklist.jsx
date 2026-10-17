import { useId } from 'react'
import { useApplications } from '../../context/ApplicationContext'
import { DOCUMENTS, getDocumentProgress, normalizeDocuments, updateApplicationDocument } from '../../utils/documentUtils'

export default function DocumentsChecklist({ application }) {
  const headingId = useId()
  const { getApplication, updateApplication, pending } = useApplications()
  const documents = normalizeDocuments(application.documents)
  return <section className="panel documents-panel" aria-labelledby={headingId}>
    <div className="panel-heading"><h2 id={headingId}>Documents</h2><span className="count-pill" role="status">{getDocumentProgress(documents)}</span></div>
    <div className="documents-checklist">
      {DOCUMENTS.map(([key, label]) => <label key={key}><input type="checkbox" disabled={pending} checked={documents[key]} onChange={event => updateApplicationDocument(application.id, key, event.target.checked, getApplication, updateApplication)} />{label}</label>)}
    </div>
  </section>
}
