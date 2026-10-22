import PageHeader from '../components/common/PageHeader'
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
  return <><PageHeader title="Edit application" eyebrow="KEEP YOUR JOURNEY UP TO DATE" description={`Update your opportunity at ${app.company}.`}></PageHeader><ApplicationForm key={id} initialValues={app} onSubmit={async values => { if (await updateApplication(id, values)) navigate('/applications/' + id) }} /></>
}
