import { useState } from 'react'

const STAT_LABELS = {
  GP:  'Games Played',
  G:   'Goals',
  A:   'Assists',
  PTS: 'Points',
  '+/-': 'Plus / Minus',
  PIM: 'Penalty Minutes',
  PPG: 'Power Play Goals',
  SHG: 'Shorthanded Goals',
  GAA: 'Goals Against Average',
  'SV%': 'Save Percentage',
  SO:  'Shutouts',
  W:   'Wins',
  L:   'Losses',
  OT:  'Overtime Losses',
}

/**
 * Wraps children in a tooltip showing the full label for a stat abbreviation.
 * Usage: <StatTip stat="GP">GP</StatTip>
 */
export function StatTip({ stat, children }) {
  const label = STAT_LABELS[stat]
  const [show, setShow] = useState(false)
  if (!label) return <>{children}</>
  return (
    <span
      className="relative cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-navy border border-white/20 text-white text-xs rounded whitespace-nowrap z-50 pointer-events-none shadow-lg">
          {label}
        </span>
      )}
    </span>
  )
}
