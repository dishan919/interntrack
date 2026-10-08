export const STATUSES = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected']
export function formatDate(value) {
  if (!value) return 'Not set'
  return new Date(value + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
export function countStatuses(applications) {
  return Object.fromEntries(STATUSES.map(status => [status, applications.filter(app => app.status === status).length]))
}
export const sampleApplications = [
  { id: 'sample-1', company: 'WSO2', position: 'Software Engineer Intern', location: 'Colombo � Hybrid', jobUrl: 'https://wso2.com/careers/', status: 'Interview', appliedDate: '2026-10-07', interviewDate: '2026-10-15', notes: 'Prepare React fundamentals and review my portfolio projects.', createdAt: '2026-10-07T09:00:00Z' },
  { id: 'sample-2', company: 'IFS', position: 'Frontend Developer Intern', location: 'Colombo', jobUrl: 'https://www.ifs.com/careers', status: 'Applied', appliedDate: '2026-10-06', interviewDate: '', notes: 'Applied through the company careers page.', createdAt: '2026-10-06T09:00:00Z' },
  { id: 'sample-3', company: 'Dialog', position: 'UI/UX Design Intern', location: 'Colombo � On-site', jobUrl: 'https://www.dialog.lk', status: 'Saved', appliedDate: '', interviewDate: '', notes: 'Update portfolio before applying.', createdAt: '2026-10-05T09:00:00Z' },
  { id: 'sample-4', company: 'Virtusa', position: 'Associate Software Engineer', location: 'Colombo', jobUrl: 'https://www.virtusa.com/careers', status: 'Offer', appliedDate: '2026-09-23', interviewDate: '2026-10-02', notes: 'Review the offer details and start date.', createdAt: '2026-09-23T09:00:00Z' },
  { id: 'sample-5', company: 'IFS', position: 'QA Engineer Intern', location: 'Remote', jobUrl: '', status: 'Rejected', appliedDate: '2026-09-20', interviewDate: '', notes: 'Keep practicing automated testing.', createdAt: '2026-09-20T09:00:00Z' },
]
