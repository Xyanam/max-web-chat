import { avatarColor, initials } from '../lib/format'
import { UserIcon } from './Icons'

export function Avatar({ title, seed, size = 48 }: { title: string; seed: string; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: avatarColor(seed), fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials(title) || <UserIcon width={size * 0.5} height={size * 0.5} />}
    </span>
  )
}
