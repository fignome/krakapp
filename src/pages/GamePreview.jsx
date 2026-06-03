import { useState, useEffect } from 'react'
import freeagents from '../data/freeagents.json'
import draftprospects from '../data/draftprospects.json'
import { usePageTitle } from '../utils/usePageTitle'

const DRAFT_DATE = new Date('2026-06-26T00:00:00')
const FA_DATE    = new Date('2026-07-01T00:00:00')

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_GAME = {
  gameDate: '2026-10-10T19:00:00',
  homeTeam: 'SEA',
  awayTeam: 'EDM',
  venue:    'Climate Pledge Arena',
}

const MOCK_RECORDS = {
  SEA: { w: 34, l: 37, ot: 11 },
  EDM: { w: 41, l: 30, ot: 11 },
}

const MOCK_FORM = {
  SEA: ['L', 'W', 'L', 'W', 'W'],
  EDM: ['W', 'W', 'L', 'W', 'L'],
}

const MOCK_TEAM_STATS = {
  SEA: { pp: '20.1%', pk: '78.3%', gf: '2.87', ga: '3.12' },
  EDM: { pp: '27.4%', pk: '76.8%', gf: '3.45', ga: '3.28' },
}

const MOCK_OILERS = [
  { name: 'Connor McDavid', pos: 'C',  ovr: 98, gp: 82, g: 48,  a: 90, pts: 138, headshot: 'https://assets.nhle.com/mugs/nhl/20252026/EDM/8478402.png' },
  { name: 'Leon Draisaitl', pos: 'C',  ovr: 95, gp: 80, g: 42,  a: 65, pts: 107, headshot: 'https://assets.nhle.com/mugs/nhl/20252026/EDM/8477934.png' },
  { name: 'Zach Hyman',     pos: 'LW', ovr: 86, gp: 79, g: 31,  a: 28, pts: 59,  headshot: 'https://assets.nhle.com/mugs/nhl/20252026/EDM/8475786.png' },
  { name: 'Evan Bouchard',  pos: 'D',  ovr: 87, gp: 82, g: 18,  a: 52, pts: 70,  headshot: 'https://assets.nhle.com/mugs/nhl/20252026/EDM/8480039.png' },
  { name: 'Connor Ingram',  pos: 'G',  ovr: 83, gp: 32, gaa: 2.60, svPct: '.908', headshot: 'https://assets.nhle.com/mugs/nhl/20252026/EDM/8478444.png' },
]

const MOCK_GOALIE_EDM = {
  name: 'Connor Ingram',
  team: 'EDM',
  record: '20-8-4',
  gaa: '2.60',
  svPct: '.908',
  headshot: 'https://assets.nhle.com/mugs/nhl/20252026/EDM/8478444.png',
}

const KRAKEN_OVR = {
  'Jordan Eberle':       82,
  'Matty Beniers':       87,
  'Chandler Stephenson': 82,
  'Bobby McMann':        80,
  'Vince Dunn':          84,
}

const STORYLINES_KEY = 'kraken_gamepreview_storylines'
const STORYLINES_TTL = 24 * 60 * 60 * 1000

// ─── Shared utilities ─────────────────────────────────────────────────────────
function useCountdown(target) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(target))
  function getTimeLeft(t) {
    const diff = t - Date.now()
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
    return {
      days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours:   Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    }
  }
  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft(target)), 1000)
    return () => clearInterval(id)
  }, [target])
  return timeLeft
}

function CountdownUnit({ value, label }) {
  return (
    <div className="bg-navy rounded-xl p-5 text-center min-w-[80px]">
      <div className="text-4xl font-black text-ice tabular-nums">{String(value).padStart(2, '0')}</div>
      <div className="text-xs text-white/40 uppercase tracking-widest mt-1">{label}</div>
    </div>
  )
}

// ─── Form badge ───────────────────────────────────────────────────────────────
function FormBadge({ result }) {
  const styles = {
    W:   'bg-green-500/20 text-green-400 border-green-500/40',
    L:   'bg-kraken/20 text-red-400 border-kraken/40',
    OTL: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  }
  return (
    <span className={`text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border ${styles[result] ?? styles.L}`}>
      {result}
    </span>
  )
}

// ─── OVR badge ────────────────────────────────────────────────────────────────
function OvrBadge({ ovr }) {
  const color = ovr >= 90 ? 'bg-amber-400 text-navy' : ovr >= 85 ? 'bg-ice text-navy' : 'bg-white/15 text-white'
  return <span className={`text-[11px] font-black px-1.5 py-0.5 rounded ${color}`}>{ovr}</span>
}

