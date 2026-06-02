import defensesides from '../data/defensesides.json'

const positionMap = { L: 'LW', R: 'RW', C: 'C', G: 'G' }

export function formatPosition(code, playerId) {
  if (code === 'D') return defensesides[String(playerId)] ?? 'D'
  return positionMap[code] ?? code
}
