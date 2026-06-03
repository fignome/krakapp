export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_api_key_here') {
    return res.end(JSON.stringify({ articles: [], error: 'No ANTHROPIC_API_KEY set' }))
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
    const xml = await fetchRSS('https://news.google.com/rss/search?q=seattle+kraken+NHL&hl=en-US&gl=US&ceid=US:en')
    const items = parseRSS(xml).filter(i => i.title).slice(0, 10)
    if (items.length === 0) throw new Error('No RSS items found')

    const linkMap = {}
    items.forEach(it => { linkMap[it.title] = it.link })

    const itemList = items.map((it, i) =>
      `${i + 1}. Title: ${it.title}\nSnippet: ${it.description.replace(/<[^>]+>/g, '').slice(0, 200)}\nSource: ${it.creator || 'Google News'}\nDate: ${it.pubDate}`
    ).join('\n\n')

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
    const articles = JSON.parse(arrayMatch[0]).map(a => ({
      ...a,
      url: linkMap[a.title] || Object.entries(linkMap).find(([t]) => t.includes(a.title.slice(0, 20)))?.[1] || null,
    }))
    return res.end(JSON.stringify({ articles, updatedAt: new Date().toISOString() }))
  } catch (e) {
    return res.end(JSON.stringify({ articles: [], error: e.message }))
  }
}
