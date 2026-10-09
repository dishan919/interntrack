// Normalize for comparison while keeping the first clean display label.
export function skillKey(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}
export function normalizeSkills(skills) {
  const unique = values => {
    const seen = new Set()
    return (Array.isArray(values) ? values : []).filter(value => {
      const key = skillKey(value)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    }).map(value => value.trim())
  }
  const required = unique(skills?.required)
  const matchedKeys = new Set(unique(skills?.matched).map(skillKey))
  return { required, matched: required.filter(skill => matchedKeys.has(skillKey(skill))) }
}
export function addRequiredSkill(skills, value) {
  const clean = normalizeSkills(skills)
  return normalizeSkills({ ...clean, required: [...clean.required, value] })
}
export function removeRequiredSkill(skills, value) {
  const clean = normalizeSkills(skills)
  return normalizeSkills({ ...clean, required: clean.required.filter(skill => skillKey(skill) !== skillKey(value)) })
}
export function setSkillMatched(skills, value, checked) {
  const clean = normalizeSkills(skills)
  return normalizeSkills({ ...clean, matched: checked ? [...clean.matched, value] : clean.matched.filter(skill => skillKey(skill) !== skillKey(value)) })
}
export function getSkillMatch(skills) {
  const { required, matched } = normalizeSkills(skills)
  const keys = new Set(matched.map(skillKey))
  return { required, matched, missing: required.filter(skill => !keys.has(skillKey(skill))), percentage: required.length ? Math.round(matched.length / required.length * 100) : null }
}
export function getBestSkillMatches(applications, limit = 5) {
  return applications.map(application => ({ application, match: getSkillMatch(application.skills) }))
    .filter(item => item.match.percentage !== null)
    .sort((a, b) => b.match.percentage - a.match.percentage).slice(0, limit)
}
export function matchesApplicationSearch(application, search) {
  return [application.company, application.position, ...normalizeSkills(application.skills).required].join(' ').toLowerCase().includes(search.toLowerCase())
}
