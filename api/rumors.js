export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_api_key_here') {
    return res.end(JSON.stringify({ rumors: [], error: 'No ANTHROPIC_API_KEY set' }))
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

  try {
    const xml = await fetchRSS('https://news.google.com/rss/search?q=seattle+kraken+trade+rumors+NHL&hl=en-US&gl=US&ceid=US:en')
    const items = parseRSS(xml).filter(i => i.title).slice(0, 10)
    if (items.length === 0) throw new Error('No RSS items found')

    const linkMap = {}
    items.forEach(it => { linkMap[it.title] = it.link })

    const itemList = items.map((it, i) =>
      `${i + 1}. Title: ${it.title}\nSnippet: ${it.description.replace(/<[^>]+>/g, '').slice(0, 500)}\nSource: ${it.creator || 'Google News'}\nDate: ${it.pubDate}`
    ).join('\n\n')

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
      const objMatches = [...arrayMatch[0].matchAll(/\{(?:[^{}]|\{[^{}]*\})*\}/g)]
      parsed = objMatches.flatMap(m => { try { return [JSON.parse(m[0])] } catch { return [] } })
      if (parsed.length === 0) throw new Error('Could not parse any rumor objects from response')
    }

    const rumors = parsed.map(a => ({
      ...a,
      players: Array.isArray(a.players) ? a.players : [],
      url: a.url || linkMap[a.title] || Object.entries(linkMap).find(([t]) => t.includes((a.title || '').slice(0, 20)))?.[1] || null,
    }))

    return res.end(JSON.stringify({ rumors, updatedAt: new Date().toISOString() }))
  } catch (e) {
    return res.end(JSON.stringify({ rumors: [], error: e.message }))
  }
}
