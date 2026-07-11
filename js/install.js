// PWA install: captures beforeinstallprompt (Android/desktop Chrome) and
// falls back to Add-to-Home-Screen instructions on iOS Safari.
import { sheet } from './ui.js'

let deferredPrompt = null
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e })

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

export const installAvailable = () => !isStandalone() && (deferredPrompt !== null || isIOS())

export async function promptInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    deferredPrompt = null
    return
  }
  // iOS Safari has no install API — show instructions
  sheet(`
    <h1>Instalar no iPhone</h1>
    <ol style="padding-left:20px;display:grid;gap:10px;margin:12px 0">
      <li>Toque no botão <b>Compartilhar</b> <span aria-hidden="true">⎋</span> na barra do Safari</li>
      <li>Role e toque em <b>Adicionar à Tela de Início</b></li>
      <li>Confirme em <b>Adicionar</b></li>
    </ol>
    <p class="muted small">O Gastos vai abrir como um app, em tela cheia.</p>`)
}

export function registerSW() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {})
}
