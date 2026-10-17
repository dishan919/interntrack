import assert from 'node:assert/strict'
import { useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import ApplicationProvider, { reloadContext } from './contextHarness'
import { installApi } from './apiMock'
import Applications from '../src/pages/Applications'
import SearchBar from '../src/components/common/SearchBar'
import FilterBar from '../src/components/common/FilterBar'
export default async function verifySearchIntegration() {
  const records = [
    { id: 'early', company: 'Alpha', position: 'Frontend Intern', status: 'Applied', deadline: '2027-01-01', skills: { required: [' React '], matched: [] } },
    { id: 'late', company: 'Beta', position: 'Developer', status: 'Applied', deadline: '2027-01-03', skills: { required: ['React'], matched: ['React'] } },
    { id: 'saved', company: 'Gamma', position: 'Designer', status: 'Saved', skills: { required: ['React'] } },
    { id: 'other', company: 'Delta', position: 'Engineer', status: 'Applied', skills: { required: ['Python'] } },
    { id: 'legacy', company: 'Legacy', position: 'Assistant', status: 'Applied' },
  ]
  const original = JSON.stringify(records)
  const store = new Map([['interntrack_applications', original]])
  globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) }
  installApi(new Map(store))
  await reloadContext()
  function page(view, query, status = '', sort = 'default') {
    store.set('interntrack_application_view', view)
    // Invoke the actual search input, status selector and sort selector handlers.
    // A render-phase update lets the server renderer replay the page with their state.
    function Probe() {
      const element = Applications()
      const [ready, setReady] = useState(false)
      if (!ready) {
        const toolbar = element.props.children[1].props.children.find(child => child?.props?.className === 'toolbar')
        const search = SearchBar(toolbar.props.children[0].props)
        search.props.children[1].props.onChange({ target: { value: query } })
        FilterBar(toolbar.props.children[1].props).props.onChange({ target: { value: status } })
        toolbar.props.children[2].props.onChange({ target: { value: sort } })
        setReady(true)
      }
      return element
    }
    return renderToStaticMarkup(<MemoryRouter><ApplicationProvider><Probe /></ApplicationProvider></MemoryRouter>)
  }
  for (const view of ['list', 'board']) {
    for (const query of ['React', 'react', 'REACT', ' React ']) {
      const markup = page(view, query)
      assert.match(markup, view === 'board' ? /class="kanban-board"/ : /class="application-row"/)
      for (const id of ['early', 'late', 'saved']) assert.ok(markup.includes('/applications/' + id), view + ': ' + query + ' finds ' + id)
      for (const id of ['other', 'legacy']) assert.ok(!markup.includes('/applications/' + id))
      assert.match(markup, /3 of 5 applications/)
    }
    const none = page(view, 'AWS')
    assert.match(none, /0 of 5 applications/)
    assert.match(none, /No matching applications/)
    for (const [query, id] of [[' Alpha ', 'early'], [' FRONTEND ', 'early'], ['Legacy', 'legacy'], ['Assistant', 'legacy']]) {
      const markup = page(view, query)
      assert.ok(markup.includes('/applications/' + id))
      assert.match(markup, /1 of 5 applications/)
    }
    const filtered = page(view, ' React ', 'Applied', 'latest')
    assert.match(filtered, /2 of 5 applications/)
    assert.ok(!filtered.includes('/applications/saved'))
    assert.ok(filtered.indexOf('/applications/late') < filtered.indexOf('/applications/early'))
    const soonest = page(view, 'react', 'Applied', 'soonest')
    assert.ok(soonest.indexOf('/applications/early') < soonest.indexOf('/applications/late'))
    assert.equal(store.get('interntrack_applications'), original, 'search must not change stored records')
  }
  return 'PASS: actual search controls, required skills, casing/whitespace, unrelated skills, legacy records, company/position, List/Board, status filters, sorting and unchanged storage'
}
