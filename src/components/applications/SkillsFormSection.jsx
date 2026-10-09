import { useId, useState } from 'react'
import { addRequiredSkill, normalizeSkills, removeRequiredSkill, setSkillMatched } from '../../utils/skillUtils'
export default function SkillsFormSection({ skills, onChange }) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const [message, setMessage] = useState('')
  const clean = normalizeSkills(skills)
  function add() {
    const next = addRequiredSkill(clean, draft)
    if (next.required.length === clean.required.length) {
      setMessage(draft.trim() ? 'This skill is already added.' : 'Enter a skill to add.')
      return
    }
    onChange(next)
    setDraft('')
    setMessage('Skill added.')
  }
  return <fieldset className="skills-form-section"><legend>Skills <span className="field-hint">Optional</span></legend><label htmlFor={id}>Required Skills</label><div className="skill-chips">{clean.required.map(skill => <span className="skill-chip" key={skill}><span>{skill}</span><button type="button" aria-label={'Remove ' + skill} onClick={() => { onChange(removeRequiredSkill(clean, skill)); setMessage(skill + ' removed.') }}>×</button></span>)}</div><div className="skill-input-row"><input id={id} placeholder="Add a skill..." value={draft} aria-describedby={id + '-hint'} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); add() } }} /><button className="button secondary" type="button" onClick={add}>Add skill</button></div><small id={id + '-hint'} className="field-hint">Press Enter or Add skill. Duplicate skills are ignored.</small><span className="sr-only" role="status">{message}</span>{clean.required.length > 0 && <fieldset className="skill-selections"><legend>Which skills do you already have?</legend>{clean.required.map(skill => <label key={skill}><input type="checkbox" checked={clean.matched.includes(skill)} onChange={event => onChange(setSkillMatched(clean, skill, event.target.checked))} />{skill}</label>)}</fieldset>}</fieldset>
}
