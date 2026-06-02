import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../utils/usePageTitle'
import daccordTracker from '../data/daccord-tracker.json'
import { db } from '../firebase.js'
import { doc, getDoc, updateDoc } from 'firebase/firestore'

// ─── helpers ──────────────────────────────────────────────────────────────────
async function loadStatsMap() {
  try {
    const res = await fetch('/cache/playerstats.json')
    if (res.ok) return res.json()
  } catch {}
  // Fall back: fetch roster then each player
  const rRes = await fetch('/nhl-api/v1/roster/SEA/20252026')
  if (!rRes.ok) return {}
  const roster = await rRes.json()
  const all = [...(roster.forwards ?? []), ...(roster.defensemen ?? []), ...(roster.goalies ?? [])]
  const entries = await Promise.all(
    all.map(async (p) => {
      try {
        const r = await fetch(`/nhl-api/v1/player/${p.id}/landing`)
        const d = r.ok ? await r.json() : null
        return d ? [p.id, d] : null
      } catch { return null }
    })
  )
  return Object.fromEntries(entries.filter(Boolean))
}

// ─── last game result ─────────────────────────────────────────────────────────
function LastGameCard() {
  const [game, setGame] = useState(null) // null = loading/none

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch('/nhl-api/v1/scoreboard/SEA/now')
        if (!r.ok) return
        const d = await r.json()
        const allGames = d.gamesByDate?.flatMap(gbd => gbd.games) ?? []
        const done = allGames.filter(g => g.gameState === 'OFF' || g.gameState === 'FINAL')
        if (done.length) setGame(done[done.length - 1])
      } catch {}
    }
    load()
  }, [])

  if (!game) return null

  const isHome = game.homeTeam?.abbrev === 'SEA'
  const sea  = isHome ? game.homeTeam : game.awayTeam
  const opp  = isHome ? game.awayTeam : game.homeTeam
  const won  = sea.score > opp.score
  const date = new Date(game.startTimeUTC).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="bg-slate rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/40 uppercase tracking-widest">Last Game</div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${won ? 'bg-ice/20 text-ice' : 'bg-kraken/20 text-red-400'}`}>
          {won ? 'W' : 'L'}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {opp.logo && <img src={opp.logo} alt={opp.abbrev} className="w-12 h-12 object-contain shrink-0" />}
        <div className="min-w-0">
          <div className="text-white/60 text-xs mb-0.5">{isHome ? 'vs' : '@'} {opp.abbrev} · {date}</div>
          <div className="text-2xl font-black text-white tracking-tight">
            {sea.score}–{opp.score}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── sub-components ───────────────────────────────────────────────────────────
function NextGameCard() {
  const [game, setGame] = useState(undefined)

  useEffect(() => {
    fetch('/nhl-api/v1/club-schedule/SEA/week/now')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const now = Date.now()
        const upcoming = (data?.games ?? []).find((g) => new Date(g.startTimeUTC) > now)
        setGame(upcoming ?? null)
      })
      .catch(() => setGame(null))
  }, [])

  return (
    <div className="bg-slate rounded-xl p-5 flex flex-col gap-3">
      <div className="text-xs text-white/40 uppercase tracking-widest">Next Game</div>
      {game === undefined ? (
        <p className="text-white/30 text-sm">Loading…</p>
      ) : game === null ? (
        <p className="text-2xl font-black text-white/40">Offseason</p>
      ) : (() => {
        const isHome = game.homeTeam?.abbrev === 'SEA'
        const opp = isHome ? game.awayTeam : game.homeTeam
        const start = new Date(game.startTimeUTC)
        return (
          <div className="flex items-center gap-4">
            {opp?.logo && <img src={opp.logo} alt={opp.abbrev} className="w-14 h-14 object-contain shrink-0" />}
            <div className="min-w-0">
              <div className="font-bold text-lg truncate">{isHome ? 'vs' : '@'} {opp?.placeName?.default} {opp?.commonName?.default}</div>
              <div className="text-sm text-white/50 mt-0.5">
                {start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                {' · '}
                {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function RecordCard() {
  const [record, setRecord] = useState(null)

  useEffect(() => {
    async function load() {
      let data = null
      try {
        const res = await fetch('/cache/standings.json')
        if (res.ok) { data = await res.json() }
      } catch {}
      if (!data) {
        const res = await fetch('/nhl-api/v1/standings/now')
        if (res.ok) data = await res.json()
      }
      const sea = data?.standings?.find((t) => t.teamAbbrev?.default === 'SEA')
      setRecord(sea ?? null)
    }
    load().catch(() => {})
  }, [])

  return (
    <div className="bg-slate rounded-xl p-5 flex flex-col gap-3">
      <div className="text-xs text-white/40 uppercase tracking-widest">2025–26 Record</div>
      {record ? (
        <div>
          <div className="text-4xl font-black text-white tracking-tight">
            {record.wins}–{record.losses}–{record.otLosses}
          </div>
          <div className="text-sm text-white/40 mt-1">{record.points} points</div>
        </div>
      ) : (
        <p className="text-white/30 text-sm">Loading…</p>
      )}
    </div>
  )
}

function TopScorerCard() {
  const [leader, setLeader] = useState(null)

  useEffect(() => {
    loadStatsMap().then((statsMap) => {
      const skaters = Object.values(statsMap).filter((p) => p.position !== 'G')
      const withPoints = skaters.map((p) => ({
        id: p.playerId ?? p.id,
        name: `${p.firstName?.default} ${p.lastName?.default}`,
        points: p.featuredStats?.regularSeason?.subSeason?.points ?? 0,
        headshot: p.headshot,
      })).sort((a, b) => b.points - a.points)
      setLeader(withPoints[0] ?? null)
    }).catch(() => {})
  }, [])

  return (
    <div className="bg-slate rounded-xl p-5 flex flex-col gap-3">
      <div className="text-xs text-white/40 uppercase tracking-widest">Top Scorer</div>
      {leader ? (
        <Link to={`/player/${leader.id}`} className="flex items-center gap-4 group">
          {leader.headshot && (
            <img src={leader.headshot} alt={leader.name} className="w-14 h-14 rounded-full object-cover border-2 border-ice shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-bold text-lg truncate group-hover:text-ice transition-colors">{leader.name}</div>
            <div className="text-3xl font-black text-ice">{leader.points} <span className="text-sm font-normal text-white/40">PTS</span></div>
          </div>
        </Link>
      ) : (
        <p className="text-white/30 text-sm">Loading…</p>
      )}
    </div>
  )
}

function TeamLeaders() {
  const [leaders, setLeaders] = useState(null)

  useEffect(() => {
    loadStatsMap().then((statsMap) => {
      const skaters = Object.values(statsMap)
        .filter((p) => p.position !== 'G')
        .map((p) => ({
          id: p.playerId ?? p.id,
          name: `${p.firstName?.default} ${p.lastName?.default}`,
          goals:   p.featuredStats?.regularSeason?.subSeason?.goals   ?? 0,
          assists: p.featuredStats?.regularSeason?.subSeason?.assists  ?? 0,
          points:  p.featuredStats?.regularSeason?.subSeason?.points   ?? 0,
          headshot: p.headshot,
        }))

      // Find top value and all players tied at that value
      const topGroup = (key) => {
        const sorted = [...skaters].sort((a, b) => b[key] - a[key])
        const best = sorted[0]
        if (!best) return null
        const tied = sorted.filter(p => p[key] === best[key])
        return { players: tied, value: best[key] }
      }

      setLeaders({
        goals:   topGroup('goals'),
        assists: topGroup('assists'),
        points:  topGroup('points'),
      })
    }).catch(() => {})
  }, [])

  if (!leaders) {
    return (
      <div className="mt-10 mb-10">
        <h2 className="text-xs text-white/40 uppercase tracking-widest mb-4">Team Leaders</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-slate rounded-xl p-5 animate-pulse h-24" />
          ))}
        </div>
      </div>
    )
  }

  const cats = [
    { key: 'points',  label: 'Points',  statLabel: 'PTS', color: 'text-ice' },
    { key: 'goals',   label: 'Goals',   statLabel: 'G',   color: 'text-kraken' },
    { key: 'assists', label: 'Assists', statLabel: 'A',   color: 'text-yellow-300' },
  ]

  return (
    <div className="mt-10 mb-10">
      <h2 className="text-xs text-white/40 uppercase tracking-widest mb-4">Team Leaders</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cats.map(({ key, label, statLabel, color }) => {
          const group = leaders[key]
          if (!group) return null
          const isTied = group.players.length > 1

          // For tied leaders show stacked mini layout; single leader gets full card
          return (
            <div key={key} className="bg-slate rounded-xl p-5">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
                {label}
                {isTied && <span className="bg-yellow-500/20 text-yellow-400 text-[10px] font-bold px-1.5 py-0.5 rounded">Tied</span>}
              </div>
              {isTied ? (
                <div className="flex flex-col gap-2">
                  {group.players.map(p => (
                    <Link key={p.id} to={`/player/${p.id}`} className="flex items-center gap-3 group">
                      {p.headshot && (
                        <img src={p.headshot} alt={p.name} className="w-10 h-10 rounded-full object-cover border-2 border-white/10 group-hover:border-ice transition-colors shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-white text-sm truncate group-hover:text-ice transition-colors">{p.name}</div>
                      </div>
                      <div className={`text-xl font-black shrink-0 ${color}`}>{group.value}</div>
                    </Link>
                  ))}
                </div>
              ) : (
                <Link to={`/player/${group.players[0].id}`} className="flex items-center gap-4 group">
                  {group.players[0].headshot && (
                    <img src={group.players[0].headshot} alt={group.players[0].name} className="w-14 h-14 rounded-full object-cover border-2 border-white/10 group-hover:border-ice transition-colors shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate group-hover:text-ice transition-colors">{group.players[0].name}</div>
                    <div className={`text-2xl font-black ${color}`}>{group.value} <span className="text-sm font-normal text-white/30">{statLabel}</span></div>
                  </div>
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── fan poll ─────────────────────────────────────────────────────────────────
const POLL_VOTED_KEY = 'kraken_poll_voted_current'

function FanPoll() {
  const [poll, setPoll] = useState(null)
  const [voted, setVoted] = useState(() => localStorage.getItem(POLL_VOTED_KEY))
  const [submitting, setSubmitting] = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    getDoc(doc(db, 'polls', 'current'))
      .then(snap => { if (snap.exists()) setPoll(snap.data()) })
      .catch(() => {})
  }, [])

  async function castVote() {
    if (!selected || voted || submitting || !poll) return
    setSubmitting(true)
    try {
      const ref = doc(db, 'polls', 'current')
      const snap = await getDoc(ref)
      const current = snap.data()
      await updateDoc(ref, {
        [`votes.${selected}`]: (current.votes?.[selected] ?? 0) + 1,
      })
      const updated = await getDoc(ref)
      setPoll(updated.data())
      localStorage.setItem(POLL_VOTED_KEY, selected)
      setVoted(selected)
    } catch (e) {
      console.error('Vote failed:', e)
    } finally {
      setSubmitting(false)
    }
  }

  if (!poll) return null

  const totalVotes = Object.values(poll.votes ?? {}).reduce((a, b) => a + b, 0)
  const showResults = !!voted

  return (
    <div className="mt-10 mb-2">
      <h2 className="text-xs text-white/40 uppercase tracking-widest mb-4">Fan Poll</h2>
      <div className="bg-slate rounded-xl p-5 sm:p-6 border border-white/5">
        <p className="text-white font-bold text-base mb-4">{poll.question}</p>

        <div className="flex flex-col gap-2">
          {poll.options.map((opt) => {
            const count = poll.votes?.[opt] ?? 0
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
            const isMyVote = voted === opt

            return (
              <button
                key={opt}
                onClick={() => !voted && setSelected(opt)}
                disabled={!!voted || submitting}
                className={`relative w-full text-left rounded-lg border overflow-hidden transition-all duration-200 ${
                  voted
                    ? 'cursor-default border-white/10'
                    : selected === opt
                    ? 'border-ice bg-ice/10 cursor-pointer'
                    : 'border-white/10 hover:border-ice/30 cursor-pointer'
                }`}
              >
                {/* Result fill bar */}
                {showResults && (
                  <div
                    className="absolute inset-0 transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: isMyVote
                        ? 'rgba(153,217,217,0.15)'
                        : 'rgba(255,255,255,0.04)',
                    }}
                  />
                )}
                <div className="relative flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    {/* Radio circle */}
                    {!showResults && (
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${
                        selected === opt ? 'border-ice bg-ice' : 'border-white/30'
                      }`} />
                    )}
                    {isMyVote && <span className="text-ice text-xs font-bold shrink-0">✓</span>}
                    <span className={`text-sm font-medium ${isMyVote ? 'text-ice' : 'text-white/80'}`}>{opt}</span>
                  </div>
                  {showResults && (
                    <span className={`text-sm font-bold shrink-0 ${isMyVote ? 'text-ice' : 'text-white/40'}`}>
                      {pct}%
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-white/30 text-xs">
            {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
            {voted && <span className="ml-2 text-ice/60">· You voted for {voted}</span>}
          </span>
          {!voted && (
            <button
              onClick={castVote}
              disabled={!selected || submitting}
              className="px-4 py-1.5 rounded-lg text-sm font-bold bg-ice text-navy disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {submitting ? 'Submitting…' : 'Vote'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── daccord tracker ──────────────────────────────────────────────────────────
const MAX_HYPE = 10

function daysSince(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function DaccordTracker() {
  const { goals, attempts } = daccordTracker
  const hasScored = goals > 0
  const attemptCount = attempts.length
  const lastAttempt = attempts[attempts.length - 1]
  const hypePercent = Math.min((attemptCount / MAX_HYPE) * 100, 100)
  const [expanded, setExpanded] = useState(false)
  const [panelHeight, setPanelHeight] = useState(0)
  const panelRef = useRef(null)
  const [witnessClicked, setWitnessClicked] = useState(false)

  // Confetti on celebration mode
  useEffect(() => {
    if (!hasScored) return
    import('canvas-confetti').then(({ default: confetti }) => {
      const end = Date.now() + 4000
      const frame = () => {
        confetti({ particleCount: 6, angle: 60,  spread: 55, origin: { x: 0 }, colors: ['#99D9D9','#001628','#E9072B'] })
        confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#99D9D9','#001628','#E9072B'] })
        if (Date.now() < end) requestAnimationFrame(frame)
      }
      frame()
    })
  }, [hasScored])

  // Animate expand panel
  useEffect(() => {
    if (panelRef.current) setPanelHeight(expanded ? panelRef.current.scrollHeight : 0)
  }, [expanded])

  const days = lastAttempt ? daysSince(lastAttempt.date) : null

  return (
    <div className={`relative rounded-xl overflow-hidden mt-10 mb-2 ${
      hasScored
        ? 'border-2 border-ice bg-ice/10'
        : 'border border-ice/20 bg-navy'
    }`}
      style={!hasScored ? {
        boxShadow: '0 0 0 1px rgba(153,217,217,0.15), 0 0 32px rgba(153,217,217,0.06)',
        animation: 'none',
      } : undefined}
    >
      {/* Animated ice-blue glow border effect */}
      {!hasScored && (
        <div className="absolute inset-0 pointer-events-none rounded-xl"
          style={{ boxShadow: 'inset 0 0 40px rgba(153,217,217,0.04)' }} />
      )}

      <div className="relative p-5 sm:p-7">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Headshot */}
          <div className="relative shrink-0">
            <div className={`absolute -inset-1 rounded-full ${hasScored ? 'bg-ice/40' : 'bg-ice/10'} blur-md`} />
            <img
              src="https://assets.nhle.com/mugs/nhl/20252026/SEA/8478916.png"
              alt="Joey Daccord"
              className={`relative w-20 h-20 rounded-full object-cover border-2 ${
                hasScored ? 'border-ice' : 'border-ice/30'
              }`}
              onError={(e) => { e.target.style.display = 'none' }}
            />
            {hasScored && <div className="absolute -top-1 -right-1 text-lg">🏒</div>}
          </div>

          {/* Main info */}
          <div className="flex-1 text-center sm:text-left">
            <div className="text-ice/60 text-xs uppercase tracking-widest font-bold mb-1">
              Joey Daccord · Goalie Goal Tracker
            </div>

            {hasScored ? (
              <>
                <div className="text-6xl font-black text-ice leading-none mb-1">{goals}</div>
                <div className="text-ice font-black text-lg">IT HAPPENED. THE DREAM IS REAL. 🚨</div>
                <div className="text-white/50 text-sm mt-0.5">Career Goalie Goals</div>
              </>
            ) : (
              <>
                <div className="text-7xl font-black leading-none mb-0.5 select-none"
                  style={{ color: 'rgba(153,217,217,0.12)' }}>0</div>
                <div className="text-white font-bold text-base">Career Goalie Goals</div>
                <div className="text-white/40 text-sm italic mt-0.5">He's due. We can feel it.</div>
              </>
            )}

            {/* Quick stats */}
            <div className="flex flex-wrap justify-center sm:justify-start gap-3 mt-3">
              <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-center">
                <div className="text-white font-bold text-base leading-none">{attemptCount}</div>
                <div className="text-white/40 text-xs mt-0.5">Attempts</div>
              </div>
              {days !== null && (
                <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-center">
                  <div className="text-white font-bold text-base leading-none">{days}</div>
                  <div className="text-white/40 text-xs mt-0.5">Days since last attempt</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hype meter */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-white/40 uppercase tracking-widest">Goalie Goal Hype Meter</span>
            <span className="text-xs text-ice/70 font-bold">{Math.round(hypePercent)}%</span>
          </div>
          <div className="h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${hypePercent}%`,
                background: 'linear-gradient(90deg, rgba(153,217,217,0.4), rgba(153,217,217,0.9))',
              }}
            />
          </div>
          <div className="text-right text-xs text-white/20 mt-1">{attemptCount} / {MAX_HYPE} attempts to max hype</div>
        </div>

        {/* Attempt timeline (collapsible) */}
        <div className="mt-4">
          <button
            onClick={() => setExpanded(o => !o)}
            className="flex items-center gap-2 text-ice/70 hover:text-ice text-sm font-semibold transition-colors w-full sm:w-auto"
          >
            <span className={`transition-transform duration-300 text-xs ${expanded ? 'rotate-90' : ''}`}>▶</span>
            {expanded ? 'Hide Attempts' : `View All Attempts (${attemptCount})`}
          </button>
          <div
            ref={panelRef}
            style={{ maxHeight: panelHeight, overflow: 'hidden', transition: 'max-height 0.35s ease' }}
          >
            <div className="mt-3 flex flex-col gap-2">
              {[...attempts].reverse().map((a, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-ice/70 text-xs font-bold">{new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span className="text-white/30 text-xs">vs {a.opponent}</span>
                  </div>
                  <p className="text-white/60 text-xs leading-relaxed">{a.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Witness History button */}
        <div className="mt-4">
          <button
            onClick={() => { setWitnessClicked(true); setTimeout(() => setWitnessClicked(false), 2000) }}
            className="px-5 py-2 rounded-lg text-sm font-black transition-all duration-200 border"
            style={{
              background: witnessClicked ? 'rgba(153,217,217,0.2)' : 'transparent',
              borderColor: 'rgba(153,217,217,0.4)',
              color: '#99D9D9',
              boxShadow: witnessClicked ? '0 0 16px rgba(153,217,217,0.3)' : 'none',
            }}
          >
            {witnessClicked ? '👀 You are ready.' : 'Witness History'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  usePageTitle('Home')
  return (
    <div>
      {/* Hero */}
      <div className="relative -mx-4 -mt-8 mb-10 bg-navy flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate/20 to-transparent pointer-events-none" />
        <img
          src="https://assets.nhle.com/logos/nhl/svg/SEA_light.svg"
          alt="Seattle Kraken"
          className="w-28 h-28 sm:w-36 sm:h-36 mb-6 drop-shadow-xl"
        />
        <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">Seattle Kraken</h1>
        <p className="text-white/50 mt-2 text-base sm:text-lg">2025–26 Season Hub</p>
        <div className="mt-6 w-24 h-0.5 bg-ice rounded-full" />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <LastGameCard />
        <NextGameCard />
        <RecordCard />
        <TopScorerCard />
      </div>

      {/* Team leaders */}
      <TeamLeaders />

      {/* Fan Poll */}
      <FanPoll />

      {/* Daccord Goal Tracker */}
      <DaccordTracker />

      {/* Nav shortcuts */}
      <div className="grid grid-cols-2 gap-4">
        <Link to="/roster" className="bg-slate hover:bg-slate/80 rounded-xl p-4 sm:p-6 flex items-center gap-3 sm:gap-4 transition-colors group">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-ice flex items-center justify-center shrink-0">
            <span className="text-navy font-black text-xs">23</span>
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white group-hover:text-ice transition-colors">Roster</div>
            <div className="text-xs text-white/40 mt-0.5 hidden sm:block">View all players</div>
          </div>
        </Link>
        <Link to="/game-preview" className="bg-slate hover:bg-slate/80 rounded-xl p-4 sm:p-6 flex items-center gap-3 sm:gap-4 transition-colors group">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-kraken flex items-center justify-center shrink-0">
            <span className="text-white font-black text-xs">▶</span>
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white group-hover:text-ice transition-colors">Game Preview</div>
            <div className="text-xs text-white/40 mt-0.5 hidden sm:block">Schedule &amp; offseason hub</div>
          </div>
        </Link>
      </div>
    </div>
  )
}
