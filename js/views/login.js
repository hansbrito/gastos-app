import { signInGoogle, signOut } from '../supabase.js'
import { toast } from '../ui.js'
import { installAvailable, promptInstall } from '../install.js'

const GOOGLE_ICON = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="currentColor" d="M45 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2.1 5.1-4.4 6.7v5.5h7.1C42.7 36.9 45 31.2 45 24.5z"/><path fill="currentColor" opacity=".8" d="M24 46c6 0 11-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8 41.3 15.4 46 24 46z"/><path fill="currentColor" opacity=".6" d="M11.8 28.3c-.4-1.3-.7-2.8-.7-4.3s.3-3 .7-4.3V14H4.5C3 17 2 20.4 2 24s1 7 2.5 10l7.3-5.7z"/><path fill="currentColor" opacity=".9" d="M24 11.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C35 5.1 30 3 24 3 15.4 3 8 7.7 4.5 14l7.3 5.7c1.7-5.2 6.5-9 12.2-9z"/></svg>`

export function renderLogin(el) {
  el.innerHTML = `
    <div class="c-login">
      <img class="c-login__logo" src="icon.svg" alt="">
      <h1 style="font-size:26px">Gastos</h1>
      <button class="c-btn c-btn--primary" id="google">${GOOGLE_ICON} Entrar com Google</button>
      ${installAvailable() ? `<button class="c-btn--link" id="install">📲 instalar no celular</button>` : ''}
    </div>`
  el.querySelector('#google').onclick = async () => {
    const { error } = await signInGoogle()
    if (error) toast('Erro: ' + error.message)
  }
  const inst = el.querySelector('#install')
  if (inst) inst.onclick = promptInstall
}

export function renderBlocked(el) {
  el.innerHTML = `
    <div class="c-empty" style="min-height:80vh;display:flex;flex-direction:column;justify-content:center">
      <div class="c-empty__icon" aria-hidden="true">🔒</div>
      <h1>Sem acesso</h1>
      <p>Este app é só do Hans e da Bia.</p>
      <p style="margin-top:16px"><button class="c-btn--link" id="out">sair</button></p>
    </div>`
  el.querySelector('#out').onclick = () => signOut()
}
