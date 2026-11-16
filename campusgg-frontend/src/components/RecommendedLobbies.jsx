import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Plus, Sparkles } from 'lucide-react'
import { getLobbyRecommendations } from '../api/recommendations.js'
import LobbyCard from './LobbyCard.jsx'

function RecommendedLobbies({
  token,
  isAuthenticated,
  game,
  hidden,
  refreshKey,
  onJoin,
  joiningLobbyId,
  isLobbyJoined,
}) {
  const requestKey = `${token ?? ''}|${game ?? ''}`
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!isAuthenticated || !token || hidden) return undefined

    const controller = new AbortController()
    getLobbyRecommendations(
      token,
      {
        game: game && game !== 'All Games' ? game : undefined,
        limit: 3,
        signal: controller.signal,
      },
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({
            key: requestKey,
            items: Array.isArray(data?.items) ? data.items : [],
          })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, items: [] })
        }
      })

    return () => controller.abort()
  }, [isAuthenticated, token, game, hidden, refreshKey, requestKey])

  if (hidden || !isAuthenticated) return null

  const loaded = result?.key === requestKey
  const items = loaded ? result.items : []
  const isLoading = !loaded

  if (!isLoading && items.length === 0) return null

  const createLobbyParams = new URLSearchParams()
  if (game && game !== 'All Games') createLobbyParams.set('game', game)
  const createLobbyQuery = createLobbyParams.toString()
  const createLobbyHref = `/create-lobby${createLobbyQuery ? `?${createLobbyQuery}` : ''}`
  const createLobbyTile = (
    <Link className="recommended-cta" to={createLobbyHref}>
      <span className="recommended-cta-icon" aria-hidden="true">
        <Plus size={20} strokeWidth={2.2} />
      </span>
      <span className="recommended-cta-copy">
        <strong>Create your own lobby</strong>
        <span>None of these fit? Set the game, skill level, and roles you need.</span>
      </span>
      <span className="recommended-cta-action">
        Create lobby
        <ArrowRight size={15} aria-hidden="true" />
      </span>
    </Link>
  )

  return (
    <section className="recommended-lobbies" aria-labelledby="recommended-lobbies-title">
      <header className="recommended-lobbies-heading">
        <span className="recommended-lobbies-icon" aria-hidden="true">
          <Sparkles size={18} strokeWidth={2} />
        </span>
        <div>
          <h2 id="recommended-lobbies-title">Recommended for you</h2>
          <p>Ranked by game, role, campus, and how soon the squad is ready.</p>
        </div>
      </header>

      <div
        className="lobby-grid recommended-lobbies-grid"
        {...(isLoading ? { role: 'status', 'aria-label': 'Loading recommendations' } : {})}
      >
        {isLoading
          ? [0, 1, 2].map((index) => (
              <div className="lobby-skeleton" aria-hidden="true" key={index}>
                <span /><span /><span />
              </div>
            ))
          : items.map(({ lobby, reasons }) => (
              <LobbyCard
                key={lobby.id}
                lobbyName={lobby.lobbyName}
                userName={lobby.host?.username ?? 'Unknown host'}
                details={lobby.details}
                game={lobby.game}
                skillLevel={lobby.skillLevel}
                memberCount={lobby.memberCount}
                participantLimit={lobby.participantLimit}
                visibility={lobby.visibility}
                isJoined={isLobbyJoined?.(lobby.id) ?? false}
                isJoining={String(joiningLobbyId) === String(lobby.id)}
                onJoin={() => onJoin(lobby)}
                reasons={reasons}
              />
            ))}
        {createLobbyTile}
      </div>
    </section>
  )
}

export default RecommendedLobbies
