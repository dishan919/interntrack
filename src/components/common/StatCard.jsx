import Icon from './Icon'
export default function StatCard({ label, value, symbol, icon = 'applications', tone = 'teal', description }) {
  return <article className="stat-card"><div className="stat-heading"><span className="muted">{label}</span><span className={'stat-icon ' + tone} aria-hidden="true">{symbol ? <span>{symbol}</span> : <Icon name={icon} />}</span></div><div className="stat-value">{value}</div>{description && <p className="stat-description">{description}</p>}</article>
}
