export const experienceLevels = ['Beginner', 'Intermediate', 'Advanced']

export const gameRoleOptions = {
  Valorant: ['Duelist', 'Initiator', 'Controller', 'Sentinel'],
  'League of Legends': ['Top', 'Jungle', 'Mid', 'ADC', 'Support'],
  'Overwatch 2': ['Tank', 'Damage', 'Support'],
}

export const genericRoleOptions = ['Leader', 'Strategist', 'Support', 'Flex']
export const suggestedGames = Object.keys(gameRoleOptions)

export const profileLimits = {
  displayName: 100,
  bio: 500,
  games: 10,
  gameName: 50,
  rolesPerGame: 10,
  roleName: 40,
}

function canonicalGameName(game) {
  const trimmed = game.trim()
  return suggestedGames.find((name) => name.toLowerCase() === trimmed.toLowerCase())
    ?? trimmed
}

export function rolesForGame(game) {
  const canonical = canonicalGameName(game)
  return gameRoleOptions[canonical] ?? genericRoleOptions
}

function legacyGamingProfiles(user) {
  const roles = new Map((user.preferredRoles ?? []).map((selection) => [
    selection.game.toLowerCase(),
    selection.roles,
  ]))
  return (user.favoriteGames ?? []).map((game) => ({
    game,
    preferredRoles: [...(roles.get(game.toLowerCase()) ?? [])],
    experienceLevel: experienceLevels.includes(user.skillLevel)
      ? user.skillLevel
      : 'Beginner',
  }))
}

export function profileValues(user) {
  const gamingProfiles = Array.isArray(user.gamingProfiles)
    ? user.gamingProfiles
    : legacyGamingProfiles(user)
  return {
    displayName: user.displayName ?? '',
    bio: user.bio ?? '',
    gamingProfiles: gamingProfiles.map((profile) => ({
      game: profile.game,
      preferredRoles: [...(profile.preferredRoles ?? [])],
      experienceLevel: profile.experienceLevel ?? 'Beginner',
    })),
  }
}

export function validateProfile(values) {
  const errors = {}
  if (typeof values.displayName !== 'string' || !values.displayName.trim()
    || values.displayName.trim().length > profileLimits.displayName) {
    errors.displayName = 'Enter a display name of 1–100 characters.'
  }
  if (typeof values.bio !== 'string' || values.bio.length > profileLimits.bio) {
    errors.bio = 'Bio must be 500 characters or fewer.'
  }
  if (!Array.isArray(values.gamingProfiles)
    || values.gamingProfiles.length > profileLimits.games
    || values.gamingProfiles.some((profile) => {
      if (!profile || typeof profile.game !== 'string' || !profile.game.trim()
        || profile.game.trim().length > profileLimits.gameName
        || !experienceLevels.includes(profile.experienceLevel)
        || !Array.isArray(profile.preferredRoles)
        || profile.preferredRoles.length > profileLimits.rolesPerGame) return true
      const allowedRoles = new Set(rolesForGame(profile.game).map((role) => role.toLowerCase()))
      const normalizedRoles = profile.preferredRoles.map((role) =>
        typeof role === 'string' ? role.trim().toLowerCase() : role)
      return normalizedRoles.some((role) => typeof role !== 'string' || !role
        || role.length > profileLimits.roleName || !allowedRoles.has(role))
        || new Set(normalizedRoles).size !== normalizedRoles.length
    })) {
    errors.gamingProfiles = 'Check each game, role, and experience level.'
  } else if (new Set(values.gamingProfiles.map((profile) =>
    profile.game.trim().toLowerCase())).size !== values.gamingProfiles.length) {
    errors.gamingProfiles = 'Each game can appear only once.'
  }
  return errors
}

export function profilePayload(values) {
  if (Object.keys(validateProfile(values)).length) {
    throw new Error('Please correct the highlighted profile fields.')
  }
  return {
    displayName: values.displayName.trim(),
    bio: values.bio.trim(),
    gamingProfiles: values.gamingProfiles.map((profile) => ({
      game: canonicalGameName(profile.game),
      preferredRoles: profile.preferredRoles.map((role) => role.trim()),
      experienceLevel: profile.experienceLevel,
    })),
  }
}

// Only validated editable fields may update a session; identity and tokens stay local.
export function sessionWithProfile(session, response) {
  if (!session || !response || response.id !== session.user.id) {
    throw new Error('Profile response does not match the signed-in account.')
  }
  return {
    ...session,
    user: { ...session.user, ...profilePayload(response) },
  }
}
