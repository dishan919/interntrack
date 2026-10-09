import { getSkillMatch } from '../../utils/skillUtils'
export default function SkillMatch({ skills, compact = false }) {
  const match = getSkillMatch(skills)
  if (match.percentage === null) return null
  if (compact) return <span className="skill-match-indicator">{match.percentage}% match</span>
  return <section className="panel skill-match-panel"><div className="panel-heading"><h2>Skill Match</h2></div><div className="skill-match-content"><strong>{match.percentage}% Match</strong><p>{match.matched.length} of {match.required.length} skills</p><div className="skill-progress" role="progressbar" aria-label="Skill match" aria-valuenow={match.percentage} aria-valuemin={0} aria-valuemax={100}><div style={{ width: match.percentage + '%' }} /></div><div className="skill-match-groups"><div><h3>Matched Skills</h3>{match.matched.length ? <ul>{match.matched.map(skill => <li key={skill}>✓ {skill}</li>)}</ul> : <p>No skills matched yet.</p>}</div><div><h3>Skills to Learn</h3>{match.missing.length ? <ul>{match.missing.map(skill => <li key={skill}>• {skill}</li>)}</ul> : <p>All required skills matched.</p>}</div></div></div></section>
}
