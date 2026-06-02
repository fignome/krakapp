import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import playerstyles from '../data/playerstyles.json'
import { formatPosition } from '../utils/formatPosition'
import { usePageTitle } from '../utils/usePageTitle'
import { CAPTAINS } from '../data/captains.js'
import { StatTip } from '../utils/Tooltip.jsx'
import contracts from '../data/contracts.json'

const CAP_CEILING = 88_000_000
const totalCapHit = Object.values(contracts).reduce((sum, c) => sum + (c.aav ?? 0), 0)

function SkeletonRow() {
  return (
    <tr className="border-b border-white/5 animate-pulse">
      <td className="px-4 py-3"><div className="h-4 bg-white/10 rounded w-6" /></td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/10 shrink-0" />
          <div className="h-4 bg-white/10 rounded w-32" />
        </div>
      </td>
      <td className="px-4 py-3"><div className="h-4 bg-white/10 rounded w-6 mx-auto" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-white/10 rounded w-6 mx-auto" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-white/10 rounded w-6 mx-auto" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-white/10 rounded w-6 mx-auto" /></td>
    </tr>
  )
}

function PlayerAvatar({ player }) {
  const [failed, setFailed] = useState(false)
  const initials = `${player.firstName?.default?.[0] ?? ''}${player.lastName?.default?.[0] ?? ''}`
  if (failed) {
    return (
      <div className="w-9 h-9 rounded-full bg-slate flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-ice">{initials}</span>
      </div>
    )
  }
  return (
    <img
      src={`https://assets.nhle.com/mugs/nhl/20252026/SEA/${player.id}.png`}
      alt={initials}
      className="w-9 h-9 rounded-full object-cover bg-navy shrink-0"
      onError={() => setFailed(true)}
    />
  )
}

const positionColor = {
  L: 'text-ice', R: 'text-ice', C: 'text-ice', D: 'text-yellow-300', G: 'text-kraken',
}

function CaptainBadge({ id }) {
  const role = CAPTAINS[id]
  if (!role) return null
  return (
    <span className={`text-[10px] font-black px-1 py-0.5 rounded leading-none shrink-0 ${
      role === 'C' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' : 'bg-white/10 text-white/60 border border-white/20'
    }`}>
      {role}
    </span>
  )
}

const COUNTRY_FLAG = {
  CAN: '🇨🇦', USA: '🇺🇸', FIN: '🇫🇮', SWE: '🇸🇪', CZE: '🇨🇿', RUS: '🇷🇺',
  SVK: '🇸🇰', DEU: '🇩🇪', AUT: '🇦🇹', SUI: '🇨🇭', DEN: '🇩🇰', NOR: '🇳🇴',
  LVA: '🇱🇻', BLR: '🇧🇾', FRA: '🇫🇷', SVN: '🇸🇮', KAZ: '🇰🇿', AUS: '🇦🇺',
  NLD: '🇳🇱', HUN: '🇭🇺',
}

const SORT_OPTIONS = [
  { key: 'number', label: '#' },
  { key: 'name',   label: 'Name' },
  { key: 'pos',    label: 'Pos' },
  { key: 'pts',    label: 'PTS' },
  { key: 'goals',  label: 'G' },
]

