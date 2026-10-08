export default function SearchBar({ value, onChange }) {
  return <label className="search"><span aria-hidden="true">?</span><input aria-label="Search by company or position" placeholder="Search company or position�" value={value} onChange={event => onChange(event.target.value)} /></label>
}
