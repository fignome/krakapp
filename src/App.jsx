import { useState, useEffect, useRef } from 'react'
import { Routes, Route, NavLink, Link, useLocation } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import daccordTracker from './data/daccord-tracker.json'
import Home from './pages/Home'
import Roster from './pages/Roster'
import PlayerDetail from './pages/PlayerDetail'
import GamePreview from './pages/GamePreview'
import Lines from './pages/Lines'
import ProspectPool from './pages/ProspectPool'
import News from './pages/News'
import NotFound from './pages/NotFound'
import TeamStats from './pages/TeamStats'
import About from './pages/About'
import Privacy from './pages/Privacy'
import Jerseys from './pages/Jerseys'
import Rumors from './pages/Rumors'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function PageTransition({ children }) {
  const location = useLocation()
  return (
    <div key={location.pathname} className="page-enter">
      {children}
    </div>
  )
}

// ─── Back to top button ───────────────────────────────────────────────────────
function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className={`fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-ice text-navy flex items-center justify-center shadow-lg
        transition-all duration-300 hover:scale-110 hover:brightness-110
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a1 1 0 01-.707-.293l-7-7a1 1 0 011.414-1.414L10 15.586l6.293-6.293a1 1 0 011.414 1.414l-7 7A1 1 0 0110 18zm0-8a1 1 0 01-.707-.293l-7-7a1 1 0 011.414-1.414L10 7.586l6.293-6.293a1 1 0 011.414 1.414l-7 7A1 1 0 0110 10z" clipRule="evenodd" />
      </svg>
    </button>
  )
}

// ─── Hamburger menu ───────────────────────────────────────────────────────────
function HamburgerMenu() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const location = useLocation()

  useEffect(() => { setOpen(false) }, [location])

  useEffect(() => {
    if (!open) return
    const handle = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const navItem = (to, label, end = false) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `block px-6 py-2.5 text-sm font-semibold border-b border-white/10 transition-colors ${
          isActive ? 'text-ice' : 'text-white hover:text-ice'
        }`
      }
    >
      {label}
    </NavLink>
  )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex flex-col gap-1.5 p-2 rounded-md hover:bg-navy/40 transition-colors"
        aria-label="Open menu"
      >
        <span className="w-5 h-0.5 bg-white rounded-full" />
        <span className="w-5 h-0.5 bg-white rounded-full" />
        <span className="w-5 h-0.5 bg-white rounded-full" />
      </button>

      {open && <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />}

      <div
        ref={panelRef}
        className={`fixed top-0 right-0 w-72 bg-slate shadow-2xl z-50 transform transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header — fixed */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-ice rounded-full flex items-center justify-center">
              <span className="text-navy font-black text-xs">S</span>
            </div>
            <span className="font-bold text-white">Krakapp</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-white/50 hover:text-white transition-colors text-xl leading-none"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Nav links — scrollable */}
        <nav className="mt-1 overflow-y-auto flex-1">
          {navItem('/', 'Home', true)}
          {navItem('/roster', 'Roster')}
          {navItem('/lines', 'Line Combinations')}
          {navItem('/game-preview', 'Game Preview')}
          {navItem('/prospects', 'Prospect Pool')}
          {navItem('/news', 'News')}
          {navItem('/rumors', 'Trade Rumors')}
          {navItem('/team-stats', 'Team Stats')}
          {navItem('/jerseys', 'Jerseys')}
          {navItem('/about', 'About')}
        </nav>

        {/* Disclaimer — pinned to bottom */}
        <div className="px-6 py-5 border-t border-white/10 shrink-0">
          <p className="text-white/20 text-xs leading-relaxed">
            Unofficial fan site. Not affiliated with the Seattle Kraken or NHL.
          </p>
        </div>
      </div>
    </>
  )
}

