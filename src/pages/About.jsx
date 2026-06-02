import { Link } from 'react-router-dom'
import { usePageTitle } from '../utils/usePageTitle'

export default function About() {
  usePageTitle('About')
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <img src="https://assets.nhle.com/logos/nhl/svg/SEA_light.svg" alt="Seattle Kraken" className="w-16 h-16" />
        <div>
          <h1 className="text-3xl font-bold text-white">About Krakapp</h1>
          <p className="text-white/50 text-sm mt-1">A Seattle Kraken fan stats hub</p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="bg-slate rounded-xl p-6">
          <h2 className="text-ice font-bold text-lg mb-3">What is Krakapp?</h2>
          <p className="text-white/70 leading-relaxed">
            Krakapp is an unofficial fan-built stats site for the Seattle Kraken. It pulls live
            data from the NHL API to show roster info, player stats, line combinations, prospect
            tracking, recent news, and more — all in one place, styled in Kraken colours.
          </p>
        </div>

        <div className="bg-slate rounded-xl p-6">
          <h2 className="text-ice font-bold text-lg mb-3">Who built it?</h2>
          <p className="text-white/70 leading-relaxed">
            Built by a Kraken fan. This is a personal project with no commercial intent —
            just a love of hockey and a desire to see Kraken data presented cleanly.
          </p>
        </div>

        <div className="bg-slate rounded-xl p-6">
          <h2 className="text-ice font-bold text-lg mb-3">Disclaimer</h2>
          <p className="text-white/60 text-sm leading-relaxed">
            Krakapp is an unofficial fan site and is not affiliated with, endorsed by, or
            connected to the Seattle Kraken, the NHL, or any of their partners. All team names,
            logos, and player data are property of their respective owners. Player data is
            sourced from the publicly available NHL API.
          </p>
        </div>

        <div className="bg-slate rounded-xl p-6">
          <h2 className="text-ice font-bold text-lg mb-3">Data sources</h2>
          <ul className="text-white/60 text-sm leading-relaxed space-y-1 list-disc list-inside">
            <li>NHL API — roster, player stats, standings, schedule</li>
            <li>Google News RSS — Kraken news headlines</li>
            <li>DailyFaceOff — projected line combinations</li>
            <li>RotoWire — injury reports</li>
          </ul>
        </div>

        <div className="bg-slate rounded-xl p-6">
          <h2 className="text-ice font-bold text-lg mb-3">Contact Us</h2>
          <p className="text-white/70 text-sm leading-relaxed mb-4">
            Have feedback, suggestions, or found an error? We'd love to hear from you.
          </p>
          <a
            href="mailto:krakapphockey@gmail.com"
            className="inline-flex items-center gap-2 bg-ice text-navy font-bold text-sm px-4 py-2.5 rounded-lg hover:bg-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            krakapphockey@gmail.com
          </a>
        </div>

        <Link to="/" className="text-ice/70 hover:text-ice text-sm text-center transition-colors mt-2">
          ← Back to home
        </Link>
      </div>
    </div>
  )
}
