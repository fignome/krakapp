// scripts/updateCache.js
// Run manually: node scripts/updateCache.js
// Also called by the nightly cron in server.js

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.join(__dirname, '..', 'public', 'cache')
const NHL_BASE = 'https://api-web.nhle.com'
const SEASON = '20252026'
const TEAM = 'SEA'

// Players on AHL assignment not in the active NHL roster — add any new call-ups here
const EXTRA_PLAYER_IDS = [
  8483497, // Jani Nyman
  8484910, // Victor Ostman
]

function write(filename, data) {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(path.join(CACHE_DIR, filename), JSON.stringify(data, null, 2))
  console.log(`  ✓ Wrote ${filename}`)
}

async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

async function updateCache() {
  console.log(`\n[updateCache] Starting at ${new Date().toLocaleString()}`)

  // 1. Roster
  console.log('\n[1/3] Fetching roster…')
  const roster = await fetchJSON(`${NHL_BASE}/v1/roster/${TEAM}/${SEASON}`)
  write('roster.json', roster)

  // 2. Player stats — all skaters + goalies + extra AHL-assigned players
  console.log('\n[2/3] Fetching player stats…')
  const allPlayers = [
    ...(roster.forwards ?? []),
    ...(roster.defensemen ?? []),
    ...(roster.goalies ?? []),
  ]
  const seen = new Set(allPlayers.map((p) => p.id))
  const extraIds = EXTRA_PLAYER_IDS.filter((id) => !seen.has(id))

  const playerStats = {}
  for (const p of allPlayers) {
    try {
      const data = await fetchJSON(`${NHL_BASE}/v1/player/${p.id}/landing`)
      playerStats[p.id] = data
      process.stdout.write(`  · ${p.firstName?.default} ${p.lastName?.default}\n`)
    } catch (e) {
      console.warn(`  ! Skipped ${p.id}: ${e.message}`)
    }
  }
  for (const id of extraIds) {
    try {
      const data = await fetchJSON(`${NHL_BASE}/v1/player/${id}/landing`)
      playerStats[id] = data
      process.stdout.write(`  · ${data.firstName?.default} ${data.lastName?.default} (AHL)\n`)
    } catch (e) {
      console.warn(`  ! Skipped extra ${id}: ${e.message}`)
    }
  }
  write('playerstats.json', playerStats)

  // 3. Standings
  console.log('\n[3/3] Fetching standings…')
  const standings = await fetchJSON(`${NHL_BASE}/v1/standings/now`)
  write('standings.json', standings)

  // 4. Timestamp
  const timestamp = { updatedAt: new Date().toISOString(), season: SEASON }
  write('lastUpdated.json', timestamp)

  console.log(`\n[updateCache] Done at ${new Date().toLocaleString()} ✓\n`)
}

updateCache().catch((e) => {
  console.error('[updateCache] Fatal error:', e.message)
  process.exit(1)
})