// ─── Player row for head-to-head table ───────────────────────────────────────
function SkaterRow({ player, side }) {
  const isGoalie = player.pos === 'G'
  const isRight  = side === 'right'

  return (
    <div className={`flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-white/5 transition-colors ${isRight ? 'flex-row-reverse' : ''}`}>
      <img
        src={player.headshot}
        alt={player.name}
        className="w-9 h-9 rounded-full object-cover bg-white/10 shrink-0"
        onError={e => { e.target.style.display = 'none' }}
      />
      <div className={`flex-1 min-w-0 ${isRight ? 'text-right' : 'text-left'}`}>
        <div className={`flex items-center gap-1.5 ${isRight ? 'justify-end' : ''}`}>
          <span className="font-semibold text-sm text-white truncate">{player.name}</span>
          <OvrBadge ovr={player.ovr} />
        </div>
        <div className="text-[11px] text-white/40 mt-0.5">
          {isGoalie
            ? `${player.gp} GP · ${player.gaa} GAA · ${player.svPct} SV%`
            : `${player.gp} GP · ${player.g}G · ${player.a}A · ${player.pts} PTS`}
        </div>
      </div>
      <span className="text-[10px] font-bold text-white/30 uppercase shrink-0">{player.pos}</span>
    </div>
  )
}

// ─── Goalie card ──────────────────────────────────────────────────────────────
function GoalieCard({ goalie, accentClass, small = false }) {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1">
      <img
        src={goalie.headshot}
        alt={goalie.name}
        className={`${small ? 'w-11 h-11' : 'w-16 h-16'} rounded-full object-cover bg-white/10 ring-2 ring-white/10`}
        onError={e => { e.target.style.display = 'none' }}
      />
      <div className="text-center">
        <div className={`font-bold ${small ? 'text-xs' : 'text-sm'} ${accentClass}`}>{goalie.name}</div>
        <div className="text-[10px] text-white/50 mt-0.5">{goalie.record} · {goalie.gaa} GAA · {goalie.svPct} SV%</div>
      </div>
    </div>
  )
}

