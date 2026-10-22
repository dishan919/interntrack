import { useAuth } from '../context/AuthContext'
import Icon from '../components/common/Icon'
import ApplicationOverview from '../components/dashboard/ApplicationOverview'
import RecentActivity from '../components/dashboard/RecentActivity'
import { getUpcomingFollowUps } from '../utils/followUpUtils'
import UpcomingFollowUps from '../components/dashboard/UpcomingFollowUps'
import { getBestSkillMatches } from '../utils/skillUtils'
import InterviewBadge from '../components/applications/InterviewBadge'
import { formatInterviewTime, getUpcomingInterviews } from '../utils/interviewUtils'
import DeadlineBadge from '../components/applications/DeadlineBadge'
import { getUpcomingDeadlines } from '../utils/deadlineUtils'
import useDeadlineToday from '../utils/useDeadlineToday'
import { Link } from 'react-router-dom'
import { useApplications } from '../context/ApplicationContext'
import StatCard from '../components/common/StatCard'
import EmptyState from '../components/common/EmptyState'
import ApplicationCard from '../components/applications/ApplicationCard'
import { countStatuses, formatDate } from '../utils/applications'
import '../styles/dashboard.css'

export default function Dashboard() {
  const { user } = useAuth()
  const today = useDeadlineToday()
  const { applications } = useApplications()
  const upcomingDeadlines = getUpcomingDeadlines(applications, today)
  const bestMatches = getBestSkillMatches(applications)
  const counts = countStatuses(applications)
  const recent = [...applications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
  const pendingFollowUps = getUpcomingFollowUps(applications, today, applications.length).length
  const upcoming = getUpcomingInterviews(applications, today)

  return <div className="dashboard-page">
    <header className="dashboard-header">
      <div>
        <p className="dashboard-welcome">YOUR PERSONAL WORKSPACE</p>
        <h1>Welcome back, {user?.name?.trim().split(/\s+/)[0] || 'there'}<span className="greeting-dot">.</span></h1>
        <p className="dashboard-intro">Track your applications. Make room for what comes next.</p>
      </div>
      <Link className="button primary dashboard-add" to="/applications/new"><Icon name="plus" /> Add application</Link>
    </header>

    <div className="stats-grid" role="group" aria-label="Application statistics">
      <StatCard label="Total applications" value={applications.length} icon="applications" description="Every opportunity, in one place" />
      <StatCard label="Applied" value={counts.Applied} icon="arrow" tone="blue" description="Applications in progress" />
      <StatCard label="Interviews" value={counts.Interview} icon="calendar" tone="purple" description="In the interview stage" />
      <StatCard label="Offers" value={counts.Offer} icon="check" tone="green" description="New chapters ahead" />
      <StatCard label="Pending follow-ups" value={pendingFollowUps} icon="clock" description="Incomplete scheduled reminders" />
    </div>

    <div className="dashboard-main-grid">
    <ApplicationOverview counts={counts} total={applications.length} />
    <section className="panel recent-panel" aria-labelledby="dashboard-recent-title">
      <div className="panel-heading">
        <div><h2 id="dashboard-recent-title">Recent applications</h2><p>Your latest opportunities, all in one place.</p></div>
        <Link className="subtle-link" to="/applications">View all <span aria-hidden="true">↗</span></Link>
      </div>
      {recent.length ? recent.map(app => <ApplicationCard key={app.id} application={app} compact />) : <EmptyState />}
    </section>

    </div>
    <div className="dashboard-attention-grid">
      <section className="panel upcoming-panel" aria-labelledby="dashboard-interviews-title">
        <div className="panel-heading"><div><h2 id="dashboard-interviews-title">Upcoming Interviews</h2><p>Prepare for your next conversation.</p></div><span className="dashboard-section-count" aria-label={`${upcoming.length} upcoming interviews`}>{upcoming.length}</span></div>
        {upcoming.length ? upcoming.map(({ application: app, interview }) => <Link className="interview-item" key={app.id} to={'/applications/' + app.id}>
          <span className="interview-day">{Number(interview.date.slice(-2))}<small>{new Date(interview.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short' })}</small></span>
          <div className="upcoming-interview-info">
            <strong>{app.company}</strong><span>{app.position || 'Position not set'}</span>
            <small>{formatDate(interview.date)}{interview.time && <> · {formatInterviewTime(interview.time)}</>}</small>
            {(interview.stage || interview.type) && <span className="dashboard-interview-meta">{[interview.stage, interview.type].filter(Boolean).join(' · ')}</span>}
            <InterviewBadge interview={interview} now={today} />
          </div>
          <span className="dashboard-item-arrow" aria-hidden="true">↗</span>
        </Link>) : <div className="quiet-state"><span className="dashboard-empty-symbol" aria-hidden="true">◷</span><strong>No upcoming interviews</strong><p>Your next conversation will appear here when scheduled.</p></div>}
      </section>

      <section className="panel deadlines-panel" aria-labelledby="dashboard-deadlines-title">
        <div className="panel-heading"><div><h2 id="dashboard-deadlines-title">Upcoming Deadlines</h2><p>Your next application deadlines, closest first.</p></div><span className="dashboard-section-count" aria-label={`${upcomingDeadlines.length} upcoming deadlines`}>{upcomingDeadlines.length}</span></div>
        {upcomingDeadlines.length ? upcomingDeadlines.map(app => <Link className="deadline-item" key={app.id} to={'/applications/' + app.id}>
          <div className="deadline-opportunity"><strong>{app.company}</strong><span>{app.position}</span></div>
          <span className="deadline-date">{formatDate(app.deadline)}</span><DeadlineBadge deadline={app.deadline} today={today} />
        </Link>) : <div className="quiet-state"><span className="dashboard-empty-symbol" aria-hidden="true">▦</span><strong>No upcoming deadlines</strong><p>Add an optional deadline when creating or editing an application.</p></div>}
      </section>

      <UpcomingFollowUps applications={applications} today={today} />

      <section className="panel best-skills-panel" aria-labelledby="dashboard-skills-title">
        <div className="panel-heading"><div><h2 id="dashboard-skills-title">Best Skill Matches</h2><p>Opportunities that match the skills you already have.</p></div></div>
        {bestMatches.length ? bestMatches.map(({ application: app, match }) => <Link className="best-skill-item" key={app.id} to={'/applications/' + app.id}>
          <div className="deadline-opportunity"><strong>{app.company}</strong><span>{app.position || 'Position not set'}</span></div><span className="skill-match-indicator">{match.percentage}% match</span>
        </Link>) : <div className="quiet-state"><span className="dashboard-empty-symbol" aria-hidden="true">◇</span><strong>Find your strongest matches</strong><p>Add required skills when creating or editing an application to see your best matches.</p></div>}
      </section>
      <RecentActivity applications={applications} />
    </div>
  </div>
}
