import { Gamepad2 } from 'lucide-react'

export default function ChannelLogo({ small = false, size = '' }) {
  return <span className={`community-logo ${small ? 'community-logo-small' : ''} ${size ? `community-logo-${size}` : ''}`}>
    <Gamepad2 size={small ? 16 : 23} aria-hidden="true" />
  </span>
}
