// Presentation only: channel identities and membership remain owned by the API.
export const channelPresentation = {
  valorant: { description: 'Discuss matches, strategies, and finding teammates in Valorant.' },
  'counter-strike-2': { description: 'Talk tactics, matches, and team play in Counter-Strike 2.' },
  minecraft: { description: 'Share builds, adventures, and ideas from Minecraft.' },
  'league-of-legends': { description: 'Discuss champions, matches, and teamwork in League of Legends.' },
  dota: { description: 'Talk heroes, matches, and strategy in Dota.' },
  'overwatch-2': { description: 'Discuss heroes, team play, and matches in Overwatch 2.' },
  'rocket-league': { description: 'Share plays, find teammates, and discuss Rocket League.' },
  'it-takes-two': { description: 'Find a partner and discuss co-op adventures in It Takes Two.' },
}

// Most Followed is global; recommendations exclude it to avoid adjacent duplicates.
export function selectCommunitySections(channels, follows) {
  const ids = new Set((follows?.channels || []).map((channel) => channel.id))
  const interests = new Set(channels.filter((channel) => ids.has(channel.id)).map((channel) => channel.category).filter(Boolean))
  const personalized = Boolean(follows?.token && !follows.loading && !follows.error && interests.size)
  const byPopularity = (a, b) => b.followerCount - a.followerCount || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  const mostFollowed = [...channels].sort(byPopularity).slice(0, 3)
  const featured = new Set(mostFollowed.map((channel) => channel.id))
  const recommended = channels.filter((channel) => !ids.has(channel.id) && !featured.has(channel.id)).sort((a, b) => (personalized ? Number(interests.has(b.category)) - Number(interests.has(a.category)) : 0) || byPopularity(a, b)).slice(0, 3)
  return { personalized, recommended, mostFollowed }
}

// Match only aliases returned by the persistent catalog; unknown games stay unlinked.
export function channelForGame(channels, game) {
  const normalized = typeof game === 'string' ? game.trim().toLowerCase() : ''
  return normalized ? channels.find((channel) => channel.aliases?.includes(normalized)) : undefined
}
