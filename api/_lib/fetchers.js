// Shared Anthropic + RSS fetch logic used by both the cron refresher
// and the GET endpoints (cache-miss fallback).

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

async function claude(apiKey, system, userMsg, maxTokens = 1500) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, system, messages: [{ role: 'user', content: userMsg }] }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Anthropic ${res.status}: ${txt.slice(0, 200)}`)
  }
  const json = await res.json()
  const block = json.content?.find(b => b.type === 'text')
  if (!block) throw new Error('No text block from Claude')
  return block.text
}

// ─── News ──────────────────────────────────────────────────────────────────────
export async function fetchNews(apiKey) {
  const xml = await fetchRSS('https://news.google.com/rss/search?q=seattle+kraken+NHL&hl=en-US&gl=US&ceid=US:en')
  const items = parseRSS(xml).filter(i => i.title).slice(0, 10)
  if (items.length === 0) throw new Error('No RSS items found')

  const linkMap = {}
  items.forEach(it => { linkMap[it.title] = it.link })

  const itemList = items.map((it, i) =>
    `${i + 1}. Title: ${it.title}\nSnippet: ${it.description.replace(/<[^>]+>/g, '').slice(0, 200)}\nSource: ${it.creator || 'Google News'}\nDate: ${it.pubDate}`
  ).join('\n\n')

  const text = await claude(
    apiKey,
    'Return ONLY a valid JSON array, no markdown: [{"title":"exact title as given","summary":"2 sentences max","source":"...","date":"Month Day, Year","category":"Roster|Game Recap|Trade Rumor|Injury|Draft|General"}]. Keep titles exactly as provided.',
    `Summarize and categorize these Seattle Kraken news items:\n\n${itemList}`,
  )
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('Could not parse JSON array from Claude')
  const articles = JSON.parse(match[0]).map(a => ({
    ...a,
    url: linkMap[a.title] || Object.entries(linkMap).find(([t]) => t.includes(a.title.slice(0, 20)))?.[1] || null,
  }))
  return { articles, updatedAt: new Date().toISOString() }
}

// ─── Rumors ────────────────────────────────────────────────────────────────────
export async function fetchRumors(apiKey) {
  const xml = await fetchRSS('https://news.google.com/rss/search?q=seattle+kraken+trade+rumors+NHL&hl=en-US&gl=US&ceid=US:en')
  const items = parseRSS(xml).filter(i => i.title).slice(0, 10)
  if (items.length === 0) throw new Error('No RSS items found')

  const linkMap = {}
  items.forEach(it => { linkMap[it.title] = it.link })

  const itemList = items.map((it, i) =>
    `${i + 1}. Title: ${it.title}\nSnippet: ${it.description.replace(/<[^>]+>/g, '').slice(0, 500)}\nSource: ${it.creator || 'Google News'}\nDate: ${it.pubDate}`
  ).join('\n\n')

  const text = await claude(
    apiKey,
    'You are a Seattle Kraken trade rumors aggregator. For each article you find, you MUST read the full article content and extract every NHL player name mentioned. Be aggressive about finding player names — look for first and last names of any NHL player. The players array is the most important field and must never be empty if any player is mentioned anywhere in the article. Current Seattle Kraken players include: Matty Beniers, Vince Dunn, Brandon Montour, Jared McCann, Joey Daccord, Kaapo Kakko, Shane Wright, Berkly Catton, Chandler Stephenson, Jordan Eberle, Eeli Tolvanen, Adam Larsson, Ryan Lindgren, Ryker Evans, Jamie Oleksiak, Jani Nyman, Bobby McMann, Frederick Gaudreau, Ben Meyers, Ryan Winterton, Philipp Grubauer, Matt Murray. If any of these names appear in the article, they MUST be in the players array. Return ONLY a JSON array, no markdown: [{"title":"exact title","summary":"2-3 sentence summary naming all players and teams involved","source":"publication","date":"Month Day, Year","category":"Trade|Free Agency|Extension|Buyout|Waiver","status":"Hot|Developing|Cold|Confirmed|Denied","players":["First Last"],"url":"url or empty string"}].',
    `Summarize and categorize these Seattle Kraken trade rumor items:\n\n${itemList}`,
    3000,
  )
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('Could not parse JSON array from Claude')

  let parsed
  try {
    parsed = JSON.parse(match[0])
  } catch {
    const objMatches = [...match[0].matchAll(/\{(?:[^{}]|\{[^{}]*\})*\}/g)]
    parsed = objMatches.flatMap(m => { try { return [JSON.parse(m[0])] } catch { return [] } })
    if (parsed.length === 0) throw new Error('Could not parse any rumor objects')
  }

  const rumors = parsed.map(a => ({
    ...a,
    players: Array.isArray(a.players) ? a.players : [],
    url: a.url || linkMap[a.title] || Object.entries(linkMap).find(([t]) => t.includes((a.title || '').slice(0, 20)))?.[1] || null,
  }))
  return { rumors, updatedAt: new Date().toISOString() }
}

// ─── Lines ─────────────────────────────────────────────────────────────────────
export async function fetchLines(apiKey) {
  const pageRes = await fetch('https://www.dailyfaceoff.com/teams/seattle-kraken/line-combinations/', {
    signal: AbortSignal.timeout(10000),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  })
  const html = await pageRes.text()
  const snippet = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 6000)

  const text = await claude(
    apiKey,
    'Return ONLY a JSON object, no explanation: {"lines":[{"line":1,"lw":"Name","c":"Name","rw":"Name"},...],"pairs":[{"pair":1,"ld":"Name","rd":"Name"},...],"goalie":"Name"}',
    `Extract the Seattle Kraken line combinations from this page text:\n\n${snippet}`,
  )
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Could not parse JSON from Claude')
  return { ...JSON.parse(match[0]), fallback: false, updatedAt: new Date().toISOString() }
}

export { FALLBACK_LINES }
