export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_api_key_here') {
    return res.end(JSON.stringify({ storylines: [], error: 'No ANTHROPIC_API_KEY set' }))
  }

  try {
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
    const storylines = JSON.parse(arrayMatch[0])
    return res.end(JSON.stringify({ storylines, updatedAt: new Date().toISOString() }))
  } catch (e) {
    return res.end(JSON.stringify({ storylines: [], error: e.message }))
  }
}
