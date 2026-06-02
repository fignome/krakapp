import { usePageTitle } from '../utils/usePageTitle'

const Section = ({ title, children }) => (
  <div className="bg-slate rounded-xl p-6">
    <h2 className="text-ice font-bold text-lg mb-3">{title}</h2>
    <div className="text-white/70 text-sm leading-relaxed space-y-2">{children}</div>
  </div>
)

export default function Privacy() {
  usePageTitle('Privacy Policy')
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-white/40 text-sm">Last updated: June 2026</p>
      </div>

      <div className="flex flex-col gap-5">
        <Section title="Introduction">
          <p>
            Krakapp is an unofficial fan-built website dedicated to the Seattle Kraken. This
            page explains how we handle information when you use the site. The short version:
            we collect very little, store nothing personal, and we're not trying to track you.
          </p>
        </Section>

        <Section title="Information We Collect">
          <p>
            We do not collect, store, or transmit any personal information. You don't need to
            create an account or provide any details to use Krakapp.
          </p>
          <p>
            The site uses your browser's <strong className="text-white/90">localStorage</strong> to
            remember whether you've already voted in a fan poll or submitted a player rating.
            This prevents duplicate votes and lives entirely in your own browser — it is never
            sent to any server and contains no personally identifiable information.
          </p>
          <p>
            You can clear this data at any time by clearing your browser's local storage or
            site data in your browser settings.
          </p>
        </Section>

        <Section title="Third-Party Services">
          <p>Krakapp uses the following external services to power its features:</p>
          <ul className="space-y-2 mt-2">
            {[
              ['NHL API', 'Provides player stats, roster data, standings, and schedules. Data is fetched publicly and no user data is sent.'],
              ['Firebase / Firestore (Google)', 'Stores anonymous poll votes and player ratings. No personal data is attached to these records — only the vote count.'],
              ['Anthropic API', 'Powers AI-driven features such as news summarisation and line combination lookups. No user data is sent to Anthropic.'],
              ['Google AdSense', 'May be used in the future to display advertisements. Google may use cookies to serve relevant ads based on your browsing behaviour. See the Advertising section below.'],
            ].map(([name, desc]) => (
              <li key={name} className="flex gap-3">
                <span className="text-ice font-semibold shrink-0 mt-0.5">·</span>
                <span><strong className="text-white/90">{name}</strong> — {desc}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Cookies & Local Storage">
          <p>
            Krakapp does not use tracking cookies. We use <strong className="text-white/90">localStorage</strong> (a
            browser storage mechanism) only to remember your poll and rating votes within your
            own browser session. This data never leaves your device.
          </p>
          <p>
            Third-party services integrated into the site (such as Google AdSense and Firebase)
            may set their own cookies subject to their own privacy policies.
          </p>
        </Section>

        <Section title="Advertising">
          <p>
            Krakapp may display advertisements served through <strong className="text-white/90">Google AdSense</strong>.
            Google may use cookies and similar technologies to show you ads based on your
            previous visits to this and other websites.
          </p>
          <p>
            You can opt out of personalised advertising by visiting{' '}
            <a
              href="https://www.google.com/settings/ads"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ice hover:text-white transition-colors underline underline-offset-2"
            >
              Google's Ad Settings
            </a>
            .
          </p>
        </Section>

        <Section title="Contact">
          <p>
            If you have any questions or concerns about privacy on Krakapp, you can reach out
            via the{' '}
            <a href="/about" className="text-ice hover:text-white transition-colors underline underline-offset-2">
              About page
            </a>
            . We'll do our best to respond promptly.
          </p>
        </Section>

        <div className="bg-navy/60 border border-white/10 rounded-xl p-6">
          <h2 className="text-white/60 font-bold text-sm uppercase tracking-widest mb-3">Disclaimer</h2>
          <p className="text-white/50 text-sm leading-relaxed">
            This is an unofficial fan site and is not affiliated with, endorsed by, or connected
            to the Seattle Kraken or the NHL. All team and player data is sourced from the NHL
            API. Team names, logos, and other intellectual property are the property of their
            respective owners.
          </p>
        </div>

        <p className="text-white/25 text-xs text-center pb-4">Last updated: June 2026</p>
      </div>
    </div>
  )
}
