import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { db } from '../firebase.js'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import nhl26ratings from '../data/nhl26ratings.json'
import acquisitions from '../data/acquisitions.json'
import espnrankings from '../data/espnrankings.json'
import prospects from '../data/prospects.json'
import playerstyles from '../data/playerstyles.json'
import contracts from '../data/contracts.json'
import awards from '../data/awards.json'
import { formatPosition } from '../utils/formatPosition'
import { usePageTitle } from '../utils/usePageTitle'
import { StatTip } from '../utils/Tooltip.jsx'
import { calcAge } from '../utils/calcAge'
import { CAPTAINS } from '../data/captains.js'

function awardStyle(award) {
  const a = award.toLowerCase()
  if (a.includes('stanley cup') && !a.includes('finalist')) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
  if (a.includes('olympic gold') || a.includes('world junior gold')) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
  if (a.includes('olympic silver')) return 'bg-white/10 text-white/70 border-white/20'
  if (a.includes('olympic bronze')) return 'bg-amber-700/20 text-amber-400 border-amber-600/40'
  if (a.includes('finalist')) return 'bg-white/5 text-white/40 border-white/10'
  return 'bg-ice/10 text-ice border-ice/30'
}

const formatAAV = (n) => '$' + n.toLocaleString('en-US')

function useCountUp(target, duration = 800) {
  const [display, setDisplay] = useState(null)
  const rafRef = useRef(null)

  useEffect(() => {
    // Only animate plain numbers
    const num = parseFloat(target)
    if (target == null || isNaN(num)) { setDisplay(target); return }

    const isFloat = String(target).includes('.')
    const decimals = isFloat ? (String(target).split('.')[1]?.length ?? 2) : 0
    const hasSign  = String(target).startsWith('+')
    const start    = performance.now()

    const tick = (now) => {
      const elapsed = now - start
      const t = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      const current = num * eased
      const formatted = isFloat
        ? current.toFixed(decimals)
        : Math.round(current)
      setDisplay(hasSign && formatted > 0 ? `+${formatted}` : formatted)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }

    setDisplay(hasSign ? '+0' : 0)
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return display
}

function StatBox({ label, value }) {
  const display = useCountUp(value)
  return (
    <div className="bg-navy rounded-lg p-4 text-center">
      <div className="text-2xl font-bold text-ice">{display ?? '—'}</div>
      <div className="text-xs text-white/50 uppercase tracking-wider mt-1"><StatTip stat={label}>{label}</StatTip></div>
    </div>
  )
}

function ShareButton() {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement('textarea')
      el.value = window.location.href
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleShare}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate text-white/60 hover:text-white text-sm font-medium transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        Share
      </button>
      {copied && (
        <div className="absolute right-0 top-full mt-2 bg-ice text-navy text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap animate-fade-in">
          Link copied! ✓
        </div>
      )}
    </div>
  )
}

