import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../utils/usePageTitle'
import { lookupPlayer, allRosterPlayers } from '../utils/playerLookup'
import rumorsFallback from '../data/rumors-fallback.json'

const KNOWN_KRAKEN_PLAYERS = [
  'Matty Beniers', 'Vince Dunn', 'Brandon Montour', 'Jared McCann', 'Joey Daccord',
  'Kaapo Kakko', 'Shane Wright', 'Berkly Catton', 'Chandler Stephenson', 'Jordan Eberle',
  'Eeli Tolvanen', 'Adam Larsson', 'Ryan Lindgren', 'Ryker Evans', 'Jamie Oleksiak',
  'Jani Nyman', 'Bobby McMann', 'Frederick Gaudreau', 'Ben Meyers', 'Ryan Winterton',
  'Philipp Grubauer', 'Matt Murray', 'Victor Ostman', 'Jagger Firkus',
]

// Match Kraken roster players by full name from text
function extractKrakenPlayers(text) {
  const found = []
  const lower = text.toLowerCase()

  // Dynamic roster — skip entries missing either name part
  allRosterPlayers().forEach(p => {
    const first = p.firstName?.default
    const last  = p.lastName?.default
    if (!first || !last) return
    const fullName = `${first} ${last}`
    if (lower.includes(fullName.toLowerCase())) found.push(fullName)
  })

  // Hardcoded fallback ensures tags work even when roster data has gaps
  KNOWN_KRAKEN_PLAYERS.forEach(name => {
    if (lower.includes(name.toLowerCase())) found.push(name)
  })

  return [...new Set(found)]
}

const CACHE_KEY = 'kraken_rumors_cache_v2'
const CACHE_TTL = 5 * 60 * 1000  // 5 min client-side dedup; real 8h cache is server-side (CDN)
const COOLDOWN_SECS = 60
const CACHE_LABEL = 'Updates every 8 hours'

// ─── Category border colors ───────────────────────────────────────────────────
const CATEGORY_BORDER = {
  'Trade':       '#E9072B',
  'Free Agency': '#99D9D9',
  'Extension':   '#4ade80',
  'Buyout':      '#fbbf24',
  'Waiver':      '#6b7280',
}

const CATEGORY_BADGE = {
  'Trade':       'bg-kraken/20 text-red-400 border-kraken/30',
  'Free Agency': 'bg-ice/20 text-ice border-ice/30',
  'Extension':   'bg-green-500/20 text-green-400 border-green-500/30',
  'Buyout':      'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Waiver':      'bg-white/10 text-white/50 border-white/15',
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  'Hot':       { emoji: '🔥', color: 'text-orange-400',  bg: 'bg-orange-500/15 border-orange-500/30' },
  'Developing':{ emoji: '📡', color: 'text-yellow-400',  bg: 'bg-yellow-500/15 border-yellow-500/30' },
  'Cold':      { emoji: '❄️', color: 'text-blue-300',    bg: 'bg-blue-500/10 border-blue-500/20' },
  'Confirmed': { emoji: '✓',  color: 'text-green-400',   bg: 'bg-green-500/15 border-green-500/30' },
  'Denied':    { emoji: '✗',  color: 'text-white/40',    bg: 'bg-white/5 border-white/15' },
}

// ─── Source credibility ───────────────────────────────────────────────────────
const GREEN_SOURCES  = ['friedman', 'dreger', 'mckenzie', 'insider trading', 'renaud lavoie', 'elliotte']
const YELLOW_SOURCES = ['prohockeyrumors', 'daily faceoff', 'the athletic', 'sportsnet', 'tsn', 'nhl.com', 'espn']

function sourceColor(source = '') {
  const s = source.toLowerCase()
  if (GREEN_SOURCES.some(k => s.includes(k)))  return 'text-green-400'
  if (YELLOW_SOURCES.some(k => s.includes(k))) return 'text-yellow-400'
  return 'text-white/40'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.ts || !Array.isArray(parsed?.data?.rumors)) return null
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="border-l-4 border-white/10 pl-4 py-4 animate-pulse">
      <div className="flex gap-2 mb-3">
        <div className="h-5 bg-white/10 rounded w-16" />
        <div className="h-5 bg-white/10 rounded w-20" />
      </div>
      <div className="h-5 bg-white/10 rounded w-3/4 mb-2" />
      <div className="h-4 bg-white/10 rounded w-full mb-1" />
      <div className="h-4 bg-white/10 rounded w-2/3 mb-3" />
      <div className="flex gap-2">
        <div className="h-5 bg-white/10 rounded-full w-20" />
        <div className="h-5 bg-white/10 rounded-full w-16" />
      </div>
    </div>
  )
}

