import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import React, { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { createServer } from 'vite'
import { readFile } from 'node:fs/promises'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

test('post detail renders compact discussion, permissions and navigation', async () => {
  const oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  const oldObserver = globalThis.IntersectionObserver
  const oldDocument = globalThis.document
  const oldWindow = globalThis.window
  globalThis.window = { addEventListener() {}, removeEventListener() {} }
  const listeners = new Map()
  globalThis.document = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) }
  let focused = false
  const menuNode = { open: false, contains: target => target === 'inside', querySelector: () => ({ focus: () => { focused = true } }) }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  let notifyBackVisibility
  let disconnected = 0
  globalThis.IntersectionObserver = class {
    constructor(callback) { notifyBackVisibility = callback }
    observe() {}
    disconnect() { disconnected += 1 }
  }
  const rendererOptions = { createNodeMock: element => element.props.className === 'post-back-button' ? {} : element.props.className === 'post-more-menu' ? menuNode : null }
  globalThis.__detail = { owner: true, comments: [], recommendationRequests: 0, content: 'Short post\nSecond line', navigation: [] }
  const server = await createServer({ optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
  let renderer
  try {
    let source = (await server.transformRequest('/src/pages/PostDetail.jsx')).code
    const replace = (from, to) => { source = source.replace(JSON.stringify(from), JSON.stringify(to)) }
    replace('/node_modules/react/index.js', import.meta.resolve('react'))
    replace('/node_modules/react/jsx-dev-runtime.js', import.meta.resolve('react/jsx-dev-runtime'))
    replace('/node_modules/lucide-react/dist/esm/lucide-react.mjs', import.meta.resolve('lucide-react'))
    replace('/node_modules/react-router-dom/dist/index.mjs', moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export const useParams=()=>({postId:'p1'}); export const useLocation=()=>({state:globalThis.__detail.locationState||null}); export const useNavigate=()=>path=>globalThis.__detail.navigation.push(path); export const useBlocker=()=>({state:'unblocked'}); export const Link=p=>React.createElement('a',{href:p.to,className:p.className},p.children)`))
    replace('/src/components/DraftNavigationDialog.jsx', moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export default function Dialog({blocker}){return blocker.state==='blocked'?React.createElement('div',null,React.createElement('button',{onClick:()=>blocker.reset()},'Keep Editing'),React.createElement('button',{onClick:()=>blocker.proceed()},'Discard Changes')):null}`))
    replace('/src/components/ConfirmationModal.jsx', moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export default p=>React.createElement('div',{'data-confirmation':p.title},p.error,React.createElement('button',{onClick:p.onCancel},'Cancel deletion'),React.createElement('button',{onClick:p.onConfirm,disabled:p.busy},p.confirmLabel))`))
    replace('/src/context/useAuth.js', moduleUrl("export const useAuth=()=>({token:'token',user:{id:globalThis.__detail.owner?'owner':'other'}})"))
    replace('/src/components/notifications/useNotifications.js', moduleUrl("export const useNotifications=()=>({addNotification:notification=>globalThis.__detail.notification=notification})"))
    replace('/src/context/forumChannelsContext.js', moduleUrl("export const useForumChannels=()=>({channels:[{name:'Valorant',slug:'valorant',aliases:['valorant']}]})"))
    replace('/src/utils/myContentNavigation.js', moduleUrl("export const myContentReturnTo=(_state,fallback)=>fallback"))
    replace('/src/hooks/useInfiniteForumFeed.js', moduleUrl('export const invalidateForumFeedCache=()=>{globalThis.__detail.invalidations=(globalThis.__detail.invalidations||0)+1}'))
    replace('/src/components/PostFollowButton.jsx', moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export default function Follow(){return React.createElement('button',null,'Following')}`))
    replace('/src/components/ReportDialog.jsx', moduleUrl('export default function ReportDialog(){return null}'))
    replace('/src/components/ReplyItem.jsx', moduleUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export default function Reply({reply,replies,onReply,onDelete,replyTarget,renderComposer}){return React.createElement('article',null,reply.content,React.createElement('button',{onClick:()=>onReply(reply)},'Reply to '+reply.author),React.createElement('button',{onClick:()=>onDelete(reply)},'Delete reply '+reply.id),replyTarget?.id===reply.id&&renderComposer(),replies.filter(child=>child.parentReplyId===reply.id).map(child=>React.createElement('div',{key:child.id},React.createElement('button',{onClick:()=>onReply(child)},'Reply to '+child.author),replyTarget?.id===child.id&&renderComposer())))}`))
    replace('/src/api/forum.js', moduleUrl(`export const getForumPost=async()=>({id:'p1',title:'A title',game:'Valorant',content:globalThis.__detail.content,author:{id:'owner',displayName:'Author'},likeCount:2}); export const getAllForumComments=async()=>globalThis.__detail.comments; export const getMyForumLike=async()=>{globalThis.__detail.likeReads=(globalThis.__detail.likeReads||0)+1;if(globalThis.__detail.likePending)await globalThis.__detail.likePending;return {liked:true}}; export const getMyCommentLikes=async()=>({ids:[]}); export const setCommentLike=async()=>({likeCount:1}); export const reportForumContent=async()=>({submitted:true}); export const getForumRecommendations=async()=>{globalThis.__detail.recommendationRequests++; return []}; export const likeForumPost=async()=>({likeCount:3}); export const unlikeForumPost=async()=>({likeCount:1}); export const createForumComment=async(_post,content,_token,parent)=>{globalThis.__detail.calls=(globalThis.__detail.calls||[]).concat([{content,parent}]); if(globalThis.__detail.pending) await globalThis.__detail.pending; return {id:'new',content,author:{id:'owner',username:'Author'}}}; export const updateForumComment=async()=>({}); export const deleteForumComment=async(_post,id)=>{globalThis.__detail.deletedReplies=(globalThis.__detail.deletedReplies||[]).concat(id);if(globalThis.__detail.replyDeleteError)throw new Error(globalThis.__detail.replyDeleteError);return {tombstone:false}}; export const updateForumPost=async(id,body)=>{globalThis.__detail.updates=(globalThis.__detail.updates||[]).concat([{id,body}]); if(globalThis.__detail.updateError) throw new Error(globalThis.__detail.updateError); if(globalThis.__detail.updatePending) await globalThis.__detail.updatePending; return {id,title:body.title,content:body.content,game:"Valorant",author:{id:"owner",displayName:"Author"},likeCount:2}}; export const deleteForumPost=async()=>{globalThis.__detail.deletes=(globalThis.__detail.deletes||0)+1;if(globalThis.__detail.deleteError)throw new Error(globalThis.__detail.deleteError);if(globalThis.__detail.deletePending)await globalThis.__detail.deletePending}`))
    source = source.replace(/import ".*?\.css";/g, '')
    const { default: PostDetail } = await import(moduleUrl(source))
    await act(async () => { renderer = TestRenderer.create(React.createElement(PostDetail), rendererOptions); await tick(); await tick() })
    assert.equal(renderer.root.findByType('h1').children[0], 'A title')
    const reading = renderer.root.findByProps({ className: 'post-detail-reading' })
    assert.equal(reading.findAllByProps({ className: 'post-detail-header' }).length, 1)
    assert.equal(reading.findAllByProps({ className: 'post-replies' }).length, 1)
    assert.equal(renderer.root.findByProps({ className: 'reply-heading' }).findByType('h2').children[0], 'Replies')
    assert.equal(renderer.root.findByProps({ 'aria-label': 'Sort replies' }).type, 'select')
    assert.equal(renderer.root.findByProps({ className: 'reply-heading' }).findAllByType('label').length, 0)
    menuNode.open = true
    listeners.get('pointerdown')({ target: 'inside' })
    assert.equal(menuNode.open, true)
    listeners.get('pointerdown')({ target: 'outside' })
    assert.equal(menuNode.open, false)
    menuNode.open = true
    listeners.get('keydown')({ key: 'Escape' })
    assert.equal(menuNode.open, false)
    assert.equal(focused, true)
    const stickyBack = () => renderer.root.findByProps({ 'aria-label': 'Back to Forum from replies' })
    assert.equal(stickyBack().props['aria-hidden'], true)
    assert.equal(stickyBack().props.tabIndex, -1)
    await act(async () => notifyBackVisibility([{ isIntersecting: false, boundingClientRect: { bottom: 900 } }]))
    assert.equal(stickyBack().props['aria-hidden'], true)
    await act(async () => notifyBackVisibility([{ isIntersecting: true, boundingClientRect: { bottom: 100 } }]))
    assert.equal(stickyBack().props['aria-hidden'], true)
    await act(async () => notifyBackVisibility([{ isIntersecting: false, boundingClientRect: { bottom: -1 } }]))
    assert.equal(stickyBack().props['aria-hidden'], false)
    assert.equal(stickyBack().props.tabIndex, 0)
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Back to Forum from replies' }).props.onClick())
    assert.equal(globalThis.__detail.navigation.at(-1), '/forum')
    await act(async () => notifyBackVisibility([{ isIntersecting: true, boundingClientRect: { bottom: 100 } }]))
    assert.equal(stickyBack().props['aria-hidden'], true)
    await act(async () => renderer.root.findByType('select').props.onChange({target:{value:'popular'}}))
    assert.equal(renderer.root.findByType('select').props.value, 'popular')
    assert.equal(renderer.root.findByProps({ className: 'post-detail-box' }).findByType('p').children[0], 'Short post\nSecond line')
    assert.equal(renderer.root.findByType('a').props.href, '/forum/channel/valorant')
    assert.equal(renderer.root.findByProps({ 'aria-label': 'Unlike post' }).props['aria-pressed'], true)
    let resolveLike
    globalThis.__detail.likePending = new Promise(resolve => { resolveLike = resolve })
    const likeReads = globalThis.__detail.likeReads
    const toggleLike = renderer.root.findByProps({ 'aria-label': 'Unlike post' }).props.onClick
    await act(async () => { void toggleLike(); void toggleLike() })
    assert.equal(globalThis.__detail.likeReads, likeReads + 1)
    await act(async () => { resolveLike(); await globalThis.__detail.likePending })
    globalThis.__detail.likePending = null
    assert.equal(renderer.root.findAllByProps({ className: 'similar-section' }).length, 0)
    assert.equal(renderer.root.findAllByProps({ className: 'post-detail-pagination' }).length, 0)
    assert.equal(renderer.root.findAllByProps({ className: 'post-replies-empty' }).length, 1)
    assert.equal(globalThis.__detail.recommendationRequests, 0)
    assert.equal(renderer.root.findAllByProps({ className: 'reply-form' }).length, 0)
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Reply to post' }).props.onClick())
    assert.equal(renderer.root.findByProps({ className: 'post-detail-reading' }).findAllByProps({ className: 'reply-form' }).length, 1)
    assert.equal(renderer.root.findAllByProps({ className: 'reply-target-row' }).length, 0)
    assert.equal(renderer.root.findByProps({ id: 'post-reply' }).props.placeholder, 'Reply Post')
    assert.equal(renderer.root.findAllByType('label').find(label => label.props.htmlFor === 'post-reply').children[0], 'Add a reply')
    assert.equal(renderer.root.findAllByProps({ id: 'reply-keyboard-hint' }).length, 0)
    assert.deepEqual(renderer.root.findByProps({ className: 'reply-form-actions' }).findAllByType('button').map(button => button.props.type), ['button', 'submit'])
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Reply to post' }).props.onClick())
    assert.equal(renderer.root.findAllByProps({ className: 'reply-form' }).length, 0)
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Reply to post' }).props.onClick())
    const key = (overrides = {}) => { let prevented = false; const event = { key:'Enter', preventDefault:() => { prevented = true }, ...overrides }; renderer.root.findByProps({ id: 'post-reply' }).props.onKeyDown(event); return prevented }
    await act(async () => { assert.equal(key(), true) })
    assert.equal(globalThis.__detail.calls, undefined)
    await act(async () => renderer.root.findByProps({ id: 'post-reply' }).props.onChange({ target: { value: '你好' } }))
    await act(async () => { assert.equal(key({shiftKey:true}), false); assert.equal(key({nativeEvent:{isComposing:true}}), false); assert.equal(key({keyCode:229}), false) })
    await act(async () => { renderer.root.findByProps({ id: 'post-reply' }).props.onCompositionStart(); assert.equal(key(), false); renderer.root.findByProps({ id: 'post-reply' }).props.onCompositionEnd() })
    let resolveReply
    globalThis.__detail.pending = new Promise(resolve => { resolveReply = resolve })
    await act(async () => { assert.equal(key(), true); assert.equal(key(), true) })
    assert.deepEqual(globalThis.__detail.calls, [{content:'你好',parent:undefined}])
    await act(async () => { resolveReply(); await tick() })
    globalThis.__detail.pending = null
    assert.equal(globalThis.__detail.notification.type, 'success')
    assert.equal(renderer.root.findAllByProps({ className: 'reply-form' }).length, 0)
    assert.equal(renderer.root.findAllByType('button').some(button => button.children.some(child => typeof child === 'string' && child.trim() === 'Edit')), true)
    const edit = () => renderer.root.findAllByType('button').find(button => button.children.some(child => typeof child === 'string' && child.trim() === 'Edit'))
    await act(async () => edit().props.onClick())
    assert.equal(renderer.root.findByProps({ 'aria-label': 'Post title' }).props.value, 'A title')
    assert.equal(renderer.root.findByProps({ 'aria-label': 'Post content' }).props.value, 'Short post\nSecond line')
    assert.equal(renderer.root.findAllByProps({ id: 'edit-post-game' }).length, 0)
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Post title' }).props.onChange({ target: { value: 'Changed title' } }))
    await act(async () => renderer.root.findByProps({ className: 'post-edit-actions' }).findAllByType('button')[0].props.onClick())
    assert.equal(renderer.root.findByProps({ 'aria-label': 'Post title' }).props.value, 'Changed title')
    await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('Keep Editing')).props.onClick())
    assert.equal(renderer.root.findByProps({ 'aria-label': 'Post title' }).props.value, 'Changed title')
    await act(async () => renderer.root.findByProps({ className: 'post-edit-actions' }).findAllByType('button')[0].props.onClick())
    await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('Discard Changes')).props.onClick())
    assert.equal(renderer.root.findByType('h1').children[0], 'A title')
    assert.equal(globalThis.__detail.updates, undefined)
    await act(async () => edit().props.onClick())
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Post title' }).props.onChange({ target: { value: 'Updated title' } }))
    globalThis.__detail.updateError = 'Not authorized'
    await act(async () => { await renderer.root.findByProps({ id: 'post-edit-form' }).props.onSubmit({ preventDefault() {} }) })
    assert.equal(renderer.root.findByProps({ 'aria-label': 'Post title' }).props.value, 'Updated title')
    assert.match(renderer.root.findByProps({ className: 'post-detail-feedback' }).children[0], /Not authorized/)
    delete globalThis.__detail.updateError
    let resolveUpdate
    globalThis.__detail.updatePending = new Promise(resolve => { resolveUpdate = resolve })
    const submitEdit = renderer.root.findByProps({ id: 'post-edit-form' }).props.onSubmit
    await act(async () => { void submitEdit({ preventDefault() {} }); void submitEdit({ preventDefault() {} }) })
    assert.equal(globalThis.__detail.updates.length, 2)
    assert.deepEqual(globalThis.__detail.updates.at(-1), { id: 'p1', body: { title: 'Updated title', content: 'Short post\nSecond line' } })
    await act(async () => { resolveUpdate(); await tick() })
    assert.equal(renderer.root.findByType('h1').children[0], 'Updated title')
    assert.equal(globalThis.__detail.invalidations, 1)
    const deletePost = () => renderer.root.findAllByType('button').find(button => button.children.some(child => typeof child === 'string' && child.trim() === 'Delete'))
    await act(async () => deletePost().props.onClick())
    assert.equal(renderer.root.findByProps({ 'data-confirmation': 'Delete this post?' }).type, 'div')
    assert.equal(globalThis.__detail.deletes, undefined)
    await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('Cancel deletion')).props.onClick())
    assert.equal(globalThis.__detail.deletes, undefined)
    await act(async () => deletePost().props.onClick())
    globalThis.__detail.deleteError = 'Forbidden'
    await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('Delete Post')).props.onClick())
    assert.match(renderer.root.findByProps({ 'data-confirmation': 'Delete this post?' }).children[0], /Forbidden/)
    delete globalThis.__detail.deleteError
    let resolveDelete
    globalThis.__detail.deletePending = new Promise(resolve => { resolveDelete = resolve })
    const confirm = renderer.root.findAllByType('button').find(button => button.children.includes('Delete Post')).props.onClick
    await act(async () => { void confirm(); void confirm() })
    assert.equal(globalThis.__detail.deletes, 2)
    await act(async () => { resolveDelete(); await globalThis.__detail.deletePending; await tick() })
    assert.equal(renderer.root.findAllByProps({ 'data-confirmation': 'Delete this post?' }).length, 0)
    assert.equal(globalThis.__detail.invalidations, 2)
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Back to Forum' }).props.onClick())
    assert.equal(globalThis.__detail.navigation.at(-1), '/forum')
    await act(async () => renderer.unmount())
    assert.equal(disconnected, 1)
    globalThis.__detail.owner = false
    globalThis.__detail.locationState = {fromForum:'/forum/channel/valorant?sort=new'}
    globalThis.__detail.content = 'Long content '.repeat(1000)
    globalThis.__detail.comments = [{ id:'c1', content:'A reply', author:{ id:'a', username:'Reader' } }, { id:'c2', content:'Another reply', author:{ id:'b', username:'Other' } }, { id:'c3', parentReplyId:'c1', content:'Nested', author:{ id:'c', username:'Nested Reader' } }]
    await act(async () => { renderer = TestRenderer.create(React.createElement(PostDetail), rendererOptions); await tick(); await tick() })
    await act(async () => notifyBackVisibility([{ isIntersecting: false, boundingClientRect: { bottom: -1 } }]))
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Back to Forum from replies' }).props.onClick())
    assert.equal(globalThis.__detail.navigation.at(-1), '/forum/channel/valorant?sort=new')
    assert.equal(renderer.root.findByProps({ className: 'post-detail-box' }).findByType('p').children[0], globalThis.__detail.content)
    assert.equal(renderer.root.findAllByProps({ className: 'post-replies-empty' }).length, 0)
    assert.equal(renderer.root.findAllByType('article').some(article => article.children.includes('A reply')), true)
    const firstReply = renderer.root.findAllByType('article').find(article => article.children.includes('A reply'))
    delete globalThis.__detail.notification
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Unlike post' }).props.onClick())
    assert.equal(globalThis.__detail.notification, undefined)
    assert.equal(renderer.root.findAllByType('article').find(article => article.children.includes('A reply')), firstReply)
    await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('Reply to Reader')).props.onClick())
    assert.equal(firstReply.findAllByProps({className:'reply-form'}).length, 1)
    await act(async () => renderer.root.findByProps({ id:'post-reply' }).props.onChange({target:{value:'Reply text'}}))
    await act(async () => renderer.root.findByProps({ id:'post-reply' }).props.onKeyDown({key:'Enter',preventDefault(){}}))
    assert.equal(globalThis.__detail.calls.at(-1).parent, 'c1')
    await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('Reply to Nested Reader')).props.onClick())
    await act(async () => renderer.root.findByProps({ id:'post-reply' }).props.onChange({target:{value:'Nested reply'}}))
    await act(async () => renderer.root.findByProps({ id:'post-reply' }).props.onKeyDown({key:'Enter',preventDefault(){}}))
    assert.equal(globalThis.__detail.calls.at(-1).parent, 'c3')
    await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('Reply to Reader')).props.onClick())
    await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('Reply to Reader')).props.onClick())
    assert.equal(renderer.root.findAllByProps({className:'reply-form'}).length, 0)
    await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('Reply to Reader')).props.onClick())
    await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('Reply to Other')).props.onClick())
    assert.equal(renderer.root.findAllByProps({className:'reply-form'}).length, 1)
    assert.equal(renderer.root.findAllByType('article').find(article => article.children.includes('Another reply')).findAllByProps({className:'reply-form'}).length, 1)
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Reply to post' }).props.onClick())
    assert.equal(renderer.root.findAllByProps({className:'reply-form'}).length, 1)
    assert.equal(renderer.root.findByProps({className:'post-detail-reading'}).findAllByProps({className:'reply-form'}).length, 1)
    assert.equal(renderer.root.findAllByType('button').some(button => button.children.some(child => typeof child === 'string' && child.trim() === 'Edit')), false)
    await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('Delete reply c1')).props.onClick())
    assert.equal(globalThis.__detail.deletedReplies, undefined)
    globalThis.__detail.replyDeleteError = 'Delete replies before deleting this comment'
    await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('Delete Reply')).props.onClick())
    assert.match(renderer.root.findByProps({ 'data-confirmation': 'Delete this reply?' }).children[0], /Delete replies before/)
    assert.equal(renderer.root.findAllByType('article').some(article => article.children.includes('A reply')), true)
    await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('Cancel deletion')).props.onClick())
    delete globalThis.__detail.replyDeleteError
    await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('Delete reply c2')).props.onClick())
    await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('Delete Reply')).props.onClick())
    assert.deepEqual(globalThis.__detail.deletedReplies, ['c1', 'c2'])
    assert.equal(renderer.root.findAllByType('article').some(article => article.children.includes('Another reply')), false)
    assert.equal(renderer.root.findAllByType('article').some(article => article.children.includes('A reply')), true)
    assert.equal(renderer.root.findAllByType('a').filter(link => link.props.className === 'similar-post-button').length, 0)
    assert.equal(renderer.root.findAllByProps({ className: 'post-detail-pagination' }).length, 0)
    assert.equal(globalThis.__detail.recommendationRequests, 0)
    assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /Similar Recommendations|Another post/)
    await act(async () => renderer.unmount())
    renderer = null
    assert.equal(disconnected, 2)
  } finally {
    if (renderer) await act(async () => renderer.unmount())
    globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct
    globalThis.document = oldDocument
    globalThis.window = oldWindow
    globalThis.IntersectionObserver = oldObserver
    delete globalThis.__detail
    await server.close()
  }
})

test('post body uses natural height and actions sit beneath it', async () => {
  const css = await readFile(new URL('../src/pages/PostDetail.css', import.meta.url), 'utf8')
  assert.match(css, /\.post-content-row\s*\{\s*display:\s*block/)
  const body = css.match(/\.post-detail-box\s*\{([^}]*)\}/)[1]
  assert.doesNotMatch(body, /(?:min-)?height\s*:/)
  assert.match(css, /\.post-detail-header\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*space-between/)
  assert.match(css, /\.post-content-row\s*>\s*\.post-detail-actions\s*\{[^}]*gap:/)
  assert.doesNotMatch(css.match(/\.reply-list\s*\{([^}]*)\}/)?.[1] || '', /overflow|max-height|height\s*:/)
  assert.match(css, /\.reply-heading\s*\{[^}]*position:\s*sticky;[^}]*top:\s*var\(--connection-sidebar-top/)
  assert.match(css, /background-image:\s*var\(--app-page-background\)/)
  assert.match(css, /\.reply-heading-back\s*\{[^}]*position:\s*absolute/)
  assert.match(css, /\.reply-heading-back\[aria-hidden='true'\]\s*\{[^}]*visibility:\s*hidden/)
  const appCss = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')
  assert.match(appCss, /\.app-shell\s*\{[^}]*overflow:\s*clip/)
})
