import { useEffect } from 'react'

function setMeta(property, content) {
  let el = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(property.startsWith('og:') || property.startsWith('twitter:') ? 'property' : 'name', property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/**
 * Sets the browser tab title and Open Graph / Twitter meta tags.
 * @param {string} title   - Page-level title (e.g. "Roster")
 * @param {object} [meta]  - Optional overrides: { description, image }
 */
export function usePageTitle(title, meta = {}) {
  useEffect(() => {
    const full = `${title} | Krakapp`
    const desc = meta.description ?? 'Unofficial Seattle Kraken fan stats hub.'
    const img  = meta.image ?? 'https://assets.nhle.com/logos/nhl/svg/SEA_light.svg'

    document.title = full
    setMeta('og:title', full)
    setMeta('og:description', desc)
    setMeta('og:image', img)
    setMeta('twitter:title', full)
    setMeta('twitter:description', desc)
    setMeta('twitter:image', img)

    return () => {
      document.title = 'Krakapp | Seattle Kraken Stats'
    }
  }, [title, meta.description, meta.image])
}
