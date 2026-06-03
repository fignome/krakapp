// Vercel cron handler — runs nightly at 3 AM Pacific.
// Fetches fresh NHL data and stores it in Vercel KV.
//
// Vercel automatically sends: Authorization: Bearer <CRON_SECRET>
// Manual trigger:
//   curl https://your-domain.vercel.app/api/update-cache \
//     -H "Authorization: Bearer <CRON_SECRET>"

import { kv } from '@vercel/kv'

const NHL_BASE   = 'https://api-web.nhle.com'
const SEASON     = '20252026'
const TEAM       = 'SEA'
const KV_TTL     = 60 * 60 * 36 // 36 h — comfortably past the 24 h cron cycle

// Players on AHL assignment not in the active NHL roster
const EXTRA_PLAYER_IDS = [
  8483497, // Jani Nyman
  8484910, // Victor Ostman
]

async function fetchJSON(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  return res.json()
}

export default async function handler(req, res) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const started = Date.now()
  const log = []

  try {
    // 1. Roster ────────────────────────────────────────────────────────────────
    log.push('Fetching roster…')
    const roster = await fetchJSON(`${NHL_BASE}/v1/roster/${TEAM}/${SEASON}`)
    await kv.set('nhl_roster', roster, { ex: KV_TTL })
    log.push(`  ✓ roster (${[...(roster.forwards??[]), ...(roster.defensemen??[]), ...(roster.goalies??[])].length} players)`)

    // 2. Player stats — fetch all in parallel for speed ────────────────────────
    log.push('Fetching player stats…')
    const allPlayers = [
      ...(roster.forwards   ?? []),
      ...(roster.defensemen ?? []),
      ...(roster.goalies    ?? []),
    ]
    const seen     = new Set(allPlayers.map(p => p.id))
    const extraIds = EXTRA_PLAYER_IDS.filter(id => !seen.has(id))
    const allIds   = [...allPlayers.map(p => p.id), ...extraIds]

    const results = await Promise.allSettled(
      allIds.map(id => fetchJSON(`${NHL_BASE}/v1/player/${id}/landing`))
    )

    const playerStats = {}
    for (let i = 0; i < allIds.length; i++) {
      if (results[i].status === 'fulfilled') {
        playerStats[allIds[i]] = results[i].value
      } else {
        log.push(`  ! Skipped player ${allIds[i]}: ${results[i].reason?.message}`)
      }
    }
    await kv.set('nhl_playerstats', playerStats, { ex: KV_TTL })
    log.push(`  ✓ playerstats (${Object.keys(playerStats).length} players)`)

    // 3. Standings ─────────────────────────────────────────────────────────────
    log.push('Fetching standings…')
    const standings = await fetchJSON(`${NHL_BASE}/v1/standings/now`)
    await kv.set('nhl_standings', standings, { ex: KV_TTL })
    log.push('  ✓ standings')

    // 4. Timestamp ─────────────────────────────────────────────────────────────
    const timestamp = { updatedAt: new Date().toISOString(), season: SEASON }
    await kv.set('nhl_last_updated', timestamp, { ex: KV_TTL })
    log.push('  ✓ lastUpdated')

    const duration = Date.now() - started
    log.push(`Done in ${duration}ms`)
    console.log('[update-cache]', log.join('\n'))
    return res.json({ ok: true, durationMs: duration, log })

  } catch (e) {
    console.error('[update-cache] Fatal:', e.message)
    return res.status(500).json({ ok: false, error: e.message, log })
  }
}
