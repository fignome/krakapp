// server.js — nightly cache updater
// Runs alongside the Vite dev server (node server.js in a separate terminal)
// Schedules a cache refresh every night at 3:00 AM

import cron from 'node-cron'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const scriptPath = path.join(__dirname, 'scripts', 'updateCache.js')

function runUpdate() {
  console.log(`[server.js] Running cache update at ${new Date().toLocaleString()}`)
  execFile(process.execPath, [scriptPath], (err, stdout, stderr) => {
    if (stdout) process.stdout.write(stdout)
    if (stderr) process.stderr.write(stderr)
    if (err) console.error('[server.js] Cache update failed:', err.message)
    else console.log('[server.js] Cache update complete ✓')
  })
}

// Run every night at 3:00 AM
cron.schedule('0 3 * * *', runUpdate, { timezone: 'America/Los_Angeles' })

console.log('[server.js] Cron scheduler started. Next run: tonight at 3:00 AM (Pacific).')
console.log('[server.js] To run an immediate cache update: node scripts/updateCache.js')
