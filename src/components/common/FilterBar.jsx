import { STATUSES } from '../../utils/applications'
export default function FilterBar({ value, onChange }) {
  return <select aria-label="Filter by status" value={value} onChange={event => onChange(event.target.value)}><option value="">All statuses</option>{STATUSES.map(status => <option key={status}>{status}</option>)}</select>
}
