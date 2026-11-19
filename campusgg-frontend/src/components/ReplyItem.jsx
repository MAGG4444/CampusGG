import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, MessageCircle, MoreHorizontal, ThumbsUp } from 'lucide-react'
import { useId, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

const INITIAL_VISIBLE_REPLIES = 3
const MORE_REPLIES = 5

function formatTime(value) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return ''
  const pad = number => String(number).padStart(2, '0')
  return `${date.getFullYear() === new Date().getFullYear() ? '' : `${date.getFullYear()}/`}${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function ReplyEntry({ reply, targetName, subreply, onReply, onEdit, onDelete, onReport, currentUserId, liked, likeReady, onLike, activeComposer, renderComposer, expansionControl, editDraft, onBeginEdit, onChangeEdit, onCancelEdit, onFinishEdit }) {
  const [menu, setMenu] = useState(false)
  const editing = Boolean(editDraft)
  const text = editDraft?.text ?? reply.content
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState('')
  const editorRef = useRef(null)
  const menuRef = useRef(null)
  const popupRef = useRef(null)
  const owner = Boolean(currentUserId && currentUserId === reply.authorId)
  useLayoutEffect(() => {
    const field = editorRef.current
    if (!field) return
    field.style.height = 'auto'
    field.style.height = `${field.scrollHeight}px`
  }, [editing, text])
  useEffect(() => {
    if (!menu) return
    const outside = event => { if (!menuRef.current?.contains(event.target) && !popupRef.current?.contains(event.target)) setMenu(false) }
    const escape = event => { if (event.key === 'Escape') { setMenu(false); menuRef.current?.querySelector('button')?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [menu])
  useLayoutEffect(() => {
    if (!menu) return undefined
    const position = () => {
      const anchor = menuRef.current?.querySelector('button')
      const popup = popupRef.current
      if (!anchor || !popup) return
      const rect = anchor.getBoundingClientRect()
      const width = popup.offsetWidth
      const height = popup.offsetHeight
      popup.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`
      popup.style.top = `${Math.max(8, rect.bottom + 4 + height <= window.innerHeight - 8 ? rect.bottom + 4 : rect.top - height - 4)}px`
    }
    position()
    window.addEventListener('scroll', position, true)
    window.addEventListener('resize', position)
    return () => { window.removeEventListener('scroll', position, true); window.removeEventListener('resize', position) }
  }, [menu])
  async function perform(action) {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { await action() } catch (err) { setError(err.message || 'Unable to update reply.') } finally { pending.current = false; setBusy(false) }
  }
  const context = event => { if (!reply.deletedAt && !editing && subreply && !window.getSelection()?.toString()) { event.preventDefault(); setMenu(true) } }
  return <article className={subreply ? 'subreply' : 'main-reply'} onContextMenu={context}>
    <div className="reply-meta"><span>{reply.author}{subreply && targetName && <> replied to {targetName}</>}</span>
      {!reply.deletedAt && !subreply && <button className="reply-like" type="button" aria-label={liked ? 'Unlike reply' : 'Like reply'} aria-pressed={liked} disabled={busy || !likeReady} onClick={() => perform(() => onLike(reply))}><ThumbsUp size={16} aria-hidden="true" /> {Number(reply.likeCount) || 0}</button>}
    </div>
    {reply.deletedAt ? <p className="reply-deleted-content">This reply has been deleted.</p> : editing ? <form className="reply-edit" onSubmit={event => { event.preventDefault(); if (text.trim()) void perform(async () => { await onEdit(reply, text.trim()); onFinishEdit(reply.id) }) }}>
      <textarea ref={editorRef} aria-label="Edit reply" rows={2} value={text} maxLength={2000} onChange={event => onChangeEdit(reply.id, event.target.value)} />
      {error && <p role="alert">{error}</p>}
      <div className="reply-edit-actions"><button className="reply-target-cancel" type="button" disabled={busy} onClick={() => { setError(''); onCancelEdit(reply.id) }}>Cancel</button><button className="reply-submit-button" type="submit" disabled={busy || !text.trim()}>{busy ? 'Saving...' : 'Save Changes'}</button></div>
    </form> : <p className="reply-content">{reply.content}{subreply && reply.createdAt && <> <time dateTime={reply.createdAt} title={new Date(reply.createdAt).toLocaleString()}>{formatTime(reply.createdAt)}</time></>}</p>}
    {!editing && error && <p role="alert">{error}</p>}
    {!reply.deletedAt && !editing && <div className="reply-actions"><button type="button" onClick={() => onReply(reply)}><MessageCircle size={15} aria-hidden="true" /> Reply</button>
      <div className="reply-menu" ref={menuRef}><button type="button" aria-label={`More actions for ${reply.author}'s reply`} aria-expanded={menu} onClick={() => setMenu(!menu)}><MoreHorizontal size={18} aria-hidden="true" /></button>
        {menu && createPortal(<div ref={popupRef} className="post-more-options reply-menu-popup" role="group" aria-label="Reply actions"><button type="button" disabled title="Comment dislikes are not supported yet">Dislike</button><button type="button" onClick={() => { onReport(reply, menuRef.current?.querySelector('button')); setMenu(false) }}>Report</button>{owner && <><button type="button" onClick={() => { setMenu(false); onBeginEdit(reply) }}>Edit</button><button type="button" disabled={busy} onClick={() => { onDelete(reply, menuRef.current?.querySelector('button')); setMenu(false) }}>Delete</button></>}</div>, document.body)}
      </div>
      {expansionControl}
    </div>}
    {reply.deletedAt && expansionControl && <div className="reply-actions">{expansionControl}</div>}
    {!reply.deletedAt && !editing && activeComposer && renderComposer()}
  </article>
}