// Rumors older than 30 days are automatically downgraded to Cold
function resolveStatus(rumor) {
  if (rumor.date) {
    const parsed = new Date(rumor.date)
    if (!isNaN(parsed) && Date.now() - parsed.getTime() > 30 * 24 * 60 * 60 * 1000) {
      return 'Cold'
    }
  }
  return rumor.status
}

// ─── Single rumor card ────────────────────────────────────────────────────────
function RumorRow({ rumor }) {
  const borderColor  = CATEGORY_BORDER[rumor.category] ?? '#6b7280'
  const badgeClass   = CATEGORY_BADGE[rumor.category]  ?? CATEGORY_BADGE['Waiver']
  const effectStatus = resolveStatus(rumor)
  const status       = STATUS_CONFIG[effectStatus] ?? STATUS_CONFIG['Cold']
  const srcColor    = sourceColor(rumor.source)
  const searchText = `${rumor.title ?? ''} ${rumor.summary ?? ''}`
  const apiPlayers = (rumor.players ?? []).filter(name => /\S+\s+\S+/.test((name ?? '').trim()))
  const players    = apiPlayers.length > 0 ? apiPlayers : extractKrakenPlayers(searchText).filter(name => /\S+\s+\S+/.test(name.trim()))

  return (
    <div
      className="rounded-xl border border-white/8 bg-navy/40 overflow-hidden"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="p-5">
        {/* Top row — badges + date */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeClass}`}>
            {rumor.category}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${status.bg} ${status.color}`}>
            <span>{status.emoji}</span>{effectStatus}
          </span>
          <span className="text-white/30 text-xs ml-auto shrink-0">{rumor.date}</span>
        </div>

        {/* Title */}
        <h3 className="text-white font-bold text-base leading-snug mb-2">{rumor.title}</h3>

        {/* Summary */}
        <p className="text-white/65 text-sm leading-relaxed mb-4">{rumor.summary}</p>

        {/* Player tags — ALL players */}
        {players.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {players.map((name) => {
              const p = lookupPlayer(name)
              return p ? (
                <Link
                  key={name}
                  to={`/player/${p.id}`}
                  className="text-xs font-semibold px-2.5 py-1 rounded-full bg-ice/15 text-ice border border-ice/25 hover:bg-ice/25 transition-colors"
                >
                  {name}
                </Link>
              ) : (
                <span
                  key={name}
                  className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/5 text-white/40 border border-white/10"
                >
                  {name}
                </span>
              )
            })}
          </div>
        )}

        {/* Footer — source + read more */}
        <div className="flex items-center justify-between gap-3">
          <span className={`text-xs font-semibold ${srcColor}`}>{rumor.source}</span>
          {rumor.url && (
            <a
              href={rumor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ice/70 hover:text-ice text-xs font-semibold transition-colors flex items-center gap-1 shrink-0"
            >
              Read more
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function Rumors() {
  usePageTitle('Trade Rumors')

  // Seed with static fallback or localStorage immediately — page is never blank
  const [rumors,    setRumors]    = useState(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      if (parsed?.data?.rumors?.length > 0) return parsed.data.rumors
    } catch {}
    return rumorsFallback
  })
  const [loading,   setLoading]   = useState(false) // never block on load — content already shown
  const [error,     setError]     = useState(null)
  const [updatedAt, setUpdatedAt] = useState(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      if (parsed?.ts) return new Date(parsed.ts)
    } catch {}
    return null
  })
  const [fromCache, setFromCache] = useState(null)
  const [cooldown,  setCooldown]  = useState(0)
  const cooldownRef = useRef(null)
  const fetchingRef = useRef(false)

  function startCooldown() {
    setCooldown(COOLDOWN_SECS)
    cooldownRef.current = setInterval(() => {
      setCooldown(s => { if (s <= 1) { clearInterval(cooldownRef.current); return 0 } return s - 1 })
    }, 1000)
  }

  const fetchRumors = useCallback(async (forceRefresh = false) => {
    if (fetchingRef.current) return

    // Always show any cached data immediately — no spinner on return visits
    const cached = readCache()
    if (cached?.data?.rumors?.length > 0) {
      setRumors(cached.data.rumors)
      setUpdatedAt(new Date(cached.ts))
      setFromCache(true)
      setLoading(false)
      // If cache is still fresh and not a forced refresh, stop here
      if (!forceRefresh && Date.now() - cached.ts < CACHE_TTL) {
        console.log(`[Rumors] Cache fresh — ${Math.round((Date.now() - cached.ts) / 60000)} min old, skipping fetch`)
        return
      }
      console.log('[Rumors] Cache stale — refreshing in background')
    }

    console.log('[Rumors] API call made')
    fetchingRef.current = true
    // Only show the loading spinner if we have nothing to display yet
    if (!cached?.data?.rumors?.length) setLoading(true)
    setError(null)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30 s hard timeout
    try {
      const res  = await fetch('/api/rumors', { signal: controller.signal })
      const data = await res.json()
      if (data.error && data.rumors?.length === 0) throw new Error(data.error)
      setRumors(data.rumors ?? [])
      const now = new Date()
      setUpdatedAt(now)
      setFromCache(false)
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: now.getTime() }))
      startCooldown()
    } catch (e) {
      const isTimeout = e.name === 'AbortError'
      const msg = isTimeout ? 'Request timed out after 30 seconds' : e.message
      // Fall back to any stale localStorage cache before showing the error
      const stale = readCache()
      if (stale?.data?.rumors?.length > 0) {
        console.log('[Rumors] API failed — serving stale cache')
        setRumors(stale.data.rumors)
        setUpdatedAt(new Date(stale.ts))
        setFromCache(true)
        setError(msg) // still show the error so user knows data may be old
      } else {
        setError(isTimeout
          ? 'Rumors temporarily unavailable, check back soon.'
          : msg)
      }
    } finally {
      clearTimeout(timeout)
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    fetchRumors()
    return () => clearInterval(cooldownRef.current)
  }, [fetchRumors])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const cached = readCache()
      if (!cached || Date.now() - cached.ts >= CACHE_TTL) fetchRumors()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchRumors])

  const isDisabled = loading || cooldown > 0
  const handleRefresh = () => { if (!isDisabled) fetchRumors(true) }

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Trade Rumors</h1>
          <div className="flex flex-col gap-0.5 mt-1">
            <div className="flex items-center gap-2">
              {fromCache !== null && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${fromCache ? 'bg-white/10 text-white/50' : 'bg-ice/20 text-ice'}`}>
                  {fromCache ? 'Cached' : 'Live'}
                </span>
              )}
              <p className="text-white/50 text-sm">
                {updatedAt ? `Updated ${timeAgoStr(updatedAt)}` : 'Latest Kraken trade rumors & roster speculation'}
              </p>
            </div>
            <p className="text-white/25 text-xs">{CACHE_LABEL}</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isDisabled}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-slate text-white/70 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? 'Fetching…' : cooldown > 0 ? `Available in ${cooldown}s` : 'Refresh'}
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-6 text-xs text-white/30">
        <span>Source credibility: <span className="text-green-400">● Insider</span></span>
        <span><span className="text-yellow-400">● Outlet</span></span>
        <span><span className="text-white/40">● Unverified</span></span>
      </div>

      {/* Error */}
      {error && !loading && (
        <div className={`border rounded-xl p-4 mb-6 flex items-start gap-3 ${rumors.length > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-kraken/10 border-kraken/30'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 shrink-0 mt-0.5 ${rumors.length > 0 ? 'text-amber-400' : 'text-kraken'}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <p className={`font-semibold text-sm ${rumors.length > 0 ? 'text-amber-300' : 'text-white'}`}>
              {rumors.length > 0 ? 'Showing cached results — live update failed' : 'Couldn\'t load rumors'}
            </p>
            <p className="text-white/40 text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-slate rounded-xl px-5">
              <SkeletonRow />
            </div>
          ))}
        </div>
      ) : rumors.length === 0 ? (
        <p className="text-white/40 text-center py-16">No rumors found.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {rumors.map((r, i) => <RumorRow key={i} rumor={r} />)}
        </div>
      )}
    </div>
  )
}
