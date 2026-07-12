// App shell: auth gate → tab routing. Views render into #app.
import { sb, ALLOWED, signOut } from './supabase.js'
import { state, loadRows, esc } from './store.js'
import { nav, skeleton } from './ui.js'
import { renderLogin, renderBlocked } from './views/login.js'
import { renderResumo } from './views/resumo.js'
import { renderRelatorios } from './views/relatorios.js'
import { renderTabela } from './views/tabela.js'
import { renderContas } from './views/contas.js'
import { openExpenseSheet } from './views/expense-sheet.js'
import { registerSW } from './install.js'
import { applyTheme, cycleTheme, currentTheme, ICONS, LABELS } from './theme.js'
import { icon } from './ui.js'

const $app = document.getElementById('app')
let tab = 'resumo'
let repRange = '3m'
let tabelaYm = null

function render() {
  $app.innerHTML = `<div id="view"></div>${nav(tab)}`
  const view = $app.querySelector('#view')
  if (tab === 'resumo') renderResumo(view)
  else if (tab === 'relatorios') renderRelatorios(view, repRange, r => { repRange = r; render() })
  else if (tab === 'tabela') renderTabela(view, tabelaYm, ym => { tabelaYm = ym; render() }, render)
  else renderContas(view, render)

  for (const b of $app.querySelectorAll('.c-nav [data-t]'))
    b.onclick = () => { tab = b.dataset.t; render(); scrollTo(0, 0) }
  $app.querySelector('#nav-add').onclick = () => openExpenseSheet({ onDone: render })
  const themeBtn = $app.querySelector('#nav-theme')
  themeBtn.innerHTML = `${icon(ICONS[currentTheme()], 20)}${LABELS[currentTheme()]}`
  themeBtn.onclick = () => { cycleTheme(); render() } // re-render → charts pick up new palette
  const out = $app.querySelector('#out')
  if (out) out.onclick = () => signOut()
}

async function enter() {
  $app.innerHTML = skeleton()
  try {
    await loadRows()
    render()
  } catch (e) {
    $app.innerHTML = `<div class="c-empty"><div class="c-empty__icon">😕</div>
      Erro ao carregar.<br><span class="small">${esc(e.message)}</span></div>`
  }
}

function handleSession(session) {
  const user = session?.user ?? null
  if (state.user?.email === user?.email && user) return // ignore token refreshes
  state.user = user
  if (!user) return renderLogin($app)
  if (!ALLOWED[user.email]) return renderBlocked($app)
  enter()
}

applyTheme()
registerSW()
const { data: { session } } = await sb.auth.getSession()
handleSession(session)
sb.auth.onAuthStateChange((_e, s) => handleSession(s))
