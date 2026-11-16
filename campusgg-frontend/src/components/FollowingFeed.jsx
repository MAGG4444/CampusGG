import { Link } from 'react-router-dom'
import { useForumFollows } from '../context/forumFollowsContext.js'
import InfinitePostList from './InfinitePostList.jsx'

export default function FollowingFeed({ catalog }) {
  const follows = useForumFollows()
  if (!follows.token) return <div className="forum-explore-state"><p>Sign in to see posts from followed channels.</p><Link to="/signin">Sign in</Link></div>
  if (follows.loading) return <div className="forum-explore-state" role="status">Loading followed channels...</div>
  if (follows.error) return <div className="forum-explore-state" role="alert"><p>{follows.error}</p><button type="button" onClick={follows.refresh}>Try again</button></div>
  if (!follows.channels.length) return <div className="forum-explore-state"><p>You are not following any channels yet.</p><Link to="/forum/explore">Explore game channels</Link></div>
  const url = '/forum/me/following/posts'
  const scope = `${follows.token}:${follows.version}`
  return <InfinitePostList key={`${scope}:${url}`} url={url} token={follows.token} scope={scope} catalog={catalog} emptyMessage="No posts in your followed channels yet." />
}
