import { useState, useEffect, useCallback, useRef } from 'react'
import { usePageTitle } from '../utils/usePageTitle'

const CACHE_KEY = 'kraken_news_cache'
const CACHE_TTL = 5 * 60 * 1000  // 5 min client-side dedup; real 8h cache is server-side (CDN)
const COOLDOWN_SECS = 60
const CACHE_LABEL = 'Updates every 8 hours'

const CATEGORY_STYLES = {
  'Roster':      'bg-ice/20 text-ice',
  'Game Recap':  'bg-slate border border-white/20 text-white/70',
  'Trade Rumor': 'bg-kraken/20 text-red-400',
  'Injury':      'bg-amber-500/20 text-amber-400',
  'Draft':       'bg-purple-500/20 text-purple-400',
  'General':     'bg-white/10 text-white/50',
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.ts || !Array.isArray(parsed?.data?.articles)) return null
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

function SkeletonCard() {
  return (
    <div className="bg-slate rounded-xl p-5 flex flex-col gap-3 border border-white/5 animate-pulse">
      <div className="flex items-start justify-between gap-2">
        <div className="h-4 bg-white/10 rounded w-20" />
        <div className="h-4 bg-white/10 rounded w-24" />
      </div>
      <div className="h-5 bg-white/10 rounded w-3/4" />
      <div className="h-5 bg-white/10 rounded w-1/2" />
      <div className="space-y-2 mt-1">
        <div className="h-3 bg-white/10 rounded w-full" />
        <div className="h-3 bg-white/10 rounded w-full" />
        <div className="h-3 bg-white/10 rounded w-2/3" />
      </div>
      <div className="h-3 bg-white/10 rounded w-28 mt-1" />
    </div>
  )
}

function NewsCard({ article }) {
  const badgeClass = CATEGORY_STYLES[article.category] ?? CATEGORY_STYLES['General']
  return (
    <div className="bg-slate rounded-xl p-5 flex flex-col gap-3 border border-white/5 hover:border-ice/30 hover:brightness-110 hover:scale-[1.01] transition-all duration-200">
      <div className="flex items-start justify-between gap-2">
        <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${badgeClass}`}>
          {article.category}
        </span>
        <span className="text-white/40 text-xs text-right">{article.date}</span>
      </div>
      <h2 className="text-white font-bold text-base leading-snug">{article.title}</h2>
      <p className="text-white/60 text-sm leading-relaxed flex-1">{article.summary}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-white/30 text-xs font-medium">{article.source}</span>
        {article.url && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ice/70 hover:text-ice text-xs font-semibold transition-colors flex items-center gap-1"
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
  )
}

export default function News() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  usePageTitle('News')
  const [fromCache, setFromCache] = useState(null) // true = cached, false = live
  const [cooldown, setCooldown] = useState(0)
  const cooldownRef = useRef(null)
  const fetchingRef = useRef(false) // prevents duplicate in-flight calls

  function startCooldown() {
    setCooldown(COOLDOWN_SECS)
    cooldownRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) { clearInterval(cooldownRef.current); return 0 }
        return s - 1
      })
    }, 1000)
  }

  const fetchNews = useCallback(async (forceRefresh = false) => {
    // Single-flight guard — never queue multiple calls
    if (fetchingRef.current) return

    if (!forceRefresh) {
      const cached = readCache()
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        const ageMin = Math.round((Date.now() - cached.ts) / 60000)
        console.log(`[News] Cache hit — ${ageMin} min old, skipping API call`)
        setArticles(cached.data.articles)
        setUpdatedAt(new Date(cached.ts))
        setFromCache(true)
        setLoading(false)
        return
      }
    }

    console.log('[News] API call made — cache expired or forced refresh')
    fetchingRef.current = true
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/news')
      const data = await res.json()
      if (data.error && data.articles.length === 0) throw new Error(data.error)
      setArticles(data.articles)
      const now = new Date()
      setUpdatedAt(now)
      setFromCache(false)
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: now.getTime() }))
      console.log('[News] Fresh data cached')
      startCooldown()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  // Mount: fetch once
  useEffect(() => {
    fetchNews()
    return () => clearInterval(cooldownRef.current)
  }, [fetchNews])

  // Tab focus: only re-fetch if cache has actually expired
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const cached = readCache()
      if (!cached || Date.now() - cached.ts >= CACHE_TTL) {
        console.log('[News] Tab focused with stale/missing cache — fetching')
        fetchNews()
      } else {
        console.log('[News] Tab focused — cache still valid, no fetch')
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchNews])

  // Completely block clicks during cooldown — not just visual
  const isDisabled = loading || cooldown > 0
  const handleRefreshClick = () => {
    if (isDisabled) return // hard block, not just disabled attr
    fetchNews(true)
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Kraken News</h1>
          <div className="flex items-center gap-2 mt-1">
            {fromCache !== null && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${fromCache ? 'bg-white/10 text-white/50' : 'bg-ice/20 text-ice'}`}>
                {fromCache ? 'Cached' : 'Live'}
              </span>
            )}
            <p className="text-white/50 text-sm">
              {updatedAt ? `Updated ${timeAgoStr(updatedAt)}` : 'Latest Kraken news, powered by Google News + AI'}
            </p>
            <p className="text-white/25 text-xs">{CACHE_LABEL}</p>
          </div>
        </div>
        <button
          onClick={handleRefreshClick}
          disabled={isDisabled}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-slate text-white/70 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? 'Fetching…' : cooldown > 0 ? `Available in ${cooldown}s` : 'Refresh'}
        </button>
      </div>

      {error && !loading && (
        <div className="bg-kraken/10 border border-kraken/30 rounded-xl p-6 mb-8 flex items-start gap-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-kraken shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-white font-semibold mb-1">Couldn't load news</p>
            <p className="text-white/50 text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading
          ? Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)
          : articles.map((article, i) => <NewsCard key={i} article={article} />)}
      </div>
    </div>
  )
}
