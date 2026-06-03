import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  const cached = await kv.get('nhl_standings')
  if (cached) {
    res.setHeader('X-Cache', 'HIT')
    return res.end(JSON.stringify(cached))
  }

  // Cold start — fetch directly and warm the cache
  res.setHeader('X-Cache', 'MISS')
  try {
    const data = await fetch('https://api-web.nhle.com/v1/standings/now', {
      signal: AbortSignal.timeout(10000),
    }).then(r => r.json())
    await kv.set('nhl_standings', data, { ex: 60 * 60 * 36 })
    return res.end(JSON.stringify(data))
  } catch (e) {
    return res.status(503).json({ error: 'Cache cold and fallback fetch failed', detail: e.message })
  }
}
