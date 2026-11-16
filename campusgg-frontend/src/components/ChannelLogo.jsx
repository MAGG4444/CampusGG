import { useState } from 'react'
import { Gamepad2 } from 'lucide-react'
import { channelPresentation } from '../utils/channelPresentation.js'

export default function ChannelLogo({ channel, small = false, size = '' }) {
  const [failed, setFailed] = useState(false)
  const file = channelPresentation[channel.id]?.logo
  const preview = import.meta.env.DEV && import.meta.env.VITE_CHANNEL_LOGO_PREVIEW === '1'
  const src = preview ? `/__channel-logo-preview/${channel.id}` : file && `/assets/game-logos/${file}`
  return <span className={`community-logo ${small ? 'community-logo-small' : ''} ${size ? `community-logo-${size}` : ''}`}>
    {src && !failed ? <img src={src} alt={`${channel.name} logo`} onError={() => setFailed(true)} /> : <Gamepad2 size={small ? 16 : 23} aria-hidden="true" />}
  </span>
}
