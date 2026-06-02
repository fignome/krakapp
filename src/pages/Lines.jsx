import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { lookupPlayer, allRosterPlayers } from '../utils/playerLookup'
import { usePageTitle } from '../utils/usePageTitle'

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

function PlayerCard({ name, position }) {
  const player = lookupPlayer(name)
  const id = player?.id
  const initials = name ? name.split(' ').map((n) => n[0]).join('').slice(0, 2) : '?'

  const cardContent = (
    <div className="flex flex-col items-center gap-2 p-3 bg-navy rounded-xl text-center w-full">
      {id ? (
        <img
          src={`https://assets.nhle.com/mugs/nhl/20252026/SEA/${id}.png`}
          alt={name}
          className="w-14 h-14 rounded-full object-cover border-2 border-slate"
          onError={(e) => {
            e.target.style.display = 'none'
            e.target.nextSibling.style.display = 'flex'
          }}
        />
      ) : null}
      <div
        className="w-14 h-14 rounded-full bg-slate flex items-center justify-center border-2 border-slate/50 shrink-0"
        style={{ display: id ? 'none' : 'flex' }}
      >
        <span className="text-sm font-bold text-ice">{initials}</span>
      </div>
      <div>
        <div className="text-xs font-bold text-ice uppercase tracking-wide">{position}</div>
        <div className="text-sm font-semibold text-white leading-tight mt-0.5">{name || '—'}</div>
      </div>
    </div>
  )

  return id ? (
    <Link to={`/player/${id}`} className="flex-1 hover:scale-105 transition-transform">
      {cardContent}
    </Link>
  ) : (
    <div className="flex-1">{cardContent}</div>
  )
}

