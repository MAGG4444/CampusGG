import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ExternalLink,
  Gamepad2,
  Link2,
  RefreshCw,
  Unlink,
} from 'lucide-react'
import ConfirmationModal from './ConfirmationModal.jsx'
import {
  getSteamLinkUrl,
  getSteamStats,
  unlinkSteamAccount,
} from '../api/steam.js'
import {
  formatPlaytime,
  STEAM_PRIVACY_URL,
  steamSyncedLabel,
} from '../utils/steam.js'

const TOP_GAMES = 5

function GameIcon({ game, size = 28 }) {
  if (game.iconUrl) {
    return (
      <img
        src={game.iconUrl}
        alt=""
        width={size}
        height={size}
        loading="lazy"
      />
    )
  }

  return (
    <span className="steam-game-icon" aria-hidden="true">
      <Gamepad2 size={Math.round(size * 0.6)} />
    </span>
  )
}

function SteamHighlight({ game }) {
  if (!game) return null

  return (
    <div className="steam-highlight">
      <GameIcon game={game} size={40} />
      <div>
        <strong>{game.name}</strong>
        <span>{formatPlaytime(game.playtimeForeverMinutes, game.playtimeForeverHours)}</span>
      </div>
    </div>
  )
}

export default function SteamCard({ token, onNavigate }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionBusy, setActionBusy] = useState('')
  const [confirmingUnlink, setConfirmingUnlink] = useState(false)
  const controllerRef = useRef(null)

  const requestStats = useCallback(
    (signal, refresh = false) =>
      getSteamStats(token, { top: TOP_GAMES, refresh, signal }),
    [token],
  )

  const loadStats = useCallback(async ({ refresh = false } = {}) => {
    if (!token) return

    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setLoading(true)
    setLoadError('')

    try {
      const next = await requestStats(controller.signal, refresh)

      if (!controller.signal.aborted) setStats(next)
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError') return
      setLoadError(
        error instanceof Error ? error.message : 'Unable to load Steam stats.',
      )
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [token, requestStats])

  useEffect(() => {
    const controller = new AbortController()
    controllerRef.current = controller

    requestStats(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setStats(next)
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.name === 'AbortError') return
        setLoadError(
          error instanceof Error ? error.message : 'Unable to load Steam stats.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [requestStats])

  function goToSteam(url) {
    if (onNavigate) {
      onNavigate(url)
      return
    }

    window.location.assign(url)
  }

  async function handleLink() {
    setActionError('')
    setActionBusy('link')

    try {
      const url = await getSteamLinkUrl(token)
      goToSteam(url)
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Unable to start Steam linking.',
      )
    } finally {
      setActionBusy('')
    }
  }

  async function handleSync() {
    setActionError('')
    setActionBusy('sync')

    try {
      await loadStats({ refresh: true })
    } finally {
      setActionBusy('')
    }
  }

  async function handleUnlink() {
    setActionError('')
    setActionBusy('unlink')

    try {
      await unlinkSteamAccount(token)
      setStats({ status: 'NOT_LINKED' })
      setLoadError('')
      setConfirmingUnlink(false)
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Unable to unlink Steam.',
      )
    } finally {
      setActionBusy('')
    }
  }

  if (!token) return null

  const busy = actionBusy !== ''

  function renderActions({ showSync = true, syncLabel } = {}) {
    return (
      <div className="steam-actions">
        {showSync && (
          <button className="steam-action steam-action-primary" type="button"
            onClick={handleSync} disabled={busy || loading}>
            <RefreshCw size={16} aria-hidden="true"
              className={loading ? 'steam-spin' : undefined} />
            {syncLabel ?? (loading ? 'Syncing…' : 'Sync now')}
          </button>
        )}
        <button className="steam-action steam-action-danger" type="button"
          onClick={() => { setActionError(''); setConfirmingUnlink(true) }}
          disabled={busy || loading}>
          <Unlink size={16} aria-hidden="true" /> Unlink
        </button>
      </div>
    )
  }

  function renderBody() {
    if (loading && !stats && !loadError) {
      return <p className="steam-copy steam-loading">Loading Steam profile…</p>
    }

    if (loadError && !stats) {
      return (
        <>
          <div className="steam-notice steam-notice-warning">
            <AlertTriangle size={18} aria-hidden="true" />
            <p>{loadError}</p>
          </div>
          <div className="steam-actions">
            <button className="steam-action steam-action-primary" type="button"
              onClick={() => loadStats()} disabled={loading}>
              <RefreshCw size={16} aria-hidden="true" /> Try again
            </button>
          </div>
        </>
      )
    }

    if (!stats) return null

    if (stats.status === 'NOT_LINKED') {
      return (
        <>
          <p className="steam-copy">
            Link your Steam account to display your Counter-Strike 2 and
            Dota 2 playtime. Playtime is shown for context only and never
            affects matchmaking.
          </p>
          <button className="steam-action steam-action-primary" type="button"
            onClick={handleLink} disabled={busy}>
            <Link2 size={16} aria-hidden="true" />
            {actionBusy === 'link' ? 'Opening Steam…' : 'Link Steam'}
          </button>
        </>
      )
    }

    if (stats.status === 'OK') {
      return (
        <>
          <p className="steam-copy">
            Playtime synced from Steam. Shown for context only; it does not
            affect matchmaking.
          </p>
          {(stats.cs2 || stats.dota2) && (
            <div className="steam-highlights">
              <SteamHighlight game={stats.cs2} />
              <SteamHighlight game={stats.dota2} />
            </div>
          )}
          {stats.topGames?.length ? (
            <div className="steam-games-block">
              <h3>Most played</h3>
              <ol className="steam-games">
                {stats.topGames.map((game) => (
                  <li key={game.appId}>
                    <GameIcon game={game} />
                    <span className="steam-game-name">{game.name}</span>
                    <span className="steam-game-time">
                      {formatPlaytime(game.playtimeForeverMinutes, game.playtimeForeverHours)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          <p className="steam-meta">{steamSyncedLabel(stats.fetchedAt)}</p>
          {renderActions()}
        </>
      )
    }

    if (stats.status === 'PRIVATE_OR_EMPTY') {
      return (
        <>
          <div className="steam-notice steam-notice-warning">
            <AlertTriangle size={18} aria-hidden="true" />
            <p>
              Steam returned no game details. Your profile’s game details may
              be private. Set <strong>Game details</strong> to{' '}
              <strong>Public</strong> in Steam, then re-sync.
            </p>
          </div>
          <a className="steam-privacy-link" href={STEAM_PRIVACY_URL}
            target="_blank" rel="noreferrer">
            Open Steam privacy settings
            <ExternalLink size={14} aria-hidden="true" />
          </a>
          <p className="steam-meta">{steamSyncedLabel(stats.fetchedAt)}</p>
          {renderActions()}
        </>
      )
    }

    return (
      <>
        <div className="steam-notice steam-notice-warning">
          <AlertTriangle size={18} aria-hidden="true" />
          <p>{stats.message || 'Steam is temporarily unavailable. Please try again shortly.'}</p>
        </div>
        {renderActions({ syncLabel: loading ? 'Retrying…' : 'Try again' })}
      </>
    )
  }

  return (
    <section className="profile-section profile-steam" aria-labelledby="steam-heading">
      <div className="steam-heading-row">
        <Gamepad2 size={24} aria-hidden="true" />
        <h2 id="steam-heading">Steam</h2>
        {stats?.profileUrl && (
          <a className="steam-profile-link" href={stats.profileUrl}
            target="_blank" rel="noreferrer">
            View profile
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        )}
      </div>

      <div aria-live="polite" aria-atomic="true">
        {actionError && !confirmingUnlink && (
          <p className="profile-error steam-action-error" role="alert">{actionError}</p>
        )}
        {loadError && stats && (
          <p className="profile-error steam-action-error" role="alert">{loadError}</p>
        )}
      </div>

      {renderBody()}

      {confirmingUnlink && (
        <ConfirmationModal
          title="Unlink Steam account?"
          message="Your Steam playtime will be removed from CampusGG. You can link an account again at any time."
          confirmLabel="Unlink Steam"
          destructive
          busy={actionBusy === 'unlink'}
          error={actionError}
          onCancel={() => { setActionError(''); setConfirmingUnlink(false) }}
          onConfirm={handleUnlink}
        />
      )}
    </section>
  )
}
