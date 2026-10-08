export default function ViewSwitcher({ view, onChange }) {
  return <div className="view-switcher" role="group" aria-label="Application view"><button type="button" aria-pressed={view === 'list'} className={view === 'list' ? 'selected' : ''} onClick={() => onChange('list')}>List View</button><button type="button" aria-pressed={view === 'board'} className={view === 'board' ? 'selected' : ''} onClick={() => onChange('board')}>Board View</button></div>
}
