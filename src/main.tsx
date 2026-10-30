import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.tsx'

/**
 * PWA service worker güncelleme akışı:
 * Yeni deploy sonrası skipWaiting ile yeni SW hemen devreye girer, ancak AÇIK
 * sekme eski bundle ile çalışmaya devam ederdi (kullanıcı 2 kez yenilemek
 * zorunda kalıyordu). Artık:
 *  1) Yeni controller devreye girdiğinde sekme BİR KEZ otomatik yenilenir.
 *  2) Uzun ömürlü sekmeler/PWA pencereleri her 30 dakikada ve sekme görünürlüğü
 *     geri geldiğinde registration.update() ile yeni sürümü kontrol eder.
 */
const hadController = !!navigator.serviceWorker?.controller;

if (navigator.serviceWorker) {
  const RELOAD_KEY = 'sw-reloaded-at';
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // İlk kurulumda controller yoktan var olur — döngüye girme.
    if (!hadController) return;
    // Deployment başına yalnızca bir otomatik yenileme (sonsuz döngü koruması).
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    window.location.reload();
  });

  const checkForUpdate = () => {
    navigator.serviceWorker?.getRegistration?.()?.then((reg) => {
      reg?.update().catch(() => { /* sessiz: çevrimdışı olabilir */ });
    }).catch(() => { /* kayıt yok */ });
  };

  setInterval(checkForUpdate, 30 * 60 * 1000); // 30 dk
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
