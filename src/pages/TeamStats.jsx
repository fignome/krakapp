import { useState, useEffect } from 'react'
import { usePageTitle } from '../utils/usePageTitle'

const STATS_CONFIG = [
  {
    key:    'goalsForPerGame',
    label:  'Goals For / Game',
    fmt:    (v) => v.toFixed(2),
    higher: true,   // higher = better for Kraken
    unit:   '',
  },
  {
    key:    'goalsAgainstPerGame',
    label:  'Goals Against / Game',
    fmt:    (v) => v.toFixed(2),
    higher: false,  // lower = better
    unit:   '',
  },
  {
    key:    'powerPlayPct',
    label:  'Power Play %',
    fmt:    (v) => (v * 100).toFixed(1) + '%',
    higher: true,
    unit:   '%',
  },
  {
    key:    'penaltyKillPct',
    label:  'Penalty Kill %',
    fmt:    (v) => (v * 100).toFixed(1) + '%',
    higher: true,
    unit:   '%',
  },
  {
    key:    'shotsForPerGame',
    label:  'Shots For / Game',
    fmt:    (v) => v.toFixed(1),
    higher: true,
    unit:   '',
  },
  {
    key:    'shotsAgainstPerGame',
    label:  'Shots Against / Game',
    fmt:    (v) => v.toFixed(1),
    higher: false,
    unit:   '',
  },
]

function StatBar({ config, sea, avg, rank, teamCount, animate }) {
  const good = config.higher ? sea >= avg : sea <= avg
  const barColor = good ? 'bg-ice' : 'bg-kraken'

  // Normalise both values to a 0–100 bar position
  const min = Math.min(sea, avg) * 0.9
  const max = Math.max(sea, avg) * 1.1
  const range = max - min || 1
  const seaPct  = ((sea  - min) / range) * 80 + 10
  const avgPct  = ((avg  - min) / range) * 80 + 10

  const ordinal = (n) => {
    const s = ['th','st','nd','rd']
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
  }

  return (
    <div className="bg-slate rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">{config.label}</div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black text-ice">
              {config.fmt(sea)}
            </span>
            <span className="text-white/40 text-sm">
              League avg: {config.fmt(avg)}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-black text-white">
            {ordinal(rank)}
          </div>
          <div className="text-white/30 text-xs">of {teamCount}</div>
        </div>
      </div>

      {/* Comparative bar */}
      <div className="relative h-3 bg-navy rounded-full overflow-hidden">
        {/* Fill up to SEA value */}
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: animate ? `${seaPct}%` : '0%' }}
        />
      </div>

      {/* League avg marker */}
      <div className="relative h-0 mt-0">
        <div
          className="absolute top-[-14px] w-0.5 h-5 bg-white/30 rounded-full"
          style={{ left: `${avgPct}%`, transform: 'translateX(-50%)' }}
        />
      </div>

      <div className="flex justify-between mt-3 text-xs text-white/30">
        <span>SEA: {config.fmt(sea)}</span>
        <span>↕ League avg: {config.fmt(avg)}</span>
      </div>
    </div>
  )
}

function SkeletonBar() {
  return (
    <div className="bg-slate rounded-xl p-5 animate-pulse">
      <div className="h-4 bg-white/10 rounded w-32 mb-3" />
      <div className="h-8 bg-white/10 rounded w-24 mb-4" />
      <div className="h-3 bg-white/10 rounded-full" />
    </div>
  )
}

export default function TeamStats() {
  usePageTitle('Team Stats')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    async function load() {
      const res = await fetch(
        '/nhl-stats/stats/rest/en/team/summary?cayenneExp=seasonId=20252026%20and%20gameTypeId=2&sort=teamFullName&limit=40'
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const teams = json.data ?? []
      const sea = teams.find((t) => t.teamFullName?.includes('Seattle'))
      if (!sea) throw new Error('Seattle not found in team stats')

      const stats = {}
      STATS_CONFIG.forEach(({ key, higher }) => {
        const sorted = [...teams].sort((a, b) =>
          higher ? b[key] - a[key] : a[key] - b[key]
        )
        const rank = sorted.findIndex((t) => t.teamFullName?.includes('Seattle')) + 1
        const vals = teams.map((t) => t[key]).filter((v) => v != null)
        const avg  = vals.reduce((a, b) => a + b, 0) / vals.length
        stats[key] = { sea: sea[key], avg, rank, teamCount: teams.length }
      })

      setData(stats)
      setTimeout(() => setAnimate(true), 50)
    }
    load().catch((e) => setError(e.message))
  }, [])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">Team Stats</h1>
        <p className="text-white/50 text-sm">
          2025–26 Seattle Kraken vs NHL league average · Regular season
        </p>
      </div>

      {error && (
        <div className="bg-kraken/10 border border-kraken/30 rounded-xl p-5 mb-6 text-sm text-white/70">
          Failed to load team stats: {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {!data
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonBar key={i} />)
          : STATS_CONFIG.map((cfg) => {
              const { sea, avg, rank, teamCount } = data[cfg.key]
              return (
                <StatBar
                  key={cfg.key}
                  config={cfg}
                  sea={sea}
                  avg={avg}
                  rank={rank}
                  teamCount={teamCount}
                  animate={animate}
                />
              )
            })}
      </div>

      <p className="text-white/20 text-xs text-center mt-8">
        Data from NHL Stats API. The white marker (↕) on each bar represents the league average.
        Ice blue = above average, red = below average.
      </p>
    </div>
  )
}
