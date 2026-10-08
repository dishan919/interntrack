export default function StatCard({ label, value, symbol, tone = 'teal' }) {
  return <div className="stat-card"><span className={'stat-icon ' + tone}>{symbol}</span><div className="stat-value">{value}</div><div className="muted">{label}</div></div>
}