function ReplyItem({ reply, replies, onReply, onEdit, onDelete, onReport, currentUserId, liked, likeReady, onLike, replyTarget, renderComposer, newReplyId, editDrafts = {}, onBeginEdit, onChangeEdit, onCancelEdit, onFinishEdit }) {
  const [visibleCount, setVisibleCount] = useState(0)
  const [dismissedReplyId, setDismissedReplyId] = useState(null)
  const childrenId = useId()
  const threadRef = useRef(null)
  const expansionRef = useRef(null)
  const restorePosition = useRef(false)
  useLayoutEffect(() => {
    if (!restorePosition.current) return
    restorePosition.current = false
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    threadRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
    expansionRef.current?.focus({ preventScroll: true })
  }, [visibleCount, dismissedReplyId])
  const byId = new Map(replies.map(item => [item.id, item]))
  const descendants = replies.filter(item => {
    const seen = new Set([item.id])
    let parent = item.parentReplyId
    while (parent && !seen.has(parent)) {
      if (parent === reply.id) return true
      seen.add(parent)
      parent = byId.get(parent)?.parentReplyId
    }
    return false
  }).sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0) || a.id.localeCompare(b.id))
  const newReplyIndex = newReplyId && newReplyId !== dismissedReplyId ? descendants.findIndex(item => item.id === newReplyId) : -1
  const shownCount = Math.min(descendants.length, Math.max(visibleCount, newReplyIndex + 1))
  const isExpanded = shownCount > 0
  function collapse() {
    restorePosition.current = true
    setVisibleCount(0)
    setDismissedReplyId(newReplyId)
  }
  const common = { onReply, onEdit, onDelete, onReport, currentUserId, renderComposer, onBeginEdit, onChangeEdit, onCancelEdit, onFinishEdit }
  const expansionControl = descendants.length > 0 && <button ref={expansionRef} className="reply-collapse-button" type="button" aria-label={isExpanded ? 'Collapse replies' : undefined} aria-expanded={isExpanded} aria-controls={childrenId} onClick={() => { if (isExpanded) collapse(); else setVisibleCount(Math.min(INITIAL_VISIBLE_REPLIES, descendants.length)) }}>{isExpanded ? <ChevronUp size={16} aria-hidden="true" /> : <><span>Show all {descendants.length} replies</span><ChevronDown size={16} aria-hidden="true" /></>}</button>
  return <div className="reply-thread" ref={threadRef}>
    <ReplyEntry {...common} editDraft={editDrafts[reply.id]} reply={reply} liked={liked} likeReady={likeReady} onLike={onLike} activeComposer={replyTarget?.id === reply.id} expansionControl={expansionControl} />
    {descendants.length > 0 && <div className="reply-children" id={childrenId} hidden={!isExpanded}>{isExpanded && <>
      {descendants.slice(0, shownCount).map(item => <ReplyEntry {...common} key={item.id} editDraft={editDrafts[item.id]} reply={item} subreply targetName={byId.get(item.parentReplyId)?.deletedAt ? 'deleted reply' : byId.get(item.parentReplyId)?.author} activeComposer={replyTarget?.id === item.id} />)}
      <div className="reply-pagination">
        {shownCount < descendants.length && <button type="button" className="reply-collapse-button" aria-controls={childrenId} aria-expanded="true" onClick={() => setVisibleCount(Math.min(shownCount + MORE_REPLIES, descendants.length))}><span>Show 5 more replies</span><ChevronDown size={16} aria-hidden="true" /></button>}
        <button type="button" className="reply-collapse-button" aria-label="Collapse replies" aria-controls={childrenId} aria-expanded="true" onClick={collapse}><ChevronUp size={16} aria-hidden="true" /></button>
      </div>
    </>}</div>}
  </div>
}
export default ReplyItem
