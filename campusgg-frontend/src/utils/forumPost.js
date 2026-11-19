function createPostPreview(content, maxLength = 240) {
  const text = typeof content === 'string'
    ? content.trim().replace(/\s+/g, ' ')
    : ''
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1).trimEnd()}…`
}

export function normalizePost(post, replyCount) {
  return {
    id: post.id,
    title: post.title,

    author:
      post.author?.username ||
      post.author?.displayName ||
      'Unknown User',

    time: post.createdAt
      ? new Date(post.createdAt).toLocaleString()
      : 'Unknown time',

    // Our backend currently stores game rather than
    // Strategy/LFG-style categories.
    game: post.game || null,
    filterCategory: post.category || null,

    summary: createPostPreview(post.content),

    likes: Number(post.likeCount) || 0,
    replyCount: replyCount ?? '—',

    createdAt: post.createdAt,
  }
}
