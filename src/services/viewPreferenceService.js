const VIEW_KEY = 'interntrack_application_view'
export function loadApplicationView() {
  try { return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list' }
  catch { return 'list' }
}
export function saveApplicationView(view) {
  if (!['list', 'board'].includes(view)) return 'Choose List View or Board View.'
  try { localStorage.setItem(VIEW_KEY, view); return '' }
  catch { return 'This view is active for this session, but the preference could not be saved.' }
}