function ScratchedSection({ lines }) {
  const allPlayers = allRosterPlayers()
  const inLineup = new Set()

  lines.lines?.forEach((l) => {
    ;[l.lw, l.c, l.rw].forEach((name) => {
      const p = lookupPlayer(name)
      if (p) inLineup.add(p.id)
    })
  })
  lines.pairs?.forEach((p) => {
    ;[p.ld, p.rd].forEach((name) => {
      const pl = lookupPlayer(name)
      if (pl) inLineup.add(pl.id)
    })
  })
  const goalie = lookupPlayer(lines.goalie)
  if (goalie) inLineup.add(goalie.id)

  const scratched = allPlayers.filter((p) => !inLineup.has(p.id))
  if (!scratched.length) return null

  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold text-white/40 uppercase tracking-widest mb-3">
        Scratched / Not in lineup
      </h2>
      <div className="flex flex-wrap gap-3">
        {scratched.map((p) => {
          const name = `${p.firstName.default} ${p.lastName.default}`
          return (
            <Link
              key={p.id}
              to={`/player/${p.id}`}
              className="flex items-center gap-2 bg-navy/50 rounded-lg px-3 py-2 opacity-50 hover:opacity-75 transition-opacity"
            >
              <img
                src={`https://assets.nhle.com/mugs/nhl/20252026/SEA/${p.id}.png`}
                alt={name}
                className="w-8 h-8 rounded-full object-cover bg-slate"
                onError={(e) => { e.target.style.display = 'none' }}
              />
              <span className="text-sm text-white/70">{name}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

const CACHE_KEY = 'kraken_lines_cache'
const CACHE_TTL = 12 * 60 * 60 * 1000 // 12 hours
const COOLDOWN_SECS = 60
const CACHE_LABEL = 'Updates every 12 hours'

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.ts || !Array.isArray(parsed?.data?.lines)) return null
    return parsed
  } catch { return null }
}

function timeAgoStr(date) {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins === 1) return '1 minute ago'
  if (mins < 60) return `${mins} minutes ago`
  const hrs = Math.floor(mins / 60)
  return hrs === 1 ? '1 hour ago' : `${hrs} hours ago`
}

export default function Lines() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [fromCache, setFromCache] = useState(null)
  const [cooldown, setCooldown] = useState(0)
  const cooldownRef = useRef(null)
  const fetchingRef = useRef(false) // prevents duplicate in-flight calls

  function startCooldown() {
    setCooldown(COOLDOWN_SECS)
    cooldownRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) { clearInterval(cooldownRef.current); return 0 }
        return s - 1
      })
    }, 1000)
  }

  const fetchLines = useCallback((forceRefresh = false) => {
    // Single-flight guard — never queue multiple calls
    if (fetchingRef.current) return

    if (!forceRefresh) {
      const cached = readCache()
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        const ageMin = Math.round((Date.now() - cached.ts) / 60000)
        console.log(`[Lines] Cache hit — ${ageMin} min old, skipping API call`)
        setData(cached.data)
        setUpdatedAt(new Date(cached.ts))
        setFromCache(true)
        setLoading(false)
        return
      }
    }

    console.log('[Lines] API call made — cache expired or forced refresh')
    fetchingRef.current = true
    setLoading(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)
    fetch('/api/lines', { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        clearTimeout(timeout)
        setData(d)
        const now = new Date()
        setUpdatedAt(now)
        setFromCache(false)
        if (!d.fallback) {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: d, ts: now.getTime() }))
          console.log('[Lines] Fresh data cached')
        }
        setLoading(false)
        startCooldown()
        fetchingRef.current = false
      })
      .catch((e) => {
        clearTimeout(timeout)
        setData({ ...FALLBACK_LINES, error: e.name === 'AbortError' ? 'Request timed out' : e.message })
        setLoading(false)
        fetchingRef.current = false
      })
  }, [])

  usePageTitle('Line Combinations')

  // Mount: fetch once
  useEffect(() => {
    fetchLines()
    return () => clearInterval(cooldownRef.current)
  }, [fetchLines])

  // Tab focus: only re-fetch if cache has actually expired
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const cached = readCache()
      if (!cached || Date.now() - cached.ts >= CACHE_TTL) {
        console.log('[Lines] Tab focused with stale/missing cache — fetching')
        fetchLines()
      } else {
        console.log('[Lines] Tab focused — cache still valid, no fetch')
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchLines])

  // Hard block during cooldown
  const isDisabled = loading || cooldown > 0
  const handleRefreshClick = () => {
    if (isDisabled) return
    fetchLines(true)
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Line Combinations</h1>
          {data?.error && (
            <p className="text-kraken text-xs mt-1 font-mono bg-navy/60 px-2 py-1 rounded">Error: {data.error}</p>
          )}
          {data?.fallback && !data?.error ? (
            <p className="text-yellow-400/70 text-sm mt-1">Last known lines from end of 2025–26 season</p>
          ) : data?.fallback && data?.error ? (
            <p className="text-yellow-400/70 text-sm mt-1">Showing fallback lines — see error above</p>
          ) : updatedAt ? (
            <div className="mt-1">
              <div className="flex items-center gap-2">
                {fromCache !== null && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${fromCache ? 'bg-white/10 text-white/50' : 'bg-ice/20 text-ice'}`}>
                    {fromCache ? 'Cached' : 'Live'}
                  </span>
                )}
                <p className="text-white/40 text-sm">Updated {timeAgoStr(updatedAt)}</p>
              </div>
              <p className="text-white/25 text-xs mt-0.5">{CACHE_LABEL}</p>
            </div>
          ) : null}
        </div>
        <button
          onClick={handleRefreshClick}
          disabled={isDisabled}
          className="flex items-center gap-2 bg-slate hover:bg-slate/70 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <span className={loading ? 'animate-spin' : ''}>↻</span>
          {loading ? 'Fetching…' : cooldown > 0 ? `Available in ${cooldown}s` : 'Refresh'}
        </button>
      </div>

      {loading && !data && (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 bg-slate rounded-xl p-3">
              <div className="h-4 bg-white/10 rounded w-4" />
              <div className="flex gap-2 flex-1">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex-1 bg-white/10 rounded-xl h-24" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Forward Lines */}
          <div className="mb-6">
            <h2 className="text-xs text-white/40 uppercase tracking-widest mb-3">Forward Lines</h2>
            <div className="space-y-3">
              {data.lines?.map((line) => (
                <div key={line.line} className="flex items-center gap-3 bg-slate rounded-xl p-3">
                  <span className="text-white/30 text-xs font-black w-4 shrink-0">L{line.line}</span>
                  <div className="flex gap-2 flex-1 min-w-0 overflow-x-auto">
                    <PlayerCard name={line.lw} position="LW" />
                    <PlayerCard name={line.c}  position="C" />
                    <PlayerCard name={line.rw} position="RW" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* D Pairs */}
          <div className="mb-6">
            <h2 className="text-xs text-white/40 uppercase tracking-widest mb-3">Defensive Pairs</h2>
            <div className="space-y-3">
              {data.pairs?.map((pair) => (
                <div key={pair.pair} className="flex items-center gap-3 bg-slate rounded-xl p-3">
                  <span className="text-white/30 text-xs font-black w-4 shrink-0">P{pair.pair}</span>
                  <div className="flex gap-2 flex-1">
                    <PlayerCard name={pair.ld} position="LD" />
                    <PlayerCard name={pair.rd} position="RD" />
                    <div className="flex-1" /> {/* spacer to keep layout balanced */}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Starting Goalie */}
          {data.goalie && (
            <div className="mb-6">
              <h2 className="text-xs text-white/40 uppercase tracking-widest mb-3">Starting Goalie</h2>
              <div className="bg-slate rounded-xl p-3 inline-flex items-center gap-3">
                <span className="text-white/30 text-xs font-black w-4 shrink-0">G</span>
                <div className="w-40">
                  <PlayerCard name={data.goalie} position="G" />
                </div>
              </div>
            </div>
          )}

          <ScratchedSection lines={data} />
        </>
      )}
    </div>
  )
}
