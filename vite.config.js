import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function readEnvFile() {
  try {
    const envPath = path.resolve(process.cwd(), '.env')
    const content = fs.readFileSync(envPath, 'utf-8')
    const match = content.match(/^ANTHROPIC_API_KEY=(.+)$/m)
    return match ? match[1].trim() : null
  } catch {
    return null
  }
}

async function callClaude(apiKey, systemPrompt, userContent) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  })
  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Anthropic ${response.status}: ${errText.slice(0, 200)}`)
  }
  const json = await response.json()
  const textBlock = json.content?.find((b) => b.type === 'text')
  if (!textBlock) throw new Error(`No text block`)
  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`Could not parse JSON from response`)
  return JSON.parse(jsonMatch[0])
}

const FALLBACK_LINES = {
  fallback: true,
  lines: [
    { line: 1, lw: 'Jared McCann',    c: 'Matty Beniers',       rw: 'Jordan Eberle' },
    { line: 2, lw: 'Berkly Catton',   c: 'Chandler Stephenson', rw: 'Eeli Tolvanen' },
    { line: 3, lw: 'Jaden Schwartz',  c: 'Shane Wright',        rw: 'Kaapo Kakko' },
    { line: 4, lw: 'Bobby McMann',    c: 'Frederick Gaudreau',  rw: 'Ryan Winterton' },
  ],
  pairs: [
    { pair: 1, ld: 'Vince Dunn',    rd: 'Brandon Montour' },
    { pair: 2, ld: 'Adam Larsson',  rd: 'Ryker Evans' },
    { pair: 3, ld: 'Ryan Lindgren', rd: 'Joshua Mahura' },
  ],
  goalie: 'Joey Daccord',
}

function apiPlugin(apiKey) {
  // Server-side cache (5 min TTL — client handles the 30 min TTL via localStorage)
  const cache = {}
  const CACHE_TTL = 5 * 60 * 1000

  function getCached(key) {
    const entry = cache[key]
    if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data
    return null
  }

  function setCached(key, data) {
    cache[key] = { data, ts: Date.now() }
  }

  // Sequential request queue — prevents simultaneous Claude calls
  let queue = Promise.resolve()
  function enqueue(fn) {
    const result = queue.then(fn)
    queue = result.catch(() => {})
    return result
  }

  return {
    name: 'api-middleware',
    configureServer(server) {

      // --- /api/lines ---
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/lines') return next()
        console.log('[/api/lines] hit')
        res.setHeader('Content-Type', 'application/json')
        if (!apiKey || apiKey === 'your_api_key_here') {
          return res.end(JSON.stringify({ ...FALLBACK_LINES, error: 'No ANTHROPIC_API_KEY in .env' }))
        }
        const cached = getCached('lines')
        if (cached) { console.log('[/api/lines] cache hit'); return res.end(JSON.stringify(cached)) }
        try {
          const result = await enqueue(async () => {
            const pageRes = await fetch('https://www.dailyfaceoff.com/teams/seattle-kraken/line-combinations/', {
              signal: AbortSignal.timeout(10000),
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            })
            const html = await pageRes.text()
            const snippet = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 6000)
            const parsed = await callClaude(apiKey,
              'Return ONLY a JSON object, no explanation: {"lines":[{"line":1,"lw":"Name","c":"Name","rw":"Name"},...],"pairs":[{"pair":1,"ld":"Name","rd":"Name"},...],"goalie":"Name"}',
              `Extract the Seattle Kraken line combinations from this page text:\n\n${snippet}`
            )
            return { ...parsed, fallback: false, updatedAt: new Date().toISOString() }
          })
          setCached('lines', result)
          console.log('[/api/lines] success')
          return res.end(JSON.stringify(result))
        } catch (e) {
          console.error('[/api/lines] error:', e.message)
          return res.end(JSON.stringify({ ...FALLBACK_LINES, error: e.message }))
        }
      })

      // --- /api/news ---
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/news') return next()
        console.log('[/api/news] hit')
        res.setHeader('Content-Type', 'application/json')

        const cachedNews = getCached('news')
        if (cachedNews) { console.log('[/api/news] cache hit'); return res.end(JSON.stringify(cachedNews)) }

        async function fetchRSS(url) {
          try {
            const r = await fetch(url, { signal: AbortSignal.timeout(10000) })
            return await r.text()
          } catch { return '' }
        }

        function parseRSS(xml) {
          const items = []
          const itemRx = /<item>([\s\S]*?)<\/item>/g
          let m
          while ((m = itemRx.exec(xml)) !== null) {
            const get = (tag) => {
              const t = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)
              const match = t.exec(m[1])
              return match ? (match[1] || match[2] || '').trim() : ''
            }
            const creator = (() => {
              const cx = /<dc:creator[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/dc:creator>/i.exec(m[1])
              return cx ? cx[1].trim() : ''
            })()
            items.push({ title: get('title'), description: get('description'), pubDate: get('pubDate'), link: get('link'), creator })
          }
          return items
        }

        try {
          const xml = await fetchRSS('https://news.google.com/rss/search?q=seattle+kraken+NHL&hl=en-US&gl=US&ceid=US:en')
          const items = parseRSS(xml).filter(i => i.title).slice(0, 10)
          if (items.length === 0) throw new Error('No RSS items found')

          const linkMap = {}
          items.forEach(it => { linkMap[it.title] = it.link })

          const itemList = items.map((it, i) =>
            `${i + 1}. Title: ${it.title}\nSnippet: ${it.description.replace(/<[^>]+>/g, '').slice(0, 200)}\nSource: ${it.creator || 'Google News'}\nDate: ${it.pubDate}`
          ).join('\n\n')

          const articles = await enqueue(async () => {
            const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
              body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: 1500,
                system: 'Return ONLY a valid JSON array, no markdown: [{"title":"exact title as given","summary":"2 sentences max","source":"...","date":"Month Day, Year","category":"Roster|Game Recap|Trade Rumor|Injury|Draft|General"}]. Keep titles exactly as provided.',
                messages: [{ role: 'user', content: `Summarize and categorize these Seattle Kraken news items:\n\n${itemList}` }],
              }),
            })
            if (!claudeRes.ok) {
              const errText = await claudeRes.text()
              throw new Error(`Anthropic ${claudeRes.status}: ${errText.slice(0, 200)}`)
            }
            const claudeJson = await claudeRes.json()
            const textBlock = claudeJson.content?.find(b => b.type === 'text')
            if (!textBlock) throw new Error('No text block from Claude')
            const arrayMatch = textBlock.text.match(/\[[\s\S]*\]/)
            if (!arrayMatch) throw new Error('Could not parse JSON array')
            return JSON.parse(arrayMatch[0]).map(a => ({
              ...a,
              url: linkMap[a.title] || Object.entries(linkMap).find(([t]) => t.includes(a.title.slice(0, 20)))?.[1] || null,
            }))
          })
          const newsResult = { articles, updatedAt: new Date().toISOString() }
          setCached('news', newsResult)
          console.log('[/api/news] success:', articles.length, 'articles')
          return res.end(JSON.stringify(newsResult))
        } catch (e) {
          console.error('[/api/news] error:', e.message)
          return res.end(JSON.stringify({ articles: [], error: e.message }))
        }
      })

      // --- /api/rumors ---
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/rumors') return next()
        console.log('[/api/rumors] hit')
        res.setHeader('Content-Type', 'application/json')

        const cachedRumors = getCached('rumors')
        if (cachedRumors) { console.log('[/api/rumors] cache hit'); return res.end(JSON.stringify(cachedRumors)) }

        async function fetchRSS(url) {
          try {
            const r = await fetch(url, { signal: AbortSignal.timeout(10000) })
            return await r.text()
          } catch { return '' }
        }

        function parseRSS(xml) {
          const items = []
          const itemRx = /<item>([\s\S]*?)<\/item>/g
          let m
          while ((m = itemRx.exec(xml)) !== null) {
            const get = (tag) => {
              const t = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)
              const match = t.exec(m[1])
              return match ? (match[1] || match[2] || '').trim() : ''
            }
            const creator = (() => {
              const cx = /<dc:creator[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/dc:creator>/i.exec(m[1])
              return cx ? cx[1].trim() : ''
            })()
            items.push({ title: get('title'), description: get('description'), pubDate: get('pubDate'), link: get('link'), creator })
          }
          return items
        }

        try {
          const xml = await fetchRSS('https://news.google.com/rss/search?q=seattle+kraken+trade+rumors+NHL&hl=en-US&gl=US&ceid=US:en')
          const items = parseRSS(xml).filter(i => i.title).slice(0, 10)
          if (items.length === 0) throw new Error('No RSS items found')

          const linkMap = {}
          items.forEach(it => { linkMap[it.title] = it.link })

          const itemList = items.map((it, i) =>
            `${i + 1}. Title: ${it.title}\nSnippet: ${it.description.replace(/<[^>]+>/g, '').slice(0, 500)}\nSource: ${it.creator || 'Google News'}\nDate: ${it.pubDate}`
          ).join('\n\n')

          const rumors = await enqueue(async () => {
            const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
              body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: 3000,
                system: 'You are a Seattle Kraken trade rumors aggregator. For each article you find, you MUST read the full article content and extract every NHL player name mentioned. Be aggressive about finding player names — look for first and last names of any NHL player. The players array is the most important field and must never be empty if any player is mentioned anywhere in the article. Current Seattle Kraken players include: Matty Beniers, Vince Dunn, Brandon Montour, Jared McCann, Joey Daccord, Kaapo Kakko, Shane Wright, Berkly Catton, Chandler Stephenson, Jordan Eberle, Eeli Tolvanen, Adam Larsson, Ryan Lindgren, Ryker Evans, Jamie Oleksiak, Jani Nyman, Bobby McMann, Frederick Gaudreau, Ben Meyers, Ryan Winterton, Philipp Grubauer, Matt Murray. If any of these names appear in the article, they MUST be in the players array. Return ONLY a JSON array, no markdown: [{"title":"exact title","summary":"2-3 sentence summary naming all players and teams involved","source":"publication","date":"Month Day, Year","category":"Trade|Free Agency|Extension|Buyout|Waiver","status":"Hot|Developing|Cold|Confirmed|Denied","players":["First Last"],"url":"url or empty string"}].',
                messages: [{ role: 'user', content: `Summarize and categorize these Seattle Kraken trade rumor items:\n\n${itemList}` }],
              }),
            })
            if (!claudeRes.ok) {
              const errText = await claudeRes.text()
              throw new Error(`Anthropic ${claudeRes.status}: ${errText.slice(0, 200)}`)
            }
            const claudeJson = await claudeRes.json()
            const textBlock = claudeJson.content?.find(b => b.type === 'text')
            if (!textBlock) throw new Error('No text block from Claude')
            const arrayMatch = textBlock.text.match(/\[[\s\S]*\]/)
            if (!arrayMatch) throw new Error('Could not parse JSON array')
            let parsed
            try {
              parsed = JSON.parse(arrayMatch[0])
            } catch {
              // Fallback: extract individual complete objects if full array parse fails
              const objMatches = [...arrayMatch[0].matchAll(/\{(?:[^{}]|\{[^{}]*\})*\}/g)]
              parsed = objMatches.flatMap(m => { try { return [JSON.parse(m[0])] } catch { return [] } })
              if (parsed.length === 0) throw new Error('Could not parse any rumor objects from response')
              console.warn('[/api/rumors] Fallback object extraction got', parsed.length, 'items')
            }
            return parsed.map(a => ({
              ...a,
              players: Array.isArray(a.players) ? a.players : [],
              url: a.url || linkMap[a.title] || Object.entries(linkMap).find(([t]) => t.includes((a.title||'').slice(0,20)))?.[1] || null,
            }))
          })
          const result = { rumors, updatedAt: new Date().toISOString() }
          setCached('rumors', result)
          console.log('[/api/rumors] success:', rumors.length, 'rumors')
          return res.end(JSON.stringify(result))
        } catch (e) {
          console.error('[/api/rumors] error:', e.message)
          return res.end(JSON.stringify({ rumors: [], error: e.message }))
        }
      })

      // --- /api/gamepreview-storylines ---
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/gamepreview-storylines') return next()
        console.log('[/api/gamepreview-storylines] hit')
        res.setHeader('Content-Type', 'application/json')
        if (!apiKey || apiKey === 'your_api_key_here') {
          return res.end(JSON.stringify({ storylines: [], error: 'No ANTHROPIC_API_KEY in .env' }))
        }
        const cached = getCached('gamepreview-storylines')
        if (cached) { console.log('[/api/gamepreview-storylines] cache hit'); return res.end(JSON.stringify(cached)) }
        try {
          const result = await enqueue(async () => {
            const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
              body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: 1000,
                system: 'Generate 2-3 short compelling game preview storylines for a Seattle Kraken vs Edmonton Oilers NHL game. Each storyline should be 2-3 sentences highlighting interesting narratives, player matchups, team dynamics, recent form, or history between the teams. Format as a JSON array: [{"headline":"short headline","blurb":"2-3 sentence storyline"}]. Make them feel like real sports journalism.',
                messages: [{ role: 'user', content: 'Generate the game preview storylines for Seattle Kraken vs Edmonton Oilers.' }],
              }),
            })
            if (!claudeRes.ok) {
              const errText = await claudeRes.text()
              throw new Error(`Anthropic ${claudeRes.status}: ${errText.slice(0, 200)}`)
            }
            const claudeJson = await claudeRes.json()
            const textBlock = claudeJson.content?.find(b => b.type === 'text')
            if (!textBlock) throw new Error('No text block from Claude')
            const arrayMatch = textBlock.text.match(/\[[\s\S]*\]/)
            if (!arrayMatch) throw new Error('Could not parse JSON array')
            return JSON.parse(arrayMatch[0])
          })
          const payload = { storylines: result, updatedAt: new Date().toISOString() }
          setCached('gamepreview-storylines', payload)
          console.log('[/api/gamepreview-storylines] success:', result.length, 'storylines')
          return res.end(JSON.stringify(payload))
        } catch (e) {
          console.error('[/api/gamepreview-storylines] error:', e.message)
          return res.end(JSON.stringify({ storylines: [], error: e.message }))
        }
      })

      // --- /api/injuries ---
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/injuries') return next()
        console.log('[/api/injuries] hit')
        res.setHeader('Content-Type', 'application/json')
        if (!apiKey || apiKey === 'your_api_key_here') {
          return res.end(JSON.stringify({ injuries: {}, error: 'No ANTHROPIC_API_KEY in .env' }))
        }
        try {
          const pageRes = await fetch('https://www.rotowire.com/hockey/injury-report.php', {
            signal: AbortSignal.timeout(10000),
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          })
          const html = await pageRes.text()
          const snippet = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
          const krakenSection = snippet.slice(Math.max(0, snippet.indexOf('Seattle')), snippet.indexOf('Seattle') + 3000) || snippet.slice(0, 4000)
          const parsed = await callClaude(apiKey,
            'Return ONLY a JSON object {"Player Full Name":"Return Date or Day-to-Day"}. Only Seattle Kraken players. Empty object if none.',
            `Extract injured Seattle Kraken players from this injury report text:\n\n${krakenSection}`
          )
          console.log('[/api/injuries] success:', Object.keys(parsed).length, 'injured players')
          return res.end(JSON.stringify({ injuries: parsed, updatedAt: new Date().toISOString() }))
        } catch (e) {
          console.error('[/api/injuries] error:', e.message)
          return res.end(JSON.stringify({ injuries: {}, error: e.message }))
        }
      })

    },
  }
}

export default defineConfig(() => {
  const apiKey = readEnvFile()
  console.log('[vite.config] API key loaded:', !!apiKey)

  return {
    plugins: [react(), apiPlugin(apiKey)],
    server: {
      port: 3001,
      proxy: {
        '/nhl-api': {
          target: 'https://api-web.nhle.com',
          changeOrigin: true,
          followRedirects: true,
          rewrite: (path) => path.replace(/^\/nhl-api/, ''),
        },
        '/nhl-stats': {
          target: 'https://api.nhle.com',
          changeOrigin: true,
          followRedirects: true,
          rewrite: (path) => path.replace(/^\/nhl-stats/, ''),
        },
      },
    },
  }
})
