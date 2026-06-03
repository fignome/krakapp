import { useState } from 'react'
import { usePageTitle } from '../utils/usePageTitle'

// ─── SVG Jersey Illustration (fallback) ──────────────────────────────────────
function JerseySVG({ body, stripes, text, glow = false }) {
  const glowFilter = glow
    ? 'drop-shadow(0 0 6px rgba(153,217,217,0.8)) drop-shadow(0 0 12px rgba(153,217,217,0.4))'
    : 'none'

  return (
    <svg
      viewBox="0 0 200 240"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full"
      aria-hidden="true"
    >
      {/* Shoulders / collar cutout */}
      <path
        d="M60,10 L30,50 L10,45 L10,230 L190,230 L190,45 L170,50 L140,10
           Q120,25 100,25 Q80,25 60,10 Z"
        fill={body}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1"
      />

      {/* Sleeve left */}
      <path
        d="M60,10 L30,50 L10,45 L10,130 L55,110 L55,30 Q57,18 60,10 Z"
        fill={body}
      />

      {/* Sleeve right */}
      <path
        d="M140,10 L170,50 L190,45 L190,130 L145,110 L145,30 Q143,18 140,10 Z"
        fill={body}
      />

      {/* Bottom stripe */}
      <rect x="10" y="195" width="180" height="14" rx="0" fill={stripes} opacity="0.85" />
      <rect x="10" y="213" width="180" height="7"  rx="0" fill={stripes} opacity="0.5" />

      {/* Sleeve stripes left */}
      <rect x="10" y="90" width="45" height="10" rx="0" fill={stripes} opacity="0.85" />
      <rect x="10" y="104" width="45" height="5"  rx="0" fill={stripes} opacity="0.5" />

      {/* Sleeve stripes right */}
      <rect x="145" y="90" width="45" height="10" rx="0" fill={stripes} opacity="0.85" />
      <rect x="145" y="104" width="45" height="5"  rx="0" fill={stripes} opacity="0.5" />

      {/* Collar */}
      <path
        d="M80,10 Q100,30 120,10"
        fill="none"
        stroke={stripes}
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.9"
      />

      {/* SEA lettering */}
      <text
        x="100"
        y="172"
        textAnchor="middle"
        fontSize="36"
        fontWeight="900"
        fontFamily="system-ui, sans-serif"
        letterSpacing="4"
        fill={text}
        style={{ filter: glowFilter }}
      >
        SEA
      </text>
    </svg>
  )
}

// ─── Current jersey card ──────────────────────────────────────────────────────
function JerseyCard({ name, label, description, svgProps, badge, cardBg, imageSrc }) {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <div
      className="rounded-xl overflow-hidden border border-white/5 hover:border-ice/20 transition-colors"
      style={{ background: cardBg ?? '#355464', height: 550, display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ height: 350, flexShrink: 0, background: '#001628', overflow: 'hidden' }}>
        {imageSrc && !imgFailed ? (
          <img
            src={imageSrc}
            alt={name}
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="p-6 h-full flex items-center">
            <JerseySVG {...svgProps} />
          </div>
        )}
      </div>
      <div style={{ background: '#355464', padding: '16px 20px 20px', flex: 1 }}>
        <div className="flex items-center gap-2 mb-1">
          <h3 style={{ color: '#ffffff', fontWeight: 700, fontSize: '1rem', margin: 0 }}>{name}</h3>
          {badge && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-ice/15 text-ice border border-ice/20">
              {badge}
            </span>
          )}
        </div>
        <div style={{ color: '#99D9D9', opacity: 0.7, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>{label}</div>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>{description}</p>
      </div>
    </div>
  )
}

