import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerServiceWorker, trackInstallPrompt } from './utils/pwa'

// 안드로이드 "공유 → 교습비 관리·게시표"로 엑셀을 받기 위한 서비스워커 + 앱 설치 안내
registerServiceWorker()
trackInstallPrompt()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
