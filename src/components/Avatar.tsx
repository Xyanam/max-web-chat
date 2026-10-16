import { useState } from 'react'
import { avatarColor, initials } from '../lib/format'
import { UserIcon } from './Icons'

interface AvatarProps {
  title: string
  seed: string
  src?: string
  size?: number
}

export function Avatar({ title, seed, src, size = 48 }: AvatarProps) {
  // Remember which link failed so a new link from GetContactInfo is tried again.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = Boolean(src) && src !== failedSrc

  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: avatarColor(seed), fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {showImage ? (
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedSrc(src ?? null)} />
      ) : (
        initials(title) || <UserIcon width={size * 0.5} height={size * 0.5} />
      )}
    </span>
  )
}