export default function PlayerDetail() {
  const { id } = useParams()
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [edgeStats, setEdgeStats] = useState(null)

  useEffect(() => {
    async function load() {
      // Try cache first
      try {
        const res = await fetch('/cache/playerstats.json')
        if (res.ok) {
          const statsMap = await res.json()
          if (statsMap[id]) {
            console.log(`[PlayerDetail] Loaded player ${id} from cache`)
            setPlayer(statsMap[id])
            setLoading(false)
            return
          }
        }
      } catch {}
      // Fall back to live API
      console.log(`[PlayerDetail] Cache miss for ${id} — fetching live`)
      const res = await fetch(`/nhl-api/v1/player/${id}/landing`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPlayer(data)
      setLoading(false)
    }
    load().catch((err) => { setError(err.message); setLoading(false) })
  }, [id])

  useEffect(() => {
    fetch(`/nhl-api/v1/edge/skater-detail/${id}/20252026/2`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.skatingSpeed || data?.totalDistanceSkated) setEdgeStats(data)
      })
      .catch(() => {})
  }, [id])

  const playerName = player ? `${player.firstName?.default} ${player.lastName?.default}` : 'Player'
  const sub = player?.featuredStats?.regularSeason?.subSeason
  const statsDesc = player && sub
    ? `${playerName} · #${player.sweaterNumber} · ${sub.gamesPlayed ?? 0} GP · ${sub.goals ?? sub.wins ?? 0} ${player.position === 'G' ? 'W' : 'G'} · ${sub.points ?? sub.goalsAgainstAvg?.toFixed(2) ?? 0} ${player.position === 'G' ? 'GAA' : 'PTS'}`
    : `Seattle Kraken player profile for ${playerName}`
  usePageTitle(loading ? 'Loading…' : playerName, {
    description: statsDesc,
    image: player?.headshot ?? undefined,
  })

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-white/10 rounded w-28 mb-6" />
        <div className="bg-slate rounded-xl p-6 mb-6 flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-white/10 shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-7 bg-white/10 rounded w-48" />
            <div className="h-4 bg-white/10 rounded w-72" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-slate rounded-xl p-5 h-24" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-slate rounded-lg h-20" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !player) {
    return (
      <div className="text-center py-20">
        <p className="text-kraken text-lg mb-4">Failed to load player: {error}</p>
        <Link to="/roster" className="bg-kraken text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors">
          Back to Roster
        </Link>
      </div>
    )
  }

  const current = player.featuredStats?.regularSeason?.subSeason
  const isGoalie = player.position === 'G'
  const nhl26rating = nhl26ratings[id]
  const acquisition = acquisitions[id]
  const espnRank = espnrankings[id] ?? null
  const prospectTier = prospects[id] ?? null
  const playerStyle = playerstyles[id] ?? null
  const contract = contracts[id] ?? null
  const playerAwards = awards[id] ?? []
  const captainRole = CAPTAINS[id] ?? null
  const dynamicAge = calcAge(player.birthDate)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Link to="/roster" className="text-ice hover:text-white text-sm inline-flex items-center gap-1 transition-colors">
          ← Back to Roster
        </Link>
        <ShareButton />
      </div>

      <div className="bg-slate rounded-xl p-5 sm:p-6 mb-6 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
        <div className="relative shrink-0">
          {player.headshot ? (
            <img
              src={player.headshot}
              alt={`${player.firstName?.default} ${player.lastName?.default}`}
              className="w-24 h-24 rounded-full object-cover border-4 border-ice"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-navy flex items-center justify-center border-4 border-ice">
              <span className="text-3xl font-black text-ice">#{player.sweaterNumber}</span>
            </div>
          )}
          {captainRole && (
            <span className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-lg ${
              captainRole === 'C'
                ? 'bg-yellow-500 text-navy'
                : 'bg-white/80 text-slate'
            }`}>
              {captainRole}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">
            {player.firstName?.default} {player.lastName?.default}
          </h1>
          <div className="flex flex-wrap justify-center sm:justify-start gap-2 sm:gap-4 mt-2 text-sm text-white/60">
            <span className="text-ice font-semibold">#{player.sweaterNumber} · {formatPosition(player.position, id)}</span>
            {playerStyle && (
              <span className="bg-navy text-ice/80 text-xs font-medium px-2 py-0.5 rounded border border-ice/20">
                {playerStyle}
              </span>
            )}
            {player.heightInInches && (
              <span>{Math.floor(player.heightInInches / 12)}'{player.heightInInches % 12}" · {player.weightInPounds} lbs</span>
            )}
            {player.birthDate && (
              <span>Age {dynamicAge ?? '?'} · Born {player.birthDate}</span>
            )}
            {player.birthCity?.default && <span>{player.birthCity.default}{player.birthCountry ? `, ${player.birthCountry}` : ''}</span>}
          </div>
          {playerAwards.length > 0 && (
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
              {playerAwards.map((award) => (
                <span key={award} className={`text-xs font-semibold px-2 py-0.5 rounded border ${awardStyle(award)}`}>
                  {award}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {/* NHL 26 Rating */}
          <div className="bg-slate rounded-xl p-5 flex items-center gap-4">
            <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center shrink-0 ${
              nhl26rating >= 85 ? 'bg-ice text-navy' : nhl26rating ? 'bg-navy text-ice' : 'bg-navy/40 text-white/30'
            }`}>
              <span className="text-2xl font-black leading-none">{nhl26rating ?? '—'}</span>
              <span className="text-xs font-bold uppercase tracking-wide mt-0.5">OVR</span>
            </div>
            <div>
              <div className="text-xs text-white/40 uppercase tracking-wider">NHL 26 Rating</div>
              <div className="text-sm font-semibold mt-0.5">
                {isGoalie
                  ? (nhl26rating >= 90 ? 'Superstar' : nhl26rating >= 85 ? 'Starter' : nhl26rating >= 80 ? 'Fringe Starter' : nhl26rating >= 75 ? 'Backup' : nhl26rating ? 'AHL Starter' : 'Not Rated')
                  : (nhl26rating >= 90 ? 'Superstar' : nhl26rating >= 85 ? 'Elite' : nhl26rating >= 80 ? 'Top-6 / Top-4' : nhl26rating ? 'Depth' : 'Not Rated')
                }
              </div>
            </div>
            {prospectTier && (
              <span className={`mt-2 inline-block text-xs font-bold px-2 py-0.5 rounded ${
                prospectTier === 'Top Prospect' ? 'bg-ice text-navy' : 'bg-slate text-white'
              }`}>
                {prospectTier}
              </span>
            )}
          </div>

          {/* ESPN Top 200 */}
          <div className="bg-slate rounded-xl p-5 flex items-center gap-4">
            <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center shrink-0 ${
              espnRank !== null && espnRank <= 50 ? 'bg-kraken text-white' : 'bg-navy text-white/70'
            }`}>
              <span className="text-xl font-black leading-none">{espnRank !== null ? `#${espnRank}` : '<200'}</span>
            </div>
            <div>
              <div className="text-xs text-white/40 uppercase tracking-wider">ESPN Top 200</div>
              <div className="text-sm font-semibold mt-0.5">
                {espnRank !== null
                  ? espnRank <= 25 ? 'Top-25 Player' : espnRank <= 100 ? 'Top-100 Player' : 'Top-200 Player'
                  : 'Outside Top 200'}
              </div>
            </div>
          </div>

          {/* Acquisition */}
          <div className="bg-slate rounded-xl p-5">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Acquired by Seattle</div>
            {acquisition ? (
              <>
                <div className="text-sm font-bold text-ice">{acquisition.method}</div>
                <div className="text-sm text-white/60 mt-0.5">{acquisition.from}</div>
                <div className="text-xs text-white/30 mt-1">{acquisition.date}</div>
              </>
            ) : (
              <div className="text-sm text-white/30">No acquisition data</div>
            )}
          </div>
        </div>

      {current && (
        <>
          <h2 className="text-lg font-semibold text-white/70 uppercase tracking-wider mb-4">
            {player.featuredStats?.season?.toString().replace(/(\d{4})(\d{4})/, '$1–$2')} Season Stats
          </h2>
          {isGoalie ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBox label="GP"    value={current.gamesPlayed} />
              <StatBox label="Wins"  value={current.wins} />
              <StatBox label="Losses" value={current.losses} />
              <StatBox label="OT"    value={current.otLosses} />
              <StatBox label="GAA"   value={current.goalsAgainstAvg?.toFixed(2)} />
              <StatBox label="SV%"   value={current.savePctg?.toFixed(3)} />
              <StatBox label="SO"    value={current.shutouts} />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <StatBox label="GP"      value={current.gamesPlayed} />
              <StatBox label="Goals"   value={current.goals} />
              <StatBox label="Assists" value={current.assists} />
              <StatBox label="Points"  value={current.points} />
              <StatBox label="+/-"     value={current.plusMinus > 0 ? `+${current.plusMinus}` : current.plusMinus} />
              <StatBox label="PIM"     value={current.pim} />
              <StatBox label="PPG"     value={current.powerPlayGoals} />
              <StatBox label="SHG"     value={current.shorthandedGoals} />
            </div>
          )}
        </>
      )}

      {edgeStats && !isGoalie && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white/70 uppercase tracking-wider mb-4">
            NHL Edge Skating
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatBox
              label="Top Speed (mph)"
              value={edgeStats.skatingSpeed?.speedMax?.imperial?.toFixed(1)}
            />
            <StatBox
              label="Bursts 20+ mph"
              value={edgeStats.skatingSpeed?.burstsOver20?.value}
            />
            <StatBox
              label="Distance Skated (mi)"
              value={edgeStats.totalDistanceSkated?.imperial?.toFixed(1)}
            />
          </div>
        </div>
      )}

      {player.seasonTotals?.length > 0 && (() => {
        const nhlSeasons = player.seasonTotals.filter((s) => s.gameTypeId === 2 && s.leagueAbbrev === 'NHL')
        const totals = nhlSeasons.reduce((acc, s) => ({
          gamesPlayed:      (acc.gamesPlayed      ?? 0) + (s.gamesPlayed      ?? 0),
          goals:            (acc.goals            ?? 0) + (s.goals            ?? 0),
          assists:          (acc.assists          ?? 0) + (s.assists          ?? 0),
          points:           (acc.points           ?? 0) + (s.points           ?? 0),
          plusMinus:        (acc.plusMinus        ?? 0) + (s.plusMinus        ?? 0),
          pim:              (acc.pim              ?? 0) + (s.pim              ?? 0),
          powerPlayGoals:   (acc.powerPlayGoals   ?? 0) + (s.powerPlayGoals   ?? 0),
          shorthandedGoals: (acc.shorthandedGoals ?? 0) + (s.shorthandedGoals ?? 0),
          wins:             (acc.wins             ?? 0) + (s.wins             ?? 0),
          losses:           (acc.losses           ?? 0) + (s.losses           ?? 0),
          otLosses:         (acc.otLosses         ?? 0) + (s.otLosses         ?? 0),
          shutouts:         (acc.shutouts         ?? 0) + (s.shutouts         ?? 0),
        }), {})
        const gaaTotal = nhlSeasons.length > 0
          ? (nhlSeasons.reduce((sum, s) => sum + (s.goalsAgainstAvg ?? 0), 0) / nhlSeasons.filter(s => s.goalsAgainstAvg).length).toFixed(2)
          : '—'
        const svTotal = nhlSeasons.length > 0
          ? (nhlSeasons.reduce((sum, s) => sum + (s.savePctg ?? 0), 0) / nhlSeasons.filter(s => s.savePctg).length).toFixed(3)
          : '—'
        return nhlSeasons.length > 0 ? (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-white/70 uppercase tracking-wider mb-4">Career Totals <span className="text-white/30 text-sm font-normal normal-case">(NHL)</span></h2>
            {isGoalie ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <StatBox label="GP"  value={totals.gamesPlayed} />
                <StatBox label="W"   value={totals.wins} />
                <StatBox label="L"   value={totals.losses} />
                <StatBox label="OT"  value={totals.otLosses} />
                <StatBox label="GAA" value={gaaTotal} />
                <StatBox label="SV%" value={svTotal} />
                <StatBox label="SO"  value={totals.shutouts} />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                <StatBox label="GP"      value={totals.gamesPlayed} />
                <StatBox label="Goals"   value={totals.goals} />
                <StatBox label="Assists" value={totals.assists} />
                <StatBox label="Points"  value={totals.points} />
                <StatBox label="+/-"     value={totals.plusMinus > 0 ? `+${totals.plusMinus}` : totals.plusMinus} />
                <StatBox label="PIM"     value={totals.pim} />
                <StatBox label="PPG"     value={totals.powerPlayGoals} />
                <StatBox label="SHG"     value={totals.shorthandedGoals} />
              </div>
            )}
          </div>
        ) : null
      })()}

      {player.seasonTotals?.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white/70 uppercase tracking-wider mb-4">Career History</h2>
          <div className="bg-slate rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/50 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Season</th>
                  <th className="px-4 py-3 text-left">Team</th>
                  <th className="px-4 py-3 text-left">League</th>
                  <th className="px-4 py-3 text-center">GP</th>
                  {isGoalie ? (
                    <>
                      <th className="px-4 py-3 text-center">W</th>
                      <th className="px-4 py-3 text-center">L</th>
                      <th className="px-4 py-3 text-center">OT</th>
                      <th className="px-4 py-3 text-center">GAA</th>
                      <th className="px-4 py-3 text-center">SV%</th>
                      <th className="px-4 py-3 text-center">SO</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-center">G</th>
                      <th className="px-4 py-3 text-center">A</th>
                      <th className="px-4 py-3 text-center">PTS</th>
                      <th className="px-4 py-3 text-center">+/-</th>
                      <th className="px-4 py-3 text-center">PIM</th>
                      <th className="px-4 py-3 text-center">PPG</th>
                      <th className="px-4 py-3 text-center">SHG</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {[...player.seasonTotals]
                  .filter((s) => s.gameTypeId === 2)
                  .reverse()
                  .map((s, i) => (
                    <tr key={`${s.season}-${s.teamName?.default}-${i}`}
                      className={`border-b border-white/5 text-sm ${i % 2 === 0 ? '' : 'bg-navy/20'}`}>
                      <td className="px-4 py-2.5 text-white/60">
                        {s.season?.toString().replace(/(\d{4})(\d{4})/, '$1–$2')}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{s.teamName?.default}</td>
                      <td className="px-4 py-2.5 text-white/40 text-xs">{s.leagueAbbrev}</td>
                      <td className="px-4 py-2.5 text-center text-white/70">{s.gamesPlayed}</td>
                      {isGoalie ? (
                        <>
                          <td className="px-4 py-2.5 text-center text-white/70">{s.wins}</td>
                          <td className="px-4 py-2.5 text-center text-white/70">{s.losses}</td>
                          <td className="px-4 py-2.5 text-center text-white/70">{s.otLosses}</td>
                          <td className="px-4 py-2.5 text-center text-white/70">{s.goalsAgainstAvg?.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-ice">{s.savePctg?.toFixed(3)}</td>
                          <td className="px-4 py-2.5 text-center text-white/70">{s.shutouts}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2.5 text-center text-white/70">{s.goals}</td>
                          <td className="px-4 py-2.5 text-center text-white/70">{s.assists}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-ice">{s.points}</td>
                          <td className="px-4 py-2.5 text-center text-white/70">
                            {s.plusMinus > 0 ? `+${s.plusMinus}` : s.plusMinus}
                          </td>
                          <td className="px-4 py-2.5 text-center text-white/70">{s.pim}</td>
                          <td className="px-4 py-2.5 text-center text-white/70">{s.powerPlayGoals}</td>
                          <td className="px-4 py-2.5 text-center text-white/70">{s.shorthandedGoals}</td>
                        </>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {contract && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white/70 uppercase tracking-wider mb-4">Contract</h2>
          <div className="bg-slate rounded-xl p-5 flex flex-wrap items-center gap-6">
            <div>
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">AAV</div>
              <div className="text-2xl font-black text-ice">{formatAAV(contract.aav)}</div>
            </div>
            <div>
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Expires</div>
              <div className="text-2xl font-black text-white">{contract.expiryYear}</div>
            </div>
            <div>
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Status</div>
              <div className={`text-lg font-bold ${contract.expiryStatus === 'UFA' ? 'text-kraken' : 'text-ice'}`}>
                {contract.expiryStatus}
              </div>
            </div>
            {contract.clause && (
              <div>
                <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Clause</div>
                <span className="bg-navy border border-white/20 text-white/80 text-xs font-bold px-3 py-1 rounded-full">
                  {contract.clause}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Player Report Card */}
      <PlayerReportCard playerId={id} />
    </div>
  )
}

// ─── Player Report Card ───────────────────────────────────────────────────────
function PlayerReportCard({ playerId }) {
  const VOTED_KEY = `kraken_rating_${playerId}`
  const [ratingData, setRatingData] = useState(null)
  const [myVote, setMyVote]         = useState(() => localStorage.getItem(VOTED_KEY))
  const [hover, setHover]           = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'ratings', playerId))
      .then(snap => setRatingData(snap.exists() ? snap.data() : { total: 0, votes: 0 }))
      .catch(() => setRatingData({ total: 0, votes: 0 }))
  }, [playerId])

  async function submitRating(score) {
    if (myVote || submitting) return
    setSubmitting(true)
    try {
      const ref = doc(db, 'ratings', playerId)
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const d = snap.data()
        await updateDoc(ref, { total: d.total + score, votes: d.votes + 1 })
      } else {
        await setDoc(ref, { total: score, votes: 1 })
      }
      const updated = await getDoc(ref)
      setRatingData(updated.data())
      localStorage.setItem(VOTED_KEY, String(score))
      setMyVote(String(score))
    } catch (e) {
      console.error('Rating failed:', e)
    } finally {
      setSubmitting(false)
    }
  }

  const avg = ratingData && ratingData.votes > 0
    ? (ratingData.total / ratingData.votes).toFixed(1)
    : null

  return (
    <div className="mt-10 bg-slate rounded-xl p-5 sm:p-6 border border-white/5">
      <h2 className="text-xs text-white/40 uppercase tracking-widest mb-1">2025–26 Fan Report Card</h2>
      <p className="text-white/50 text-sm mb-5">
        {myVote ? `You rated this player ${myVote}/10` : 'Rate this player\'s season from 1 to 10'}
      </p>

      {/* Number picker */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const filled = hover ? n <= hover : myVote && n <= Number(myVote)
          return (
            <button
              key={n}
              onMouseEnter={() => !myVote && setHover(n)}
              onMouseLeave={() => !myVote && setHover(0)}
              onClick={() => submitRating(n)}
              disabled={!!myVote || submitting}
              className={`w-9 h-9 rounded-lg text-sm font-black transition-all duration-150 border ${
                filled
                  ? 'bg-ice text-navy border-ice scale-110'
                  : 'bg-navy/60 text-white/30 border-white/10 hover:border-ice/40 hover:text-white'
              } disabled:cursor-default disabled:scale-100`}
            >
              {n}
            </button>
          )
        })}
      </div>

      {/* Results */}
      {ratingData === null ? (
        <div className="h-10 bg-white/5 rounded animate-pulse w-32" />
      ) : (
        <div className="flex flex-wrap gap-6 items-end">
          {avg !== null ? (
            <>
              <div>
                <div className="text-4xl font-black text-ice leading-none">{avg}</div>
                <div className="text-white/40 text-xs mt-1">Community Average</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white leading-none">{ratingData.votes}</div>
                <div className="text-white/40 text-xs mt-1">{ratingData.votes === 1 ? 'Rating' : 'Ratings'}</div>
              </div>
              {/* Mini bar */}
              <div className="flex-1 min-w-[120px]">
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ice rounded-full transition-all duration-700"
                    style={{ width: `${(Number(avg) / 10) * 100}%` }}
                  />
                </div>
                <div className="text-white/20 text-xs mt-1">out of 10</div>
              </div>
            </>
          ) : (
            <p className="text-white/30 text-sm">No ratings yet — be the first!</p>
          )}
        </div>
      )}
    </div>
  )
}
