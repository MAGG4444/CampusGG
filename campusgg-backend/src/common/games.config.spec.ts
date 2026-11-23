import {
  canonicalGameName,
  gameMatchKeys,
  gamesMatch,
  roleNounForGame,
  rolesForGame,
} from './games.config';

describe('games.config', () => {
  it.each([
    ['lol', 'League of Legends'],
    ['League', 'League of Legends'],
    ['valorant', 'Valorant'],
    ['val', 'Valorant'],
    ['dota2', 'Dota 2'],
    ['csgo', 'CS2'],
    ['ow', 'Overwatch 2'],
  ])('canonicalizes %s to %s', (input, expected) => {
    expect(canonicalGameName(input)).toBe(expected);
  });

  it('matches canonical names and aliases through the same key set', () => {
    expect(gamesMatch('lol', 'League of Legends')).toBe(true);
    expect(gamesMatch('dota', 'Dota 2')).toBe(true);
    expect(gamesMatch('val', 'Valorant')).toBe(true);
    expect(gamesMatch('CS2', 'Valorant')).toBe(false);
  });

  it('returns every stored spelling for a game', () => {
    expect(gameMatchKeys('lol')).toEqual([
      'league of legends',
      'league',
      'lol',
    ]);
    expect(gameMatchKeys('Dota 2')).toEqual(['dota 2', 'dota', 'dota2']);
    expect(gameMatchKeys('  ')).toEqual([]);
  });

  it('keeps unknown games free-form', () => {
    expect(canonicalGameName('Apex')).toBe('Apex');
    expect(gameMatchKeys('Apex')).toEqual(['apex']);
    expect(rolesForGame('Apex')).toEqual([
      'Leader',
      'Strategist',
      'Support',
      'Flex',
    ]);
  });

  it('uses game-appropriate role nouns', () => {
    expect(roleNounForGame('lol')).toBe('lane');
    expect(roleNounForGame('League')).toBe('lane');
    expect(roleNounForGame('Dota 2')).toBe('position');
    expect(roleNounForGame('csgo')).toBe('role');
    expect(roleNounForGame('Valorant')).toBe('role');
    expect(roleNounForGame('Overwatch 2')).toBe('role');
    expect(roleNounForGame('Apex')).toBe('role');
    expect(roleNounForGame(null)).toBe('role');
  });
});