// ─── History row ──────────────────────────────────────────────────────────────
function HistoryCard({ season, name, note, dot }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${dot}`} />
        <div className="w-px flex-1 bg-white/10 mt-1" />
      </div>
      <div className="pb-6">
        <div className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-0.5">{season}</div>
        <div className="text-white font-bold text-sm mb-1">{name}</div>
        <p className="text-white/50 text-xs leading-relaxed">{note}</p>
      </div>
    </div>
  )
}

// ─── Rumour card ──────────────────────────────────────────────────────────────
function RumourCard({ title, tag, body }) {
  return (
    <div className="bg-slate rounded-xl p-5 border border-white/5">
      <div className="flex items-start gap-3 mb-3">
        <span className={`shrink-0 mt-0.5 text-xs font-bold px-2 py-0.5 rounded-full border ${
          tag === 'Confirmed'
            ? 'bg-green-500/15 text-green-400 border-green-500/25'
            : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25'
        }`}>
          {tag}
        </span>
        <h3 className="font-bold text-white text-base leading-snug">{title}</h3>
      </div>
      <p className="text-white/60 text-sm leading-relaxed">{body}</p>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function Jerseys() {
  usePageTitle('Jerseys')

  const current = [
    {
      name: 'Deep Sea Blue',
      label: 'Home',
      imageSrc: '/images/jerseys/home-jersey.png',
      cardBg: 'linear-gradient(160deg, #001e38 0%, #00263f 100%)',
      svgProps: { body: '#001628', stripes: '#99D9D9', text: '#99D9D9' },
      description:
        "Deep navy base with ice blue and red accents. The anchor-S crest sits front and centre, representing Seattle's maritime identity and the depth of the ocean.",
    },
    {
      name: 'The Abyss',
      label: 'Third',
      imageSrc: '/images/jerseys/abyss-jersey.png',
      cardBg: 'linear-gradient(160deg, #070d10 0%, #0a1318 100%)',
      svgProps: { body: '#060a0c', stripes: '#99D9D9', text: '#99D9D9', glow: true },
      badge: 'Glow in the Dark ✨',
      description:
        'All-black with glow-in-the-dark ice blue crest and sonar sleeve stripes inspired by bioluminescence in Pacific Northwest waters. Features the Muckleshoot Indian Tribe patch with glow-in-the-dark outline.',
    },
    {
      name: 'White Out',
      label: 'Away',
      imageSrc: '/images/jerseys/away-jersey.png',
      cardBg: '#001628',
      svgProps: { body: '#FFFFFF', stripes: '#001628', text: '#001628' },
      description:
        "Clean white with navy and red accents. A classic road look that lets the Kraken's distinctive crest and colour palette speak for themselves.",
    },
  ]

  const history = [
    {
      season: '2021–22',
      name: 'Inaugural Home & Away',
      note: 'The very first Kraken jerseys. Deep sea blue at home, white on the road — both featuring the anchor-S crest and the inaugural Kraken wordmark on the road jersey.',
      dot: 'bg-ice',
    },
    {
      season: '2022–23',
      name: 'Reverse Retro',
      note: "Part of Adidas's league-wide Reverse Retro campaign. Seattle leaned into the Space Needle and Seattle's civic identity with a bold alternate colourway.",
      dot: 'bg-purple-400',
    },
    {
      season: '2024',
      name: 'Winter Classic',
      note: "Worn outdoors at T-Mobile Park for the 2024 NHL Winter Classic. Cream-toned design with vintage-inspired lettering nodding to Seattle's hockey heritage.",
      dot: 'bg-yellow-400',
    },
    {
      season: '2025–26',
      name: 'The Abyss (Third)',
      note: "Introduced as the team's first true third jersey. Blacked-out design with glow-in-the-dark elements worn 12 times throughout the season, drawing rave reviews from fans.",
      dot: 'bg-kraken',
    },
  ]

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white mb-1">Jerseys</h1>
        <p className="text-white/50 text-sm">Seattle Kraken uniforms — past, present, and future</p>
      </div>

      {/* ── Current jerseys ── */}
      <section className="mb-12">
        <h2 className="text-xs text-white/40 uppercase tracking-widest mb-5">2025–26 Uniforms</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {current.map((j) => (
            <JerseyCard key={j.name} {...j} />
          ))}
        </div>
        <p className="text-white/25 text-xs mt-3">
          Jersey images © Seattle Kraken / NHL. All rights reserved.
        </p>
      </section>

      {/* ── Jersey history ── */}
      <section className="mb-12">
        <h2 className="text-xs text-white/40 uppercase tracking-widest mb-6">Jersey History</h2>
        <div className="bg-slate rounded-xl p-6 border border-white/5">
          {history.map((h, i) => (
            <div key={i} className={i === history.length - 1 ? '[&>div>div:last-child]:hidden' : ''}>
              <HistoryCard {...h} />
            </div>
          ))}
        </div>
      </section>

      {/* ── Rumours & upcoming ── */}
      <section>
        <h2 className="text-xs text-white/40 uppercase tracking-widest mb-5">Rumors & Upcoming</h2>
        <div className="flex flex-col gap-4">
          <RumourCard
            title="Hometown Remix — 2026–27"
            tag="Rumor"
            body="Every NHL team is getting a new Fanatics Hometown Remix alternate jersey for 2026–27, similar to MLB's City Connect series. No Seattle design has been confirmed yet but announcements are expected summer 2026. Expect a design tied to Seattle's city identity and Pacific Northwest culture."
          />
          <RumourCard
            title="The Abyss Returns"
            tag="Confirmed"
            body="The Abyss third jersey is confirmed to continue being worn for at least two more seasons through 2027–28. The fan-favourite all-black design has become a signature look for the franchise."
          />
        </div>
      </section>
    </div>
  )
}