async function fetchRoster() {
  try {
    const res = await fetch('/cache/roster.json')
    if (res.ok) {
      const data = await res.json()
      if (data.forwards || data.defensemen || data.goalies) return data
    }
  } catch {}
  const res = await fetch('/nhl-api/v1/roster/SEA/20252026')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function fetchStats() {
  try {
    const res = await fetch('/cache/playerstats.json')
    if (res.ok) return res.json()
  } catch {}
  return {}
}

export default function Roster() {
  usePageTitle('Roster')
  const [players,   setPlayers]   = useState([])
  const [statsMap,  setStatsMap]  = useState({})
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [injuryMap, setInjuryMap] = useState({})
  const [search,    setSearch]    = useState('')
  const [posGroup,  setPosGroup]  = useState('All')  // All / Forwards / Defense / Goalies
  const [sortKey,   setSortKey]   = useState('number')
  const [sortDir,   setSortDir]   = useState(1) // 1=asc, -1=desc

  useEffect(() => {
    Promise.all([fetchRoster(), fetchStats()])
      .then(([rosterData, stats]) => {
        const all = [
          ...(rosterData.forwards  ?? []),
          ...(rosterData.defensemen ?? []),
          ...(rosterData.goalies   ?? []),
        ]
        setPlayers(all)
        setStatsMap(stats)
        setLoading(false)
      })
      .catch((err) => { setError(err.message); setLoading(false) })
  }, [])

  useEffect(() => {
    fetch('/api/injuries')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.injuries) setInjuryMap(data.injuries) })
      .catch(() => {})
  }, [])

  const injuredById = useMemo(() => {
    const map = {}
    if (players.length && Object.keys(injuryMap).length) {
      players.forEach((p) => {
        const fullName = `${p.firstName?.default} ${p.lastName?.default}`.toLowerCase()
        const match = Object.entries(injuryMap).find(([name]) => name.toLowerCase() === fullName)
        if (match) map[p.id] = match[1]
      })
    }
    return map
  }, [players, injuryMap])

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => -d)
    else { setSortKey(key); setSortDir(key === 'pts' || key === 'goals' ? -1 : 1) }
  }

  const sorted = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = players.filter((p) => {
      if (q) {
        const full = `${p.firstName?.default} ${p.lastName?.default}`.toLowerCase()
        if (!full.includes(q)) return false
      }
      if (posGroup === 'Forwards' && !['C','L','R'].includes(p.positionCode)) return false
      if (posGroup === 'Defense'  && p.positionCode !== 'D')                   return false
      if (posGroup === 'Goalies'  && p.positionCode !== 'G')                   return false
      return true
    })
    return [...filtered].sort((a, b) => {
      let av, bv
      const aStats = statsMap[a.id]?.featuredStats?.regularSeason?.subSeason ?? {}
      const bStats = statsMap[b.id]?.featuredStats?.regularSeason?.subSeason ?? {}
      if (sortKey === 'number') { av = a.sweaterNumber ?? 99; bv = b.sweaterNumber ?? 99 }
      else if (sortKey === 'name') { return sortDir * `${a.lastName?.default}`.localeCompare(`${b.lastName?.default}`) }
      else if (sortKey === 'pos')  { av = a.positionCode ?? 'Z'; bv = b.positionCode ?? 'Z'; return sortDir * av.localeCompare(bv) }
      else if (sortKey === 'pts')  { av = aStats.points ?? -1; bv = bStats.points ?? -1 }
      else if (sortKey === 'goals'){ av = aStats.goals  ?? -1; bv = bStats.goals  ?? -1 }
      else { av = 0; bv = 0 }
      return sortDir * (av - bv)
    })
  }, [players, statsMap, search, posGroup, sortKey, sortDir])

  if (error) return <p className="text-kraken py-20 text-center">Failed to load roster: {error}</p>

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">2025–26 Roster</h1>
      <p className="text-white/50 mb-5">
        {loading ? 'Loading…' : `${players.length} players · Click a name to view full stats.`}
      </p>

      {/* Cap bar */}
      <div className="bg-slate rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between text-xs text-white/40 mb-2">
          <span>Salary Cap Usage</span>
          <span className="font-mono">${(totalCapHit / 1_000_000).toFixed(2)}M / $88.00M</span>
        </div>
        <div className="h-2 bg-navy rounded-full overflow-hidden">
          <div
            className="h-full bg-ice rounded-full"
            style={{ width: `${Math.min((totalCapHit / CAP_CEILING) * 100, 100).toFixed(1)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1.5">
          <span className="text-ice font-semibold">${(totalCapHit / 1_000_000).toFixed(2)}M used</span>
          <span className="text-white/30">${((CAP_CEILING - totalCapHit) / 1_000_000).toFixed(2)}M remaining</span>
        </div>
      </div>

      {/* Position group filters */}
      <div className="flex gap-1 mb-3">
        {['All', 'Forwards', 'Defense', 'Goalies'].map((g) => (
          <button
            key={g}
            onClick={() => setPosGroup(g)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              posGroup === g ? 'bg-ice text-navy' : 'bg-slate text-white/60 hover:text-white'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Search + sort bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search players…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate border border-white/10 text-white placeholder-white/30 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-ice/50"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white text-lg leading-none">×</button>
          )}
        </div>
        <div className="flex gap-1 flex-wrap">
          {SORT_OPTIONS.map(({ key, label }) => {
            const active = sortKey === key
            return (
              <button
                key={key}
                onClick={() => toggleSort(key)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1 ${
                  active ? 'bg-ice text-navy' : 'bg-slate text-white/60 hover:text-white'
                }`}
              >
                {label}
                {active && <span className="text-xs">{sortDir === 1 ? '↑' : '↓'}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {sorted.length === 0 && !loading && (
        <p className="text-white/40 text-center py-10">No players match "{search}"</p>
      )}

      <div className="bg-slate rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/60 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Player</th>
                <th className="px-4 py-3 text-center">Pos</th>
                <th className="px-4 py-3 text-center"><StatTip stat="G">G</StatTip></th>
                <th className="px-4 py-3 text-center"><StatTip stat="A">A</StatTip></th>
                <th className="px-4 py-3 text-center"><StatTip stat="PTS">PTS</StatTip></th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 20 }).map((_, i) => <SkeletonRow key={i} />)
                : sorted.map((p, i) => {
                    const sub = statsMap[p.id]?.featuredStats?.regularSeason?.subSeason ?? {}
                    const isG = p.positionCode === 'G'
                    return (
                      <tr
                        key={`${p.id}-${p.sweaterNumber}`}
                        className={`border-b border-white/5 hover:bg-navy/60 transition-colors ${i % 2 === 0 ? '' : 'bg-navy/20'}`}
                      >
                        <td className="px-4 py-3 text-white/40 font-mono">{p.sweaterNumber}</td>
                        <td className="px-4 py-3">
                          <Link to={`/player/${p.id}`} className="flex items-center gap-3 group">
                            <PlayerAvatar player={p} />
                            <div>
                              <div className="flex items-center gap-1.5">
                                {(() => {
                                  const country = statsMap[p.id]?.birthCountry
                                  const flag = COUNTRY_FLAG[country]
                                  return flag ? <span className="text-sm shrink-0" title={country}>{flag}</span> : null
                                })()}
                                <span className="font-semibold text-white group-hover:text-ice transition-colors">
                                  {p.firstName?.default} {p.lastName?.default}
                                </span>
                                <CaptainBadge id={p.id} />
                                {injuredById[p.id] !== undefined && (
                                  <span className="text-kraken text-xs font-bold shrink-0">✚</span>
                                )}
                              </div>
                              {injuredById[p.id] ? (
                                <div className="text-xs text-kraken/70 mt-0.5">Expected: {injuredById[p.id]}</div>
                              ) : playerstyles[p.id] ? (
                                <div className="text-xs text-white/30 mt-0.5">{playerstyles[p.id]}</div>
                              ) : null}
                            </div>
                          </Link>
                        </td>
                        <td className={`px-4 py-3 text-center font-bold ${positionColor[p.positionCode] ?? 'text-white'}`}>
                          {formatPosition(p.positionCode, p.id)}
                        </td>
                        <td className="px-4 py-3 text-center text-white/70">{isG ? '—' : (sub.goals ?? '—')}</td>
                        <td className="px-4 py-3 text-center text-white/70">{isG ? '—' : (sub.assists ?? '—')}</td>
                        <td className="px-4 py-3 text-center font-bold text-ice">{isG ? '—' : (sub.points ?? '—')}</td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
