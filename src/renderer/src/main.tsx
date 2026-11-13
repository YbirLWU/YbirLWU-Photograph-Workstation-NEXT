import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { APP_NAME, APP_VERSION_LABEL } from '@shared/version'
import App from './App'
import './styles/app.css'

const container = document.getElementById('root')
if (!container) throw new Error('root container missing')

document.title = `${APP_NAME} · ${APP_VERSION_LABEL}`

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
