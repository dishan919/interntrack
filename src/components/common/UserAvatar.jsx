import { useState } from 'react'
import { photoSource } from '../../utils/profilePhoto'

export default function UserAvatar({ user, className = '' }) {
  const source = photoSource(user?.profilePhotoUrl)
  // A changed URL gets a fresh image/fallback state without effect timing races.
  return <AvatarImage key={source || 'initials'} source={source} user={user} className={className} />
}

function AvatarImage({ source, user, className }) {
  const [failed, setFailed] = useState(false)
  const initial = user?.name?.trim().charAt(0).toUpperCase() || 'U'
  return <span className={`user-avatar ${className}`}>
    {source && !failed ? <img src={source} alt={`${user.name}'s profile photo`} onError={() => setFailed(true)} /> : <span aria-label={`${user?.name || 'User'} avatar`}>{initial}</span>}
  </span>
}
