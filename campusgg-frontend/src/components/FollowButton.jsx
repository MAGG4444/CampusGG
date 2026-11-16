import { Link } from 'react-router-dom'
import { useForumFollows } from '../context/forumFollowsContext.js'

export default function FollowButton({ channel }) {
  const state = useForumFollows()
  if (!state) return null
  if (!state.token) return <Link className="forum-follow-button" to="/signin">Sign in to follow</Link>
  const following = state.channels.some((item) => item.id === channel.id)
  return <button className="forum-follow-button" type="button" disabled={state.loading || state.busy[channel.id] || Boolean(state.error)} aria-pressed={following} aria-label={`${following ? 'Unfollow' : 'Follow'} ${channel.name}`} onClick={() => state.toggle(channel, following)}>{state.busy[channel.id] ? 'Updating...' : state.loading ? 'Loading...' : following ? 'Following' : 'Follow'}</button>
}
