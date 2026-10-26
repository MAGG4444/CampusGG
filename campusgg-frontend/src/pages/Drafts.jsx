import { Navigate } from 'react-router-dom'

export default function Drafts() {
  return <Navigate to="/my-content?tab=drafts" replace />
}
