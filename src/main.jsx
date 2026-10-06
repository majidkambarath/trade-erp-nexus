import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerServiceWorker } from './lib/pwa'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Caches the shell so a second visit starts instantly, and makes the app installable.
// Business data is never cached - see the rule at the top of public/sw.js. A new version is
// offered through the shell rather than applied behind the person's back.
registerServiceWorker({
  onUpdate: (apply) => window.dispatchEvent(new CustomEvent('app-update-ready', { detail: apply })),
})
