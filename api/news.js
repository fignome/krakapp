import { kv } from '@vercel/kv'
import { fetchNews } from './_lib/fetchers.js'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  // Serve from cache (populated every 4 hours by /api/cron)
  const cached = await kv.get('kraken_news')
  if (cached) {
    res.setHeader('X-Cache', 'HIT')
    return res.end(JSON.stringify(cached))
  }

  // Cache miss — only happens before the first cron run or after a KV flush.
  // Fetch live, store in KV, and return.
  res.setHeader('X-Cache', 'MISS')
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.end(JSON.stringify({ articles: [], error: 'ANTHROPIC_API_KEY not set' }))
  }
  try {
    const data = await fetchNews(apiKey)
    await kv.set('kraken_news', data, { ex: 60 * 60 * 30 })
    return res.end(JSON.stringify(data))
  } catch (e) {
    return res.end(JSON.stringify({ articles: [], error: e.message }))
  }
}
