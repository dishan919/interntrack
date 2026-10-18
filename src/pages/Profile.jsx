import { useAuth } from '../context/AuthContext'
import '../styles/profile.css'

export default function Profile() {
  const { user, logout } = useAuth()

  return <>
    <div className="page-heading"><div>
      <div className="eyebrow">YOUR ACCOUNT</div>
      <h1>Profile</h1>
      <p>View your InternTrack account information.</p>
    </div></div>
    <section className="panel profile-panel" aria-labelledby="account-heading">
      <div className="panel-heading"><h2 id="account-heading">Account information</h2></div>
      <dl className="profile-fields">
        <div><dt>Full name</dt><dd>{user.name}</dd></div>
        <div><dt>Email address</dt><dd>{user.email}</dd></div>
      </dl>
      <div className="setting-row">
        <div><h3>Your session</h3><p>Sign out when you have finished using your account.</p></div>
        <button type="button" className="button secondary" onClick={logout}>Sign out</button>
      </div>
    </section>
    <p className="profile-note">Profile editing is not available yet.</p>
  </>
}
