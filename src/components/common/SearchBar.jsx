import Icon from './Icon'
export default function SearchBar({ value, onChange }) {
  return <label className="search"><Icon name="search" /><input aria-label="Search by company or position" placeholder="Search company or position..." value={value} onChange={event => onChange(event.target.value)} /></label>
}