// ─── Nav bar ──────────────────────────────────────────────────────────────────
function NavBar() {
  const [scrolled, setScrolled] = useState(false)
  const [record, setRecord] = useState(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/cache/standings.json')
        if (!res.ok) return
        const data = await res.json()
        const sea = data?.standings?.find((t) => t.teamAbbrev?.default === 'SEA')
        if (sea) setRecord(`${sea.wins}–${sea.losses}–${sea.otLosses}`)
      } catch {}
    }
    load()
  }, [])

  return (
    <nav className={`sticky top-0 z-30 bg-slate shadow-lg transition-all duration-300 ${scrolled ? 'py-2' : 'py-0'}`}>
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between" style={{ minHeight: scrolled ? 52 : 68, transition: 'min-height 0.3s' }}>
        <Link to="/" className="flex items-center gap-2 sm:gap-3">
          <div className={`bg-ice rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${scrolled ? 'w-7 h-7' : 'w-8 h-8'}`}>
            <span className="text-navy font-black text-xs">SEA</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`font-bold tracking-wide text-white transition-all duration-300 ${scrolled ? 'text-base' : 'text-xl'}`}>
              Krakapp
            </span>
            {record && (
              <span className="hidden sm:inline text-xs font-mono text-white/40 bg-navy/40 px-2 py-0.5 rounded">
                {record}
              </span>
            )}
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex gap-1">
            <NavLink
              to="/roster"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'bg-kraken text-white' : 'text-white hover:bg-navy hover:text-ice'
                }`
              }
            >
              Roster
            </NavLink>
            <NavLink
              to="/game-preview"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'bg-kraken text-white' : 'text-white hover:bg-navy hover:text-ice'
                }`
              }
            >
              Game Preview
            </NavLink>
          </div>
          <HamburgerMenu />
        </div>
      </div>
    </nav>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div className="min-h-screen bg-navy text-white flex flex-col">
      <ScrollToTop />
      {daccordTracker.goals > 0 && (
        <div className="bg-kraken text-white text-center text-sm font-black py-2 px-4 tracking-wide animate-pulse">
          🚨 JOEY DACCORD SCORED A GOALIE GOAL 🚨
        </div>
      )}
      <NavBar />

      <main className="max-w-6xl mx-auto px-4 py-8 w-full flex-1">
        <PageTransition>
          <Routes>
            <Route path="/"            element={<Home />} />
            <Route path="/roster"      element={<Roster />} />
            <Route path="/player/:id"  element={<PlayerDetail />} />
            <Route path="/lines"       element={<Lines />} />
            <Route path="/game-preview"element={<GamePreview />} />
            <Route path="/prospects"   element={<ProspectPool />} />
            <Route path="/news"        element={<News />} />
            <Route path="/team-stats"  element={<TeamStats />} />
            <Route path="/about"       element={<About />} />
            <Route path="/privacy"     element={<Privacy />} />
            <Route path="/jerseys"     element={<Jerseys />} />
            <Route path="/rumors"      element={<Rumors />} />
            <Route path="*"            element={<NotFound />} />
          </Routes>
        </PageTransition>
      </main>

      <footer className="border-t border-white/10 mt-16 bg-slate/30">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row gap-6 justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <img src="https://assets.nhle.com/logos/nhl/svg/SEA_light.svg" alt="SEA" className="w-6 h-6" />
                <span className="font-bold text-white text-sm">Krakapp</span>
              </div>
              <p className="text-white/30 text-xs max-w-xs leading-relaxed">
                Unofficial fan site — not affiliated with the Seattle Kraken or the NHL.
              </p>
            </div>
            <nav className="flex flex-wrap gap-x-5 gap-y-2">
              {[
                ['/', 'Home'],
                ['/roster', 'Roster'],
                ['/lines', 'Line Combinations'],
                ['/game-preview', 'Game Preview'],
                ['/news', 'News'],
                ['/prospects', 'Prospect Pool'],
                ['/team-stats', 'Team Stats'],
                ['/about', 'About'],
                ['/privacy', 'Privacy Policy'],
              ].map(([to, label]) => (
                <Link key={to} to={to} className="text-ice/70 hover:text-ice text-sm transition-colors">
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="border-t border-white/5 pt-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-white/20 text-xs">
              Data sourced from the NHL API. Player stats and standings may be delayed.
            </p>
            <Link to="/privacy" className="text-white/25 hover:text-ice text-xs transition-colors shrink-0">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>

      <BackToTop />
      <Analytics />
    </div>
  )
}
