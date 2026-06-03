import { kv } from '@vercel/kv'

const NHL_BASE = 'https://api-web.nhle.com'
const EXTRA_PLAYER_IDS = [8483497, 8484910] // Jani Nyman, Victor Ostman

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  const cached = await kv.get('nhl_playerstats')
  if (cached) {
    res.setHeader('X-Cache', 'HIT')
    return res.end(JSON.stringify(cached))
  }

  // Cold start — fetch roster then all player stats in parallel
  res.setHeader('X-Cache', 'MISS')
  try {
    const roster = await fetch(`${NHL_BASE}/v1/roster/SEA/20252026`, {
      signal: AbortSignal.timeout(10000),
    }).then(r => r.json())

    const allPlayers = [
      ...(roster.forwards   ?? []),
      ...(roster.defensemen ?? []),
      ...(roster.goalies    ?? []),
    ]
    const seen     = new Set(allPlayers.map(p => p.id))
    const extraIds = EXTRA_PLAYER_IDS.filter(id => !seen.has(id))
    const allIds   = [...allPlayers.map(p => p.id), ...extraIds]

    const results = await Promise.allSettled(
      allIds.map(id =>
        fetch(`${NHL_BASE}/v1/player/${id}/landing`, { signal: AbortSignal.timeout(10000) })
          .then(r => r.json())
      )
    )

    const playerStats = {}
    allIds.forEach((id, i) => {
      if (results[i].status === 'fulfilled') playerStats[id] = results[i].value
    })

    await kv.set('nhl_playerstats', playerStats, { ex: 60 * 60 * 36 })
    return res.end(JSON.stringify(playerStats))
  } catch (e) {
    return res.status(503).json({ error: 'Cache cold and fallback fetch failed', detail: e.message })
  }
}
