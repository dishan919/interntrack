import PageHeader from '../components/common/PageHeader'
import { useNavigate } from 'react-router-dom'
import { useApplications } from '../context/ApplicationContext'
import ApplicationForm from '../components/applications/ApplicationForm'
export default function AddApplication() {
  const { addApplication } = useApplications()
  const navigate = useNavigate()
  return <><PageHeader title="Add application" eyebrow="A NEW POSSIBILITY" description={"Take the first step. We'll help you keep track of the rest."}></PageHeader><ApplicationForm onSubmit={async values => { if (await addApplication(values)) navigate('/applications') }} /></>
}
