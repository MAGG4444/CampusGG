import { request } from './request.js'

const id = (value) => encodeURIComponent(value)

export function getPostFollowStatuses(ids, token, signal) {
  return request(`/forum/post-follows?ids=${encodeURIComponent(ids.join(','))}`, { token, signal })
}

export function setPostFollow(postId, following, token) {
  return request(`/forum/posts/${id(postId)}/follow`, { token, method: following ? 'POST' : 'DELETE' })
}

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

export function createForumComment(postId, content, token, parentReplyId = null) {
  return request(`/forum/posts/${id(postId)}/comments`, {
    method: 'POST',
    token,
    body: JSON.stringify({ content, ...(parentReplyId ? { parentReplyId } : {}) }),
  })
}

export function getMyCommentLikes(postId, token, signal) {
  return request(`/forum/posts/${id(postId)}/comments/likes/me`, { token, signal })
}

export function setCommentLike(postId, commentId, liked, token) {
  return request(`/forum/posts/${id(postId)}/comments/${id(commentId)}/like`, { token, method: liked ? 'POST' : 'DELETE' })
}

export function reportForumContent(postId, commentId, payload, token) {
  const path = commentId ? `/forum/posts/${id(postId)}/comments/${id(commentId)}/report` : `/forum/posts/${id(postId)}/report`
  return request(path, { method: 'POST', token, body: JSON.stringify(payload) })
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

export function getMyForumPosts(token, { page = 1, limit = 10, signal } = {}) {
  return request(`/forum/posts/me?page=${page}&limit=${limit}`, { token, signal })
}