// ─── Collapsible card ─────────────────────────────────────────────────────────
function CollapsibleCard({ title, badge, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-slate rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-sm uppercase tracking-wider text-white/80">{title}</h2>
          {badge && <span className="text-xs text-white/30">{badge}</span>}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 text-white/40 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-white/10">{children}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Team stat row ────────────────────────────────────────────────────────────
function StatRow({ label, seaVal, edmVal }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <span className="font-bold text-sm text-ice w-16 text-right tabular-nums">{seaVal}</span>
      <span className="flex-1 text-center text-xs text-white/40 uppercase tracking-wide">{label}</span>
      <span className="font-bold text-sm text-amber-400 w-16 tabular-nums">{edmVal}</span>
    </div>
  )
}

// ─── Offseason Hub ────────────────────────────────────────────────────────────
function OffseasonHub() {
  const draft = useCountdown(DRAFT_DATE)
  const { days, hours, minutes, seconds } = useCountdown(FA_DATE)

  return (
    <div>
      <h1 className="text-3xl font-bold mb-1">Offseason Hub</h1>
      <p className="text-white/50 mb-8">The regular season is over. Here's what's coming next.</p>

      <div className="bg-slate rounded-xl p-6 mb-6">
        <h2 className="text-xs text-white/40 uppercase tracking-widest mb-4">Free Agency Opens In</h2>
        <div className="flex gap-3 flex-wrap">
          <CountdownUnit value={days}    label="Days" />
          <CountdownUnit value={hours}   label="Hours" />
          <CountdownUnit value={minutes} label="Minutes" />
          <CountdownUnit value={seconds} label="Seconds" />
        </div>
        <p className="text-white/30 text-xs mt-4">July 1, 2026 · 12:00 AM ET</p>
      </div>

      <div className="bg-slate rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-xs text-white/40 uppercase tracking-widest">NHL Draft Opens In</h2>
          <span className="text-xs text-white/30">Buffalo, NY</span>
        </div>
        <div className="flex gap-3 flex-wrap">
          <CountdownUnit value={draft.days}    label="Days" />
          <CountdownUnit value={draft.hours}   label="Hours" />
          <CountdownUnit value={draft.minutes} label="Minutes" />
          <CountdownUnit value={draft.seconds} label="Seconds" />
        </div>
        <p className="text-white/30 text-xs mt-4">June 26, 2026 · KeyBank Center</p>
      </div>

      <div className="bg-slate rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-white/10">
          <h3 className="font-bold text-sm uppercase tracking-wider">Kraken Draft Picks & Projected Selections</h3>
        </div>
        <ul className="divide-y divide-white/5">
          {draftprospects.picks.map((pick) => {
            const isTBD = pick.prospect === 'TBD'
            return (
              <li key={`${pick.round}-${pick.pick}`} className="flex items-start gap-5 px-5 py-4">
                <div className="shrink-0 text-center">
                  <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center ${isTBD ? 'bg-navy/60' : 'bg-ice'}`}>
                    <span className={`text-lg font-black leading-none ${isTBD ? 'text-white/20' : 'text-navy'}`}>#{pick.pick}</span>
                  </div>
                  <div className="text-xs text-white/30 mt-1">Rd {pick.round}</div>
                </div>
                <div className="flex-1 min-w-0">
                  {isTBD ? (
                    <div className="text-white/25 font-semibold italic">TBD</div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{pick.prospect}</span>
                        <span className="text-xs font-bold text-ice">{pick.position}</span>
                      </div>
                      <div className="text-xs text-white/40 mt-0.5">{pick.team} · {pick.league}</div>
                    </>
                  )}
                  {pick.note && (
                    <p className={`text-xs mt-1 ${isTBD ? 'text-white/25 italic' : 'text-white/50'}`}>{pick.note}</p>
                  )}
                  {pick.otherOptions?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="text-xs text-white/30 uppercase tracking-wider mb-2">Also in play:</div>
                      <ul className="space-y-1">
                        {pick.otherOptions.map((o) => (
                          <li key={o.name} className="flex items-center gap-2 text-xs">
                            <span className="text-white/60 font-medium">{o.name}</span>
                            <span className="text-ice/60 font-bold">{o.position}</span>
                            <span className="text-white/25">{o.team} · {o.league}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-slate rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
            <span className="w-2 h-2 rounded-full bg-kraken shrink-0" />
            <h3 className="font-bold text-sm uppercase tracking-wider">Unrestricted Free Agents</h3>
          </div>
          <ul className="divide-y divide-white/5">
            {freeagents.UFAs.map((p) => (
              <li key={p.name} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="font-semibold text-white">{p.name}</span>
                  <span className="ml-2 text-xs font-bold text-kraken">{p.position}</span>
                </div>
                <span className="text-white/40 text-sm">Age {p.age}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-slate rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
            <span className="w-2 h-2 rounded-full bg-ice shrink-0" />
            <h3 className="font-bold text-sm uppercase tracking-wider">Restricted Free Agents</h3>
          </div>
          <ul className="divide-y divide-white/5">
            {freeagents.RFAs.map((p) => (
              <li key={p.name} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="font-semibold text-white">{p.name}</span>
                  <span className="ml-2 text-xs font-bold text-ice">{p.position}</span>
                </div>
                <span className="text-white/40 text-sm">Age {p.age}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ─── Mock Game Preview ────────────────────────────────────────────────────────
function MockGamePreview({ krakenPlayers, daccord }) {
  const gameDate = new Date(MOCK_GAME.gameDate)
  const dateStr  = gameDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const timeStr  = gameDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  const [storylines, setStorylines] = useState([])
  const [storylinesLoading, setStorylinesLoading] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORYLINES_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.ts && Date.now() - parsed.ts < STORYLINES_TTL && Array.isArray(parsed.data)) {
          setStorylines(parsed.data)
          setStorylinesLoading(false)
          return
        }
      }
    } catch {}

    fetch('/api/gamepreview-storylines')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const items = data.storylines ?? []
        setStorylines(items)
        localStorage.setItem(STORYLINES_KEY, JSON.stringify({ data: items, ts: Date.now() }))
      })
      .catch(() => {})
      .finally(() => setStorylinesLoading(false))
  }, [])

  const seaGoalie = daccord
    ? {
        name: daccord.name,
        team: 'SEA',
        record: `${daccord.wins}-${daccord.losses}-${daccord.otLosses}`,
        gaa: daccord.gaa.toFixed(2),
        svPct: `.${String(Math.round(daccord.savePct * 1000)).padStart(3, '0')}`,
        headshot: daccord.headshot,
      }
    : null

  const beniers  = krakenPlayers.find(p => p.name === 'Matty Beniers')
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="space-y-5">
      {/* Warning banner */}
      <div className="bg-yellow-400 text-black font-black text-xs text-center py-1.5 px-4 rounded-xl flex items-center justify-center gap-2">
        <span>⚠</span>
        <span>PREVIEW MODE — Remove before launch</span>
        <span>⚠</span>
      </div>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-0.5">Game Preview</h1>
          <p className="text-white/50 text-xs">{dateStr} · {timeStr} · {MOCK_GAME.venue}</p>
        </div>
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 uppercase tracking-wider">
          Mock Data
        </span>
      </div>

      {/* Single unified card */}
      <div className="bg-slate rounded-xl overflow-hidden">

        {/* ── Top bar ── */}
        <div className="bg-navy/60 px-4 py-2 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-ice text-navy text-[10px] font-black px-1.5 py-0.5 rounded uppercase">Home</span>
            <span className="text-white/50 text-xs">{dateStr} · {timeStr}</span>
          </div>
          <span className="text-white/40 text-[10px]">{MOCK_GAME.venue}</span>
        </div>

        {/* ── Teams ── */}
        <div className="px-4 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex flex-col items-center gap-1.5">
            <img src="https://assets.nhle.com/logos/nhl/svg/SEA_light.svg" alt="Seattle Kraken" className="w-14 h-14 object-contain" />
            <div className="text-center">
              <div className="font-black text-sm text-white">Seattle Kraken</div>
              <div className="text-sm font-black text-ice">{MOCK_RECORDS.SEA.w}–{MOCK_RECORDS.SEA.l}–{MOCK_RECORDS.SEA.ot}</div>
              <div className="flex gap-0.5 justify-center mt-1">
                {MOCK_FORM.SEA.map((r, i) => <FormBadge key={i} result={r} />)}
              </div>
            </div>
          </div>
          <div className="text-xl font-black text-white/20 text-center">VS</div>
          <div className="flex flex-col items-center gap-1.5">
            <img src="https://assets.nhle.com/logos/nhl/svg/EDM_light.svg" alt="Edmonton Oilers" className="w-14 h-14 object-contain" />
            <div className="text-center">
              <div className="font-black text-sm text-white">Edmonton Oilers</div>
              <div className="text-sm font-black text-amber-400">{MOCK_RECORDS.EDM.w}–{MOCK_RECORDS.EDM.l}–{MOCK_RECORDS.EDM.ot}</div>
              <div className="flex gap-0.5 justify-center mt-1">
                {MOCK_FORM.EDM.map((r, i) => <FormBadge key={i} result={r} />)}
              </div>
            </div>
          </div>
        </div>

        {/* ── Starting goalies ── */}
        <div className="border-t border-white/10 px-4 py-2.5">
          <div className="text-[10px] text-white/30 uppercase tracking-widest text-center mb-2">Starting Goalies</div>
          <div className="flex items-start justify-around gap-3">
            {seaGoalie && <GoalieCard goalie={seaGoalie} accentClass="text-ice" small />}
            <GoalieCard goalie={MOCK_GOALIE_EDM} accentClass="text-amber-400" small />
          </div>
        </div>

        {/* ── Key matchup ── */}
        {beniers && (
          <div className="border-t border-white/10 px-4 py-2.5">
            <div className="text-[10px] text-white/30 uppercase tracking-widest text-center mb-2">Key Matchup</div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="flex flex-col items-center gap-1.5 text-center">
                <img src={beniers.headshot} alt={beniers.name} className="w-12 h-12 rounded-full object-cover bg-white/10 ring-2 ring-ice/40" onError={e => { e.target.style.display='none' }} />
                <div>
                  <div className="font-black text-white text-xs">{beniers.name}</div>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <OvrBadge ovr={beniers.ovr} />
                    <span className="text-[9px] font-bold text-white/40 uppercase">{beniers.pos} · SEA</span>
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">{beniers.gp} GP · {beniers.g}G · {beniers.a}A · {beniers.pts} PTS</div>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="text-[10px] font-black text-white/20 uppercase tracking-widest">vs</div>
                <div className="w-px h-8 bg-white/10" />
              </div>
              <div className="flex flex-col items-center gap-1.5 text-center">
                <img src={MOCK_OILERS[0].headshot} alt={MOCK_OILERS[0].name} className="w-12 h-12 rounded-full object-cover bg-white/10 ring-2 ring-amber-400/40" onError={e => { e.target.style.display='none' }} />
                <div>
                  <div className="font-black text-white text-xs">{MOCK_OILERS[0].name}</div>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <OvrBadge ovr={MOCK_OILERS[0].ovr} />
                    <span className="text-[9px] font-bold text-white/40 uppercase">{MOCK_OILERS[0].pos} · EDM</span>
                  </div>
                  <div className="text-[10px] text-white/50 mt-1">{MOCK_OILERS[0].gp} GP · {MOCK_OILERS[0].g}G · {MOCK_OILERS[0].a}A · {MOCK_OILERS[0].pts} PTS</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Expandable section ── */}
        <div
          className="grid transition-[grid-template-rows] duration-500 ease-in-out"
          style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">

            {/* Head-to-head */}
            <div className="border-t border-white/10">
              <div className="text-xs text-white/30 uppercase tracking-widest text-center py-3">Head-to-Head: Top Players</div>
              <div className="grid grid-cols-2 divide-x divide-white/10 border-y border-white/10">
                <div className="flex items-center gap-2 px-4 py-2">
                  <img src="https://assets.nhle.com/logos/nhl/svg/SEA_light.svg" alt="SEA" className="w-5 h-5 object-contain" />
                  <span className="text-xs font-bold text-ice uppercase tracking-wider">Kraken</span>
                </div>
                <div className="flex items-center justify-end gap-2 px-4 py-2">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Oilers</span>
                  <img src="https://assets.nhle.com/logos/nhl/svg/EDM_light.svg" alt="EDM" className="w-5 h-5 object-contain" />
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-white/10">
                <div className="px-2 py-2 space-y-0.5">
                  {krakenPlayers.map(p => <SkaterRow key={p.name} player={p} side="left" />)}
                </div>
                <div className="px-2 py-2 space-y-0.5">
                  {MOCK_OILERS.map(p => <SkaterRow key={p.name} player={p} side="right" />)}
                </div>
              </div>
            </div>

            {/* Team stats */}
            <div className="border-t border-white/10">
              <div className="px-5 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <span className="text-xs font-bold text-ice uppercase tracking-wider">SEA</span>
                <span className="text-xs uppercase tracking-widest text-white/30 text-center">Team Stats</span>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider text-right">EDM</span>
              </div>
              <div className="px-5 pb-3">
                <StatRow label="Power Play %"         seaVal={MOCK_TEAM_STATS.SEA.pp} edmVal={MOCK_TEAM_STATS.EDM.pp} />
                <StatRow label="Penalty Kill %"       seaVal={MOCK_TEAM_STATS.SEA.pk} edmVal={MOCK_TEAM_STATS.EDM.pk} />
                <StatRow label="Goals / Game"         seaVal={MOCK_TEAM_STATS.SEA.gf} edmVal={MOCK_TEAM_STATS.EDM.gf} />
                <StatRow label="Goals Against / Game" seaVal={MOCK_TEAM_STATS.SEA.ga} edmVal={MOCK_TEAM_STATS.EDM.ga} />
              </div>
            </div>

            {/* Storylines */}
            <div className="border-t border-white/10">
              <div className="text-xs text-white/30 uppercase tracking-widest text-center py-3">Game Storylines</div>
              {storylinesLoading ? (
                <div className="px-5 pb-5 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse space-y-2">
                      <div className="h-4 bg-white/10 rounded w-1/3" />
                      <div className="h-3 bg-white/10 rounded w-full" />
                      <div className="h-3 bg-white/10 rounded w-5/6" />
                    </div>
                  ))}
                </div>
              ) : storylines.length === 0 ? (
                <p className="px-5 pb-5 text-white/30 text-sm">Storylines unavailable.</p>
              ) : (
                <ul className="divide-y divide-white/5">
                  {storylines.map((s, i) => (
                    <li key={i} className="px-5 py-4">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-ice/15 border border-ice/25 flex items-center justify-center text-[10px] font-black text-ice">{i + 1}</span>
                        <div>
                          <div className="font-bold text-white text-sm mb-1">{s.headline}</div>
                          <p className="text-white/55 text-sm leading-relaxed">{s.blurb}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Show Less button */}
            <div className="border-t border-white/10 px-5 py-4">
              <button
                onClick={() => setExpanded(false)}
                className="w-full flex items-center justify-center gap-2 text-sm font-bold text-white/50 hover:text-white transition-colors"
              >
                Show Less
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

          </div>
        </div>

        {/* ── Show More button ── */}
        {!expanded && (
          <div className="border-t border-white/10 px-5 py-4">
            <button
              onClick={() => setExpanded(true)}
              className="w-full flex items-center justify-center gap-2 text-sm font-bold text-white/50 hover:text-white transition-colors"
            >
              Show More
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function GamePreview() {
  usePageTitle('Game Preview')
  const [games,          setGames]   = useState(null)
  const [loading,        setLoading] = useState(true)
  const [krakenPlayers,  setKraken]  = useState([])
  const [daccord,        setDaccord] = useState(null)

  useEffect(() => {
    if (import.meta.env.VITE_MOCK_MODE === 'true') {
      fetch('/cache/playerstats.json')
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
          const all = Object.values(data).filter(p => p.currentTeamAbbrev === 'SEA')

          const skaters = all
            .filter(p => p.position !== 'G')
            .map(p => ({
              name:     `${p.firstName.default} ${p.lastName.default}`,
              pos:      p.position,
              ovr:      KRAKEN_OVR[`${p.firstName.default} ${p.lastName.default}`] ?? 79,
              gp:       p.featuredStats?.regularSeason?.subSeason?.gamesPlayed ?? 0,
              g:        p.featuredStats?.regularSeason?.subSeason?.goals ?? 0,
              a:        p.featuredStats?.regularSeason?.subSeason?.assists ?? 0,
              pts:      p.featuredStats?.regularSeason?.subSeason?.points ?? 0,
              headshot: p.headshot,
            }))
            .sort((a, b) => b.pts - a.pts)
            .slice(0, 5)

          const joey = all.find(p => p.lastName?.default === 'Daccord')
          if (joey) {
            setDaccord({
              name:     `${joey.firstName.default} ${joey.lastName.default}`,
              wins:     joey.featuredStats?.regularSeason?.subSeason?.wins ?? 0,
              losses:   joey.featuredStats?.regularSeason?.subSeason?.losses ?? 0,
              otLosses: joey.featuredStats?.regularSeason?.subSeason?.otLosses ?? 0,
              gaa:      joey.featuredStats?.regularSeason?.subSeason?.goalsAgainstAvg ?? 0,
              savePct:  joey.featuredStats?.regularSeason?.subSeason?.savePctg ?? 0,
              headshot: joey.headshot,
            })
          }

          setKraken(skaters)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
      return
    }

    fetch('/nhl-api/v1/club-schedule-season/SEA/now')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        const now      = Date.now()
        const upcoming = (data.games ?? []).filter(g => new Date(g.startTimeUTC) > now)
        setGames(upcoming.length > 0 ? upcoming.slice(0, 3) : [])
        setLoading(false)
      })
      .catch(() => {
        setGames([])
        setLoading(false)
      })
  }, [])

  if (loading) return <p className="text-white/50 py-20 text-center">Loading…</p>

  if (import.meta.env.VITE_MOCK_MODE === 'true') return <MockGamePreview krakenPlayers={krakenPlayers} daccord={daccord} />

  if (!games || games.length === 0) return <OffseasonHub />

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Game Previews</h1>
      <p className="text-white/50 mb-6">Upcoming matchups and what to watch for.</p>
      <div className="space-y-5">
        {games.map((game) => {
          const home   = game.homeTeam
          const away   = game.awayTeam
          const isHome = home?.abbrev === 'SEA'
          const opp    = isHome ? away : home
          const start  = new Date(game.startTimeUTC)
          return (
            <div key={game.id} className="bg-slate rounded-xl overflow-hidden">
              <div className="flex items-center justify-between bg-navy/60 px-6 py-3">
                <div className="flex items-center gap-3">
                  {isHome
                    ? <span className="bg-ice text-navy text-xs font-black px-2 py-0.5 rounded uppercase">Home</span>
                    : <span className="bg-white/10 text-white/60 text-xs font-black px-2 py-0.5 rounded uppercase">Away</span>}
                  <span className="text-white/60 text-sm">
                    {start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' · '}
                    {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
                  </span>
                </div>
                <span className="text-white/40 text-xs">{game.venue?.default}</span>
              </div>
              <div className="px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-ice flex items-center justify-center">
                    <span className="text-navy font-black text-sm">SEA</span>
                  </div>
                  <div className="font-bold text-lg">Seattle Kraken</div>
                </div>
                <div className="text-2xl font-black text-white/20">VS</div>
                <div className="flex items-center gap-4 flex-row-reverse">
                  <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-white font-black text-sm">{opp?.abbrev}</span>
                  </div>
                  <div className="font-bold text-lg text-right">{opp?.placeName?.default} {opp?.commonName?.default}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
