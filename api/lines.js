import { fetchLines, FALLBACK_LINES } from './_lib/fetchers.js'

// KV is optional — gracefully skip if not configured
async function kvGet(key) {
  try {
    if (!process.env.KV_REST_API_URL) return null
    const { kv } = await import('@vercel/kv')
    return await kv.get(key)
  } catch { return null }
}

async function kvSet(key, value, opts) {
  try {
    if (!process.env.KV_REST_API_URL) return
    const { kv } = await import('@vercel/kv')
    await kv.set(key, value, opts)
  } catch {}
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  const cached = await kvGet('kraken_lines')
  if (cached) {
    res.setHeader('X-Cache', 'HIT')
    return res.end(JSON.stringify(cached))
  }

  res.setHeader('X-Cache', 'MISS')
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.end(JSON.stringify({ ...FALLBACK_LINES, error: 'ANTHROPIC_API_KEY not set' }))
  }
  try {
    const data = await fetchLines(apiKey)
    await kvSet('kraken_lines', data, { ex: 60 * 60 * 30 })
    return res.end(JSON.stringify(data))
  } catch (e) {
    return res.end(JSON.stringify({ ...FALLBACK_LINES, error: e.message }))
  }
}
