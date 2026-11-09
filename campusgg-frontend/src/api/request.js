const API_URL =
  import.meta.env?.VITE_API_URL || 'http://localhost:3000'

export async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {}),
      ...options.headers,
    },
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message

    const error = new Error(
      message || `Request failed (${response.status})`
    )

    error.status = response.status
    throw error
  }

  return data
}
