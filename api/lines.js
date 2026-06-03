import { kv } from '@vercel/kv'
import { fetchLines, FALLBACK_LINES } from './_lib/fetchers.js'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  // Serve from cache (populated every 4 hours by /api/cron)
  const cached = await kv.get('kraken_lines')
  if (cached) {
    res.setHeader('X-Cache', 'HIT')
    return res.end(JSON.stringify(cached))
  }

  // Cache miss — only happens before the first cron run or after a KV flush.
  res.setHeader('X-Cache', 'MISS')
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.end(JSON.stringify({ ...FALLBACK_LINES, error: 'ANTHROPIC_API_KEY not set' }))
  }
  try {
    const data = await fetchLines(apiKey)
    await kv.set('kraken_lines', data, { ex: 60 * 60 * 30 })
    return res.end(JSON.stringify(data))
  } catch (e) {
    return res.end(JSON.stringify({ ...FALLBACK_LINES, error: e.message }))
  }
}
