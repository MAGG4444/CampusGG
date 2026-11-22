export function groupFriends(people) {
  const groups = new Map()
  for (const person of people.filter(item => item.relationship === 'friend')) {
    const name = (person.displayName || person.name || '').trim()
    const first = name.charAt(0)
    const letter = /^[A-Za-z]$/.test(first) ? first.toUpperCase() : '#'
    if (!groups.has(letter)) groups.set(letter, [])
    groups.get(letter).push(person)
  }
  return [...groups].sort(([a], [b]) => a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b))
    .map(([letter, members]) => [letter, members.sort((a, b) => (a.displayName || a.name || '').localeCompare(b.displayName || b.name || '', undefined, { sensitivity: 'base' }))])
}
