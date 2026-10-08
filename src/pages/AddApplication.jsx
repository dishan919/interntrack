import { useNavigate } from 'react-router-dom'
import { useApplications } from '../context/ApplicationContext'
import ApplicationForm from '../components/applications/ApplicationForm'
export default function AddApplication() {
  const { addApplication } = useApplications()
  const navigate = useNavigate()
  return <><div className="page-heading"><div><div className="eyebrow">A NEW POSSIBILITY</div><h1>Add application</h1><p>Take the first step. We�ll help you keep track of the rest.</p></div></div><ApplicationForm onSubmit={values => { addApplication(values); navigate('/applications') }} /></>
}
