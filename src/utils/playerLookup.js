import { rosterData } from '../data/roster.js'

// Seed the lookup maps with the static roster (available immediately, synchronously)
const byName = {}
const byId = {}

function indexPlayer(p) {
  const fullName = `${p.firstName.default} ${p.lastName.default}`.toLowerCase()
  byName[fullName] = p
  byId[p.id] = p
}

;[...rosterData.forwards, ...rosterData.defensemen, ...rosterData.goalies].forEach(indexPlayer)

// Merge in cache data async so future roster changes don't require editing roster.js
;(async () => {
  try {
    const res = await fetch('/cache/roster.json')
    if (!res.ok) return
    const data = await res.json()
    const all = [...(data.forwards ?? []), ...(data.defensemen ?? []), ...(data.goalies ?? [])]
    all.forEach(indexPlayer)
  } catch {}
})()

export function lookupPlayer(name) {
  if (!name) return null
  return byName[name.toLowerCase()] ?? null
}

export function lookupPlayerById(id) {
  return byId[id] ?? null
}

export function allRosterNames() {
  return Object.values(byName).map((p) => `${p.firstName.default} ${p.lastName.default}`)
}

export function allRosterPlayers() {
  return Object.values(byId)
}
