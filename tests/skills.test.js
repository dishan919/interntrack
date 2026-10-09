import assert from 'node:assert/strict'
import test from 'node:test'
import { addRequiredSkill, getSkillMatch, normalizeSkills, removeRequiredSkill, setSkillMatched, getBestSkillMatches, matchesApplicationSearch } from '../src/utils/skillUtils.js'
const required = ['React', 'JavaScript', 'Git', 'TypeScript', 'AWS']
test('3 of 5 skills gives 60%', () => assert.equal(getSkillMatch({ required, matched: required.slice(0, 3) }).percentage, 60))
test('5 of 5 skills gives 100%', () => assert.equal(getSkillMatch({ required, matched: required }).percentage, 100))
test('no required skills gives unavailable match', () => { for (const skills of [undefined, null, {}, { required: [], matched: ['React'] }]) assert.equal(getSkillMatch(skills).percentage, null) })
test('skill comparison ignores case and retains required labels', () => assert.deepEqual(normalizeSkills({ required: ['React'], matched: ['REACT'] }), { required: ['React'], matched: ['React'] }))
test('skill whitespace is trimmed', () => assert.deepEqual(normalizeSkills({ required: [' React '], matched: [' react '] }), { required: ['React'], matched: ['React'] }))
test('empty and duplicate skills cannot be added', () => { let skills = addRequiredSkill(undefined, ' React '); skills = addRequiredSkill(skills, 'REACT'); skills = addRequiredSkill(skills, ' '); assert.deepEqual(skills.required, ['React']) })
test('removing a required skill removes its matched selection', () => assert.deepEqual(removeRequiredSkill({ required: ['React', 'Git'], matched: ['React', 'Git'] }, ' GIT '), { required: ['React'], matched: ['React'] }))
test('missing skills are calculated correctly and stale matches ignored', () => assert.deepEqual(getSkillMatch({ required, matched: ['react', 'JavaScript', 'Git', 'Unknown'] }).missing, ['TypeScript', 'AWS']))
test('only required skills can be selected and deselected', () => { const skills = { required: ['React'], matched: [] }; assert.deepEqual(setSkillMatched(skills, 'AWS', true), skills); assert.deepEqual(setSkillMatched(setSkillMatched(skills, 'react', true), 'REACT', false), skills) })
test('malformed optional skills remain safe and percentage rounds', () => { assert.equal(getSkillMatch({ required: 'React', matched: null }).percentage, null); assert.equal(getSkillMatch({ required: ['React', null, 2, 'Git', 'AWS'], matched: ['React'] }).percentage, 33) })
test('best matches are stable, limited, omit unavailable and include real zero matches', () => { const apps = [{ id: 'none' }, ...Array.from({ length: 6 }, (_, i) => ({ id: i, skills: { required: ['React'], matched: i === 0 ? [] : ['React'] } }))]; assert.deepEqual(getBestSkillMatches(apps).map(item => item.application.id), [1, 2, 3, 4, 5]); assert.equal(getBestSkillMatches(apps, 10).at(-1).match.percentage, 0) })
test('search preserves company and position matching and adds case insensitive skills', () => { const app = { company: 'WSO2', position: 'Intern', skills: { required: ['TypeScript'] } }; for (const query of ['wso2', 'INTERN', 'typescript']) assert.equal(matchesApplicationSearch(app, query), true); assert.equal(matchesApplicationSearch(app, 'AWS'), false) })
