import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Flush any corrupted cache entries from old sessions
;['kraken_news_cache', 'kraken_lines_cache'].forEach(key => {
  try {
    const raw = localStorage.getItem(key)
    if (raw) JSON.parse(raw) // will throw if corrupt
  } catch {
    localStorage.removeItem(key)
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
