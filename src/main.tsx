import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ── Üretim ortamında kaynak görüntülemeyi engelle ────────────────────────
if (import.meta.env.PROD) {
  // Sağ tık menüsünü kapat
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // Kaynak görüntüleme kısayollarını engelle
  document.addEventListener('keydown', (e) => {
    const blocked =
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'K'].includes(e.key)) ||
      (e.ctrlKey && e.key === 'U') ||
      (e.ctrlKey && e.key === 'S') ||
      (e.metaKey && e.altKey && ['I', 'J', 'C'].includes(e.key)) ||
      (e.metaKey && e.key === 'U');
    if (blocked) e.preventDefault();
  });

  // DevTools açıksa sayfayı boşalt — DEVRE DIŞI
  // (Mobil sanal klavye outerHeight/innerHeight farkını 160px'in üzerine çıkarıp
  //  false positive tetikliyor; güvenilir bir detection yöntemi değil)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
