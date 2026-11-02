import './VersionLabel.css'

const version = import.meta.env.VITE_APP_VERSION || '0.1.0'

function VersionLabel({ className = '' }) {
  const classes = ['version-label', className].filter(Boolean).join(' ')

  return <span className={classes}>CampusGG v{version}</span>
}

export default VersionLabel
