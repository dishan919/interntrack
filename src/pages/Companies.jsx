import PageHeader from '../components/common/PageHeader'
import { Link } from 'react-router-dom'
import { useApplications } from '../context/ApplicationContext'
import EmptyState from '../components/common/EmptyState'
export default function Companies() {
  const { applications } = useApplications()
  const companies = applications.reduce((groups, app) => {
    const key = app.company.trim().toLowerCase()
    if (!groups[key]) groups[key] = { name: app.company, applications: [] }
    groups[key].applications.push(app)
    return groups
  }, {})
  return <><PageHeader title="Companies" eyebrow="PLACES YOU COULD GROW" description={"Your applications, grouped by company automatically."}><span className="count-pill">{Object.keys(companies).length} companies</span></PageHeader>{applications.length ? <div className="company-grid">{Object.values(companies).sort((a, b) => a.name.localeCompare(b.name)).map(company => <Link className="panel company-card" key={company.name} to={'/applications?company=' + encodeURIComponent(company.name)}><div className="company-logo">{company.name.slice(0, 2).toUpperCase()}</div><h2>{company.name}</h2><p>{company.applications.length} {company.applications.length === 1 ? 'application' : 'applications'}</p><div className="company-roles">{company.applications.map(app => <span key={app.id}>{app.position}</span>)}</div><span className="subtle-link">View applications ?</span></Link>)}</div> : <EmptyState />}</>
}
