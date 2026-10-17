import { useParams, useNavigate, Link } from 'react-router-dom'
import { useApplications } from '../context/ApplicationContext'
import ApplicationForm from '../components/applications/ApplicationForm'
import EmptyState from '../components/common/EmptyState'
export default function EditApplication() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getApplication, updateApplication } = useApplications()
  const app = getApplication(id)
  if (!app) return <><Link to="/applications">? Back to applications</Link><EmptyState title="Application not found" message="This application may have been deleted." action={false} /></>
  return <><div className="page-heading"><div><div className="eyebrow">KEEP YOUR JOURNEY UP TO DATE</div><h1>Edit application</h1><p>Update your opportunity at {app.company}.</p></div></div><ApplicationForm key={id} initialValues={app} onSubmit={async values => { if (await updateApplication(id, values)) navigate('/applications/' + id) }} /></>
}
