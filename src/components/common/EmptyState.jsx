import { Link } from 'react-router-dom'
export default function EmptyState({ title = 'Your next chapter starts here', message = 'Add your first application and keep every opportunity in one place.', action = true }) {
  return <div className="empty-state"><span className="empty-icon">?</span><h2>{title}</h2><p>{message}</p>{action && <Link className="button primary" to="/applications/new">+ Add application</Link>}</div>
}
