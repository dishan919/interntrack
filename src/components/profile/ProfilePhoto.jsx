import { useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import UserAvatar from '../common/UserAvatar'
import { photoFileError } from '../../utils/profilePhoto'

export default function ProfilePhoto() {
  const { user, updateProfilePhoto } = useAuth()
  const input = useRef(null)
  const saving = useRef(false)
  const [file, setFile] = useState(null)
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  async function change(remove = false) {
    if (saving.current) return
    setError(''); setMessage('')
    const validation = remove ? null : photoFileError(file)
    if (validation) { setError(validation); return }
    saving.current = true
    setPending(remove ? 'Removing photo...' : 'Uploading photo...')
    try {
      await updateProfilePhoto(remove ? null : file)
      setFile(null)
      if (input.current) input.current.value = ''
      setMessage(remove ? 'Profile photo removed.' : 'Profile photo updated.')
    } catch (failure) { setError(failure.message) }
    finally { saving.current = false; setPending('') }
  }
  return <section className="panel profile-panel profile-photo-panel" aria-labelledby="profile-photo-heading" aria-busy={Boolean(pending)}>
    <div className="panel-heading"><h2 id="profile-photo-heading">Profile photo</h2></div>
    <div className="profile-photo-content">
      <UserAvatar user={user} className="profile-photo-avatar" />
      <p id="photo-help">JPEG, PNG or WebP. Maximum 2 MB.</p>
      <label htmlFor="profile-photo-file">Choose profile photo</label>
      <input ref={input} id="profile-photo-file" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="photo-help" disabled={Boolean(pending)} onChange={event => { setFile(event.target.files?.[0] || null); setError(''); setMessage('') }} />
      {error && <p className="notice error" role="alert">{error}</p>}
      {(pending || message) && <p role="status">{pending || message}</p>}
      <div className="note-actions"><button type="button" className="button primary" disabled={Boolean(pending)} onClick={() => change()}>{user.profilePhotoUrl ? 'Change Photo' : 'Upload Photo'}</button>
        {user.profilePhotoUrl && <button type="button" className="button secondary" disabled={Boolean(pending)} onClick={() => change(true)}>Remove Photo</button>}</div>
    </div>
  </section>
}
