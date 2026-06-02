import { useState, useMemo, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import prospects from '../data/prospects-pool.json'
import { usePageTitle } from '../utils/usePageTitle'

const FLAG = {
  Finland: '🇫🇮',
  Czechia: '🇨🇿',
  USA: '🇺🇸',
  Canada: '🇨🇦',
  Denmark: '🇩🇰',
  Sweden: '🇸🇪',
}

const POSITIONS = ['All', 'C', 'LW', 'RW', 'LD', 'RD', 'G']
const TIERS = ['All', 'Top Prospect', 'Prospect']

const SORT_OPTIONS = [
  { value: 'pick',     label: 'Draft Pick' },
  { value: 'age-asc',  label: 'Age (youngest first)' },
  { value: 'age-desc', label: 'Age (oldest first)' },
  { value: 'draftYear',label: 'Draft Year (most recent first)' },
  { value: 'name',     label: 'Name (A–Z)' },
]

const LEAGUES      = ['All', ...Array.from(new Set(prospects.map((p) => p.league))).sort()]
const NATIONALITIES= ['All', ...Array.from(new Set(prospects.map((p) => p.nationality))).sort()]
const ALL_AGES     = prospects.map((p) => p.age)
const MIN_AGE      = Math.min(...ALL_AGES)
const MAX_AGE      = Math.max(...ALL_AGES)

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ─── filter chips ────────────────────────────────────────────────────────────
function FilterChips({ label, options, value, onChange }) {
  return (
    <div>
      <span className="text-white/40 text-xs uppercase tracking-widest block mb-2">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              value === opt ? 'bg-ice text-navy' : 'bg-slate text-white/70 hover:text-white'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── age range slider ─────────────────────────────────────────────────────────
function AgeRangeSlider({ min, max, value, onChange }) {
  const [lo, hi] = value
  const pct = (v) => ((v - min) / (max - min)) * 100
  return (
    <div>
      <span className="text-white/40 text-xs uppercase tracking-widest block mb-2">
        Age Range <span className="text-white/60 normal-case tracking-normal font-semibold">{lo}–{hi}</span>
      </span>
      <div className="relative h-8 flex items-center w-48">
        <div className="absolute left-0 right-0 h-1 bg-white/10 rounded-full" />
        <div className="absolute h-1 bg-ice rounded-full" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        <input type="range" min={min} max={max} value={lo}
          onChange={(e) => { const v = Number(e.target.value); if (v <= hi) onChange([v, hi]) }}
          className="absolute w-full appearance-none bg-transparent cursor-pointer range-thumb" />
        <input type="range" min={min} max={max} value={hi}
          onChange={(e) => { const v = Number(e.target.value); if (v >= lo) onChange([lo, v]) }}
          className="absolute w-full appearance-none bg-transparent cursor-pointer range-thumb" />
      </div>
    </div>
  )
}

// ─── stats row for expanded panel ────────────────────────────────────────────
function StatPill({ label, value }) {
  return (
    <div className="bg-navy/70 rounded-lg px-3 py-2 text-center min-w-[52px]">
      <div className="text-ice font-bold text-base leading-none">{value ?? '—'}</div>
      <div className="text-white/40 text-xs mt-0.5">{label}</div>
    </div>
  )
}

// ─── expanded detail panel ───────────────────────────────────────────────────
function ExpandedPanel({ prospect }) {
  const [stats, setStats] = useState(null)   // null=loading, false=no data, object=data
  const isGoalie = prospect.position === 'G'

  useEffect(() => {
    if (!prospect.playerId) { setStats(false); return }
    setStats(null)
    fetch(`/nhl-api/v1/player/${prospect.playerId}/landing`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const sub = data?.featuredStats?.regularSeason?.subSeason
        setStats(sub ?? false)
      })
      .catch(() => setStats(false))
  }, [prospect.playerId])

  const draftLine = prospect.draftYear === null
    ? 'Undrafted — Signed as Free Agent'
    : `${prospect.draftYear} NHL Draft · ${ordinal(prospect.draftRound)} Round · Pick #${prospect.draftPick}`

  return (
    <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-4">
      {/* Nationality + draft detail */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div>
          <div className="text-white/40 text-xs uppercase tracking-wider mb-1">Nationality</div>
          <div className="font-semibold text-white">{FLAG[prospect.nationality] ?? ''} {prospect.nationality}</div>
        </div>
        <div className="flex-1">
          <div className="text-white/40 text-xs uppercase tracking-wider mb-1">Draft</div>
          <div className="font-semibold text-white">{draftLine}</div>
        </div>
      </div>

      {/* Scouting bio */}
      <div>
        <div className="text-white/40 text-xs uppercase tracking-wider mb-1">Scouting</div>
        <p className="text-white/75 text-sm leading-relaxed">{prospect.bio}</p>
      </div>

      {/* Stats */}
      <div>
        <div className="text-white/40 text-xs uppercase tracking-wider mb-2">Current Season Stats</div>
        {stats === null && (
          <div className="flex gap-2 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white/10 rounded-lg h-12 w-12" />
            ))}
          </div>
        )}
        {stats === false && (
          <p className="text-white/30 text-xs">No NHL stats available this season</p>
        )}
        {stats && !isGoalie && (
          <div className="flex flex-wrap gap-2">
            <StatPill label="GP"  value={stats.gamesPlayed} />
            <StatPill label="G"   value={stats.goals} />
            <StatPill label="A"   value={stats.assists} />
            <StatPill label="PTS" value={stats.points} />
            <StatPill label="+/-" value={stats.plusMinus > 0 ? `+${stats.plusMinus}` : stats.plusMinus} />
            <StatPill label="PIM" value={stats.pim} />
          </div>
        )}
        {stats && isGoalie && (
          <div className="flex flex-wrap gap-2">
            <StatPill label="GP"  value={stats.gamesPlayed} />
            <StatPill label="W"   value={stats.wins} />
            <StatPill label="L"   value={stats.losses} />
            <StatPill label="GAA" value={stats.goalsAgainstAvg?.toFixed(2)} />
            <StatPill label="SV%" value={stats.savePctg?.toFixed(3)} />
            <StatPill label="SO"  value={stats.shutouts} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── prospect card ────────────────────────────────────────────────────────────
function ProspectCard({ prospect, isOpen, onToggle }) {
  const panelRef = useRef(null)
  const [panelHeight, setPanelHeight] = useState(0)

  useEffect(() => {
    if (panelRef.current) setPanelHeight(isOpen ? panelRef.current.scrollHeight : 0)
  }, [isOpen])

  // re-measure if content changes (stats load)
  const remeasure = () => {
    if (panelRef.current && isOpen) setPanelHeight(panelRef.current.scrollHeight)
  }

  return (
    <div
      onClick={onToggle}
      className={`bg-slate rounded-xl p-5 flex flex-col gap-3 border transition-all duration-200 cursor-pointer
        ${isOpen
          ? 'border-ice/40 brightness-110 scale-[1.01]'
          : 'border-white/5 hover:border-ice/30 hover:brightness-110 hover:scale-[1.01]'
        }`}
    >
      {/* ── collapsed header (always visible) ── */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-white font-bold text-lg leading-tight">{prospect.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-ice font-bold text-sm">{prospect.position}</span>
            <span className="text-white/30 text-xs">·</span>
            <span className="text-white/60 text-sm">Age {prospect.age}</span>
            <span className="text-white/30 text-xs">·</span>
            <span className="text-sm" title={prospect.nationality}>{FLAG[prospect.nationality] ?? ''}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            prospect.tier === 'Top Prospect' ? 'bg-ice/20 text-ice' : 'bg-slate border border-white/20 text-white/60'
          }`}>
            {prospect.tier}
          </span>
          <span className={`text-white/40 transition-transform duration-300 text-xs ${isOpen ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </div>

      {/* team / league */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-white/80 font-medium">{prospect.team}</span>
        <span className="text-white/30">·</span>
        <span className="text-white/50">{prospect.league}</span>
      </div>

      {/* draft strip */}
      <div className="bg-navy/60 rounded-lg px-4 py-2.5 flex items-center gap-3">
        {prospect.draftYear === null ? (
          <div>
            <div className="text-white/70 font-semibold text-sm">Undrafted</div>
            <div className="text-white/40 text-xs">Signed as Free Agent</div>
          </div>
        ) : (
          <>
            <div className="text-center">
              <div className="text-ice font-black text-xl leading-none">{prospect.draftYear}</div>
              <div className="text-white/40 text-xs mt-0.5">Draft</div>
            </div>
            <div className="w-px h-7 bg-white/10" />
            <div className="text-center">
              <div className="text-white font-bold text-sm">{ordinal(prospect.draftRound)} Round</div>
              <div className="text-white/40 text-xs">Pick #{prospect.draftPick}</div>
            </div>
          </>
        )}
      </div>

      {/* ── animated expand panel ── */}
      <div
        ref={panelRef}
        style={{ maxHeight: panelHeight, overflow: 'hidden', transition: 'max-height 0.35s ease' }}
        onTransitionEnd={remeasure}
      >
        {isOpen && <ExpandedPanel prospect={prospect} />}
      </div>

      {/* click hint */}
      {!isOpen && (
        <div className="text-white/25 text-xs text-right -mt-1">Click to expand</div>
      )}
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────
export default function ProspectPool() {
  usePageTitle('Prospect Pool')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [posFilter,   setPosFilter]   = useState('All')
  const [tierFilter,  setTierFilter]  = useState('All')
  const [leagueFilter,setLeagueFilter]= useState('All')
  const [natFilter,   setNatFilter]   = useState('All')
  const [sortBy,      setSortBy]      = useState('pick')
  const [ageRange,    setAgeRange]    = useState([MIN_AGE, MAX_AGE])
  const [openName,    setOpenName]    = useState(null)   // name of expanded card

  const results = useMemo(() => {
    const filtered = prospects.filter((p) => {
      if (posFilter    !== 'All' && p.position    !== posFilter)    return false
      if (tierFilter   !== 'All' && p.tier        !== tierFilter)   return false
      if (leagueFilter !== 'All' && p.league      !== leagueFilter) return false
      if (natFilter    !== 'All' && p.nationality !== natFilter)    return false
      if (p.age < ageRange[0] || p.age > ageRange[1])              return false
      return true
    })
    return [...filtered].sort((a, b) => {
      if (sortBy === 'pick') {
        const aVal = a.draftPick != null ? a.draftYear * 1000 + a.draftPick : Infinity
        const bVal = b.draftPick != null ? b.draftYear * 1000 + b.draftPick : Infinity
        return aVal - bVal
      }
      if (sortBy === 'age-asc')  return a.age - b.age
      if (sortBy === 'age-desc') return b.age - a.age
      if (sortBy === 'draftYear') return (b.draftYear ?? 0) - (a.draftYear ?? 0)
      if (sortBy === 'name')     return a.name.localeCompare(b.name)
      return 0
    })
  }, [posFilter, tierFilter, leagueFilter, natFilter, sortBy, ageRange])

  const toggle = (name) => setOpenName((prev) => (prev === name ? null : name))

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Prospect Pool</h1>
          <p className="text-white/50 text-sm">Seattle Kraken top prospects across all leagues</p>
        </div>
        <button
          onClick={() => setFiltersOpen((o) => !o)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            filtersOpen ? 'bg-ice text-navy' : 'bg-slate text-white/70 hover:text-white'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm2 4a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm2 4a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
          {filtersOpen ? 'Hide Filters' : 'Filters & Sort'}
        </button>
      </div>

      {/* filter panel */}
      <div className={`bg-slate/50 rounded-xl p-5 mb-8 flex flex-col gap-5 transition-all duration-200 ${filtersOpen ? 'block' : 'hidden'}`}>
        <div className="flex flex-wrap gap-6">
          <FilterChips label="Position"    options={POSITIONS}     value={posFilter}    onChange={setPosFilter} />
          <FilterChips label="Tier"        options={TIERS}         value={tierFilter}   onChange={setTierFilter} />
        </div>
        <div className="flex flex-wrap gap-6">
          <FilterChips label="League"      options={LEAGUES}       value={leagueFilter} onChange={setLeagueFilter} />
          <FilterChips label="Nationality" options={NATIONALITIES} value={natFilter}    onChange={setNatFilter} />
        </div>
        <div className="flex flex-wrap gap-8 items-end">
          <AgeRangeSlider min={MIN_AGE} max={MAX_AGE} value={ageRange} onChange={setAgeRange} />
          <div>
            <span className="text-white/40 text-xs uppercase tracking-widest block mb-2">Sort By</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate border border-white/10 text-white text-sm rounded-md px-3 py-1.5 cursor-pointer focus:outline-none focus:border-ice/50"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* cards */}
      {results.length === 0 ? (
        <p className="text-white/40 text-center py-16">No prospects match the selected filters.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {results.map((p) => (
            <ProspectCard
              key={p.name}
              prospect={p}
              isOpen={openName === p.name}
              onToggle={() => toggle(p.name)}
            />
          ))}
        </div>
      )}

      {/* Graduated to NHL */}
      <div className="mt-14">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-white/10" />
          <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest shrink-0">Graduated to NHL</h2>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        <p className="text-white/30 text-sm mb-5">Players who came up through the system and are now on the active roster.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { id: 8484800, name: 'Berkly Catton',   position: 'C'  },
            { id: 8483524, name: 'Shane Wright',    position: 'C'  },
            { id: 8482858, name: 'Ryker Evans',     position: 'D'  },
            { id: 8482751, name: 'Ryan Winterton',  position: 'C'  },
          ].map((p) => (
            <Link
              key={p.id}
              to={`/player/${p.id}`}
              className="bg-navy/60 border border-white/5 hover:border-ice/30 rounded-xl p-4 flex flex-col items-center gap-3 text-center transition-all hover:brightness-110 group"
            >
              <img
                src={`https://assets.nhle.com/mugs/nhl/20252026/SEA/${p.id}.png`}
                alt={p.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-ice/30 group-hover:border-ice transition-colors"
                onError={(e) => { e.target.style.display = 'none' }}
              />
              <div>
                <div className="text-white font-semibold text-sm group-hover:text-ice transition-colors">{p.name}</div>
                <div className="text-ice/60 text-xs font-bold mt-0.5">{p.position}</div>
                <div className="text-white/30 text-xs mt-1">Active Roster ✓</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
