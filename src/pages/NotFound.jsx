import { Link } from 'react-router-dom'
import { usePageTitle } from '../utils/usePageTitle'

export default function NotFound() {
  usePageTitle('Page Not Found')
  return (
    <div className="flex flex-col items-center justify-center py-28 text-center">
      <img
        src="https://assets.nhle.com/logos/nhl/svg/SEA_light.svg"
        alt="Seattle Kraken"
        className="w-24 h-24 mb-8 opacity-30"
      />
      <p className="text-ice font-black text-7xl mb-4">404</p>
      <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
      <p className="text-white/40 text-sm mb-8 max-w-sm">
        Looks like this page got sent to the penalty box. It doesn't exist or may have moved.
      </p>
      <Link
        to="/"
        className="bg-ice text-navy font-bold px-6 py-3 rounded-lg hover:bg-white transition-colors"
      >
        Back to Home
      </Link>
    </div>
  )
}
