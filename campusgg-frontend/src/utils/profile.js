export const skillLevels = ['', 'Beginner', 'Intermediate', 'Advanced']
export const profileLimits = { displayName: 100, bio: 500, games: 10, gameName: 50 }

export function profileValues(user) {
  return {
    displayName: user.displayName ?? '', bio: user.bio ?? '',
    favoriteGames: [...(user.favoriteGames ?? [])], skillLevel: user.skillLevel ?? '',
  }
}

export function validateProfile(values) {
  const errors = {}
  if (typeof values.displayName !== 'string' || !values.displayName.trim()
    || values.displayName.trim().length > profileLimits.displayName) {
    errors.displayName = 'Enter a display name of 1–100 characters.'
  }
  if (typeof values.bio !== 'string' || values.bio.length > profileLimits.bio) {
    errors.bio = 'About Me must be 500 characters or fewer.'
  }
  if (!Array.isArray(values.favoriteGames) || values.favoriteGames.length > profileLimits.games
    || values.favoriteGames.some((game) => typeof game !== 'string' || !game.trim() || game.trim().length > profileLimits.gameName)) {
    errors.favoriteGames = 'Add up to 10 games, with 1–50 characters per game.'
  } else if (new Set(values.favoriteGames.map((game) => game.trim().toLowerCase())).size !== values.favoriteGames.length) {
    errors.favoriteGames = 'Each favorite game must be unique.'
  }
  if (!skillLevels.includes(values.skillLevel)) errors.skillLevel = 'Choose a listed skill level.'
  return errors
}

export function profilePayload(values) {
  if (Object.keys(validateProfile(values)).length) throw new Error('Please correct the highlighted profile fields.')
  return {
    displayName: values.displayName.trim(), bio: values.bio.trim(),
    favoriteGames: values.favoriteGames.map((game) => game.trim()), skillLevel: values.skillLevel,
  }
}

// Only validated editable fields may update a session; never accept identity or token changes.
export function sessionWithProfile(session, response) {
  if (!session || !response || response.id !== session.user.id) throw new Error('Profile response does not match the signed-in account.')
  return { ...session, user: { ...session.user, ...profilePayload(response) } }
}
