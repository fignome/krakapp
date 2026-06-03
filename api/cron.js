// Called by Vercel cron every 4 hours to pre-warm all caches.
// Vercel automatically sends: Authorization: Bearer <CRON_SECRET>
// You can also trigger manually via:
//   curl -X GET https://your-domain/api/cron -H "Authorization: Bearer <CRON_SECRET>"

import { kv } from '@vercel/kv'
import { fetchNews, fetchRumors, fetchLines, FALLBACK_LINES } from './_lib/fetchers.js'

const KV_TTL = 60 * 60 * 30 // 30 hours — well past the 4-hour cron cycle

export default async function handler(req, res) {
  // Guard: only Vercel cron invocations (or manual calls with the secret) are allowed
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })
  }

  const started = Date.now()
  const results = {}

  // Run all three refreshes in parallel
  const [newsResult, rumorsResult, linesResult] = await Promise.allSettled([
    fetchNews(apiKey),
    fetchRumors(apiKey),
    fetchLines(apiKey),
  ])

  if (newsResult.status === 'fulfilled') {
    await kv.set('kraken_news', newsResult.value, { ex: KV_TTL })
    results.news = 'ok'
  } else {
    results.news = `error: ${newsResult.reason?.message}`
    console.error('[cron] news failed:', newsResult.reason)
  }

  if (rumorsResult.status === 'fulfilled') {
    await kv.set('kraken_rumors', rumorsResult.value, { ex: KV_TTL })
    results.rumors = 'ok'
  } else {
    results.rumors = `error: ${rumorsResult.reason?.message}`
    console.error('[cron] rumors failed:', rumorsResult.reason)
  }

  if (linesResult.status === 'fulfilled') {
    await kv.set('kraken_lines', linesResult.value, { ex: KV_TTL })
    results.lines = 'ok'
  } else {
    results.lines = `error: ${linesResult.reason?.message}`
    console.error('[cron] lines failed:', linesResult.reason)
    // Store fallback so the lines endpoint never returns empty
    const existing = await kv.get('kraken_lines')
    if (!existing) await kv.set('kraken_lines', { ...FALLBACK_LINES }, { ex: KV_TTL })
  }

  return res.json({ ok: true, durationMs: Date.now() - started, results })
}
