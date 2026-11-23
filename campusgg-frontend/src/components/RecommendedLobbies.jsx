import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Plus, Sparkles } from 'lucide-react'
import { getLobbyRecommendations } from '../api/recommendations.js'
import LobbyCard from './LobbyCard.jsx'

function RecommendedLobbies({
  token,
  isAuthenticated,
  game,
  viewerGames = [],
  onGameChange,
  hidden,
  refreshKey,
  onJoin,
  joiningLobbyId,
  isLobbyJoined,
}) {
  const recommendationGame = game && game !== 'All Games'
    ? game
    : viewerGames[0]
  const requestKey = `${token ?? ''}|${recommendationGame ?? ''}`
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!isAuthenticated || !token || hidden) return undefined

    const controller = new AbortController()
    getLobbyRecommendations(
      token,
      {
        game: recommendationGame,
        limit: 3,
        signal: controller.signal,
      },
    )
      .then((data) => {
        if (controller.signal.aborted) return
        setResult({
          key: requestKey,
          items: Array.isArray(data?.items) ? data.items : [],
          needsProfile: Boolean(data?.needsProfile),
          game: data?.game ?? recommendationGame ?? null,
          failed: false,
        })
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setResult({
            key: requestKey,
            items: [],
            needsProfile: false,
            game: recommendationGame ?? null,
            failed: true,
          })
        }
      })

    return () => controller.abort()
  }, [isAuthenticated, token, recommendationGame, hidden, refreshKey, requestKey])

  if (hidden || !isAuthenticated) return null

  const loaded = result?.key === requestKey
  const items = loaded ? result.items : []
  const needsProfile = loaded ? result.needsProfile : false
  const failed = loaded ? result.failed : false
  const responseGame = loaded ? result.game : recommendationGame ?? null
  const isLoading = !loaded

  const gameOptions = [...new Set([
    ...viewerGames,
    ...(game && game !== 'All Games' ? [game] : []),
  ])]

  const createLobbyParams = new URLSearchParams()
  const prefillGame = game && game !== 'All Games' ? game : responseGame
  if (prefillGame) createLobbyParams.set('game', prefillGame)
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

  const gameControl = gameOptions.length > 1 ? (
    <label className="recommended-game-select">
      <span>Game</span>
      <select
        aria-label="Recommendation game"
        value={recommendationGame ?? ''}
        onChange={(event) => onGameChange?.(event.target.value)}
      >
        {gameOptions.map((value) => (
          <option key={value} value={value}>{value}</option>
        ))}
      </select>
    </label>
  ) : responseGame ? (
    <span className="recommended-game-label">{responseGame}</span>
  ) : null

  return (
    <section className="recommended-lobbies" aria-labelledby="recommended-lobbies-title">
      <header className="recommended-lobbies-heading">
        <span className="recommended-lobbies-icon" aria-hidden="true">
          <Sparkles size={18} strokeWidth={2} />
        </span>
        <div className="recommended-lobbies-copy">
          <h2 id="recommended-lobbies-title">Recommended for you</h2>
          <p>Ranked by game, role, campus, and how soon the squad is ready.</p>
        </div>
        {gameControl}
      </header>

      {needsProfile ? (
        <div className="recommended-empty">
          <p>
            Add {responseGame ?? 'a game'} to your profile to get lobby
            recommendations for it.
          </p>
          <div className="recommended-empty-actions">
            <Link to="/profile">
              Update profile
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <Link to={createLobbyHref}>Create a lobby</Link>
          </div>
        </div>
      ) : failed ? (
        <div className="recommended-empty">
          <p>Recommendations are unavailable right now. Try again in a moment.</p>
        </div>
      ) : (
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
          {!isLoading && items.length === 0 ? (
            <div className="recommended-empty">
              <p>
                No compatible {responseGame ?? 'lobbies'} yet. Be the first to
                start one for your campus.
              </p>
            </div>
          ) : null}
          {createLobbyTile}
        </div>
      )}
    </section>
  )
}

export default RecommendedLobbies
