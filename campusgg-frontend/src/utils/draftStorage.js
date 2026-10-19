const PREFIX = 'campusgg-draft:v1:'

export const draftDefaults = {
  lobby: {
    lobbyName: '', subtitle: '', administratorInput: '', administrators: [],
    tags: ['All Categories'], details: '', participantLimit: 'unlimited', visibility: 'public',
  },
  post: {
    title: '', subtitle: '', tag: 'All Categories', game: '', content: '', visibility: 'Public',
  },
}

const tags = ['All Categories', 'Strategy', 'LFG', 'Meta Analysis', 'Tournaments']
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isId = (value) => typeof value === 'string' && value.trim().length > 0
const isDate = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value))

// Only known form fields cross the persistence boundary; never copy auth/session data.
function sanitizeForm(type, data) {
  if (!Object.hasOwn(draftDefaults, type) || !isObject(data)) throw new Error('Invalid draft data.')
  const result = {}
  for (const [field, defaultValue] of Object.entries(draftDefaults[type])) {
    const value = data[field]
    if (field === 'participantLimit') {
      if (!['unlimited', 20, 50, 100].includes(value)) throw new Error('Invalid participant limit.')
    } else if (Array.isArray(defaultValue)) {
      if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
        throw new Error('Invalid draft list.')
      }
    } else if (typeof value !== 'string') {
      throw new Error('Invalid draft field.')
    }
    result[field] = Array.isArray(value) ? [...value] : value
  }
  const selectedTags = type === 'lobby' ? result.tags : [result.tag]
  const visibility = type === 'lobby'
    ? ['public', 'private', 'friends']
    : ['Public', 'Private', 'Visible to Lobby Members']
  if (!selectedTags.every((tag) => tags.includes(tag)) || !visibility.includes(result.visibility)) {
    throw new Error('Invalid draft options.')
  }
  return result
}

function userPrefix(userId) {
  if (!isId(userId)) throw new Error('Please sign in to manage drafts.')
  return `${PREFIX}${encodeURIComponent(userId)}:`
}

function draftKey(userId, id) {
  if (!isId(id)) throw new Error('Invalid draft ID.')
  return `${userPrefix(userId)}${encodeURIComponent(id)}`
}

function parseDraft(raw, userId, key) {
  const draft = JSON.parse(raw)
  if (!isObject(draft) || draft.userId !== userId || !isId(draft.id)
    || !isDate(draft.createdAt) || !isDate(draft.updatedAt)
    || Date.parse(draft.updatedAt) < Date.parse(draft.createdAt)
    || draftKey(userId, draft.id) !== key) {
    throw new Error('Invalid stored draft.')
  }
  return {
    id: draft.id, userId, type: draft.type,
    formData: sanitizeForm(draft.type, draft.formData),
    createdAt: draft.createdAt, updatedAt: draft.updatedAt,
  }
}

export function listDrafts(userId, storage = localStorage) {
  const prefix = userPrefix(userId)
  const drafts = []
  let invalidCount = 0
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key?.startsWith(prefix)) continue
    const raw = storage.getItem(key)
    try {
      drafts.push(parseDraft(raw, userId, key))
    } catch {
      invalidCount += 1
    }
  }
  drafts.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  return { drafts, invalidCount }
}

export function getDraft(userId, id, type, storage = localStorage) {
  const key = draftKey(userId, id)
  const raw = storage.getItem(key)
  if (raw === null) throw new Error('Draft not found for this account.')
  const draft = parseDraft(raw, userId, key)
  if (draft.type !== type) throw new Error('This draft belongs to a different editor.')
  return draft
}

export function saveDraft(userId, type, formData, id = null, storage = localStorage) {
  userPrefix(userId)
  const data = sanitizeForm(type, formData)
  // An update must already exist. Never resurrect a deleted draft or take over another user's ID.
  const previous = id === null ? null : getDraft(userId, id, type, storage)
  const now = new Date().toISOString()
  const draft = {
    id: previous?.id ?? crypto.randomUUID(), userId, type, formData: data,
    createdAt: previous?.createdAt ?? now, updatedAt: now,
  }
  storage.setItem(draftKey(userId, draft.id), JSON.stringify(draft))
  return draft
}

export function deleteDraft(userId, id, storage = localStorage) {
  storage.removeItem(draftKey(userId, id))
}
