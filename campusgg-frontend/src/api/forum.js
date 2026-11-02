import { request } from './request.js'

const id = (value) => encodeURIComponent(value)

export function getForumPost(postId, signal) {
  return request(`/forum/posts/${id(postId)}`, {
    signal,
  })
}

export function createForumPost(payload, token) {
  return request('/forum/posts', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export function updateForumPost(postId, payload, token) {
  return request(`/forum/posts/${id(postId)}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(payload),
  })
}

export function deleteForumPost(postId, token) {
  return request(`/forum/posts/${id(postId)}`, {
    method: 'DELETE',
    token,
  })
}

export function getForumComments(
  postId,
  page = 1,
  limit = 50,
  signal,
) {
  return request(
    `/forum/posts/${id(postId)}/comments?page=${page}&limit=${limit}`,
    { signal },
  )
}

export async function getAllForumComments(postId, signal) {
  const comments = []
  let page = 1

  for (;;) {
    const result = await getForumComments(
      postId,
      page,
      50,
      signal,
    )

    if (!Array.isArray(result.comments)) {
      throw new Error('Invalid comments response')
    }

    comments.push(...result.comments)

    if (
      result.comments.length === 0 ||
      comments.length >= Number(result.total)
    ) {
      break
    }

    page += 1
  }

  return comments
}

export function createForumComment(postId, content, token) {
  return request(`/forum/posts/${id(postId)}/comments`, {
    method: 'POST',
    token,
    body: JSON.stringify({ content }),
  })
}

export function updateForumComment(
  postId,
  commentId,
  content,
  token,
) {
  return request(
    `/forum/posts/${id(postId)}/comments/${id(commentId)}`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify({ content }),
    },
  )
}

export function deleteForumComment(
  postId,
  commentId,
  token,
) {
  return request(
    `/forum/posts/${id(postId)}/comments/${id(commentId)}`,
    {
      method: 'DELETE',
      token,
    },
  )
}

export function likeForumPost(postId, token) {
  return request(`/forum/posts/${id(postId)}/like`, {
    method: 'POST',
    token,
  })
}

export function unlikeForumPost(postId, token) {
  return request(`/forum/posts/${id(postId)}/like`, {
    method: 'DELETE',
    token,
  })
}

export function getMyForumLike(postId, token, signal) {
  return request(`/forum/posts/${id(postId)}/likes/me`, {
    token,
    signal,
  })
}

export function getForumLikeCount(postId, signal) {
  return request(`/forum/posts/${id(postId)}/likes`, {
    signal,
  })
}

export async function getForumRecommendations(
  game,
  excludingPostId,
  signal,
) {
  if (!game) return []

  const response = await request(
    '/forum/posts?page=1&limit=50',
    { signal },
  )

  return Array.isArray(response.posts)
    ? response.posts.filter(
        (item) =>
          item.id !== excludingPostId &&
          item.game?.toLowerCase() === game.toLowerCase()
      )
    : []
}

export function getMyForumPosts(token, { page = 1, limit = 10, signal } = {}) {
  return request(`/forum/posts/me?page=${page}&limit=${limit}`, { token, signal })
}
