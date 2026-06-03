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

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_api_key_here') {
    return res.end(JSON.stringify({ ...FALLBACK_LINES, error: 'No ANTHROPIC_API_KEY set' }))
  }

  try {
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

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: 'Return ONLY a JSON object, no explanation: {"lines":[{"line":1,"lw":"Name","c":"Name","rw":"Name"},...],"pairs":[{"pair":1,"ld":"Name","rd":"Name"},...],"goalie":"Name"}',
        messages: [{ role: 'user', content: `Extract the Seattle Kraken line combinations from this page text:\n\n${snippet}` }],
      }),
    })
    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      throw new Error(`Anthropic ${claudeRes.status}: ${errText.slice(0, 200)}`)
    }
    const claudeJson = await claudeRes.json()
    const textBlock = claudeJson.content?.find(b => b.type === 'text')
    if (!textBlock) throw new Error('No text block from Claude')
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Could not parse JSON from response')
    const parsed = JSON.parse(jsonMatch[0])
    return res.end(JSON.stringify({ ...parsed, fallback: false, updatedAt: new Date().toISOString() }))
  } catch (e) {
    return res.end(JSON.stringify({ ...FALLBACK_LINES, error: e.message }))
  }
}
