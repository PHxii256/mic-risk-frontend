import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import './i18n'
import { App } from './App'
import { createQueryClient } from './lib/queryClient'

const container = document.getElementById('root')
if (!container) throw new Error('Root element not found.')

createRoot(container).render(
  <StrictMode>
    <App queryClient={createQueryClient()} />
  </StrictMode>,
)
