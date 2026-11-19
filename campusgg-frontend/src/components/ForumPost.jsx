import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import PostFollowButton from './PostFollowButton.jsx'
import { rememberForumFeed } from '../utils/forumFeedReturn.js'

function relativeTime(value) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return null
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

export default function ForumPost({ id, title, author, createdAt, replyCount, followed, onFollowChange, feedState, feedUrl, feedScope }) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const navigationState = { fromForum: `${location.pathname}${location.search}` }
  const relative = relativeTime(createdAt)
  const exact = relative ? new Date(createdAt).toLocaleString() : 'Unknown time'
  function remember() { rememberForumFeed({ ...feedState, account: token || 'guest', route: navigationState.fromForum, url: feedUrl, scope: feedScope, scrollY: window.scrollY || 0, anchorId: id }) }
  function selectingText(row) {
    const selection = window.getSelection?.()
    return Boolean(selection && !selection.isCollapsed && (row.contains(selection.anchorNode) || row.contains(selection.focusNode)))
  }
  function openRow(event) {
    if (event.defaultPrevented || event.target.closest('a, button, input, select, textarea, summary, [role="button"]') || selectingText(event.currentTarget)) return
    remember(event.currentTarget)
    navigate(`/forum/${id}`, { state: navigationState })
  }
  return <article className="forum-post-card" role="row" onClick={openRow}>
    <div className="forum-post-title-cell" role="cell"><Link className="forum-post-link" to={`/forum/${id}`} state={navigationState} title={title} aria-label={title} onClick={(event) => { const row = event.currentTarget.closest('.forum-post-card'); if (selectingText(row)) event.preventDefault(); else if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && (event.button == null || event.button === 0)) remember(row) }}><span className="forum-post-title">{title}</span></Link><div className="forum-post-mobile-meta">{author || 'Unknown User'} · <time dateTime={relative ? createdAt : undefined} title={exact}>{relative || '—'}</time></div></div>
    <div className="forum-post-poster" role="cell">{author || 'Unknown User'}</div>
    <div className="forum-post-time" role="cell"><time dateTime={relative ? createdAt : undefined} title={exact} aria-label={exact}>{relative || '—'}</time></div>
    <div className="forum-post-replies" role="cell" aria-label={`${replyCount ?? 'Unknown'} replies`}>{replyCount ?? '—'}</div>
    <div className="forum-post-follow" role="cell" onClick={(event) => { if (event.target.closest('button')) event.stopPropagation() }}>{(!token || followed !== undefined) && <PostFollowButton postId={id} postTitle={title} following={followed} onChange={onFollowChange} iconOnly />}</div>
  </article>
}
