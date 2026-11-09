export const participantLimitOptions = [
  { label: '2', value: 2 },
  { label: '5', value: 5 },
  { label: '10', value: 10 },
  { label: 'Unlimited', value: 'unlimited' },
]

export function participantLimitPayload(value) {
  return value === 'unlimited' ? {} : { participantLimit: value }
}
