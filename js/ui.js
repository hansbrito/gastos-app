// Reusable component renderers. Pure functions: data in → HTML string out.
// All dynamic text goes through esc() — no exceptions.
import { esc, brl, CATS, CAT_COLORS, dateOf } from './store.js'

/* ---- Icon set (Lucide-style strokes, currentColor) ---- */
const PATHS = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M12 3v18"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  install: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  google: '<circle cx="12" cy="12" r="10"/><path d="M17.13 12.2H12v2.5h2.92c-.4 1.4-1.54 2.3-2.92 2.3a3 3 0 0 1 0-6c.73 0 1.4.26 1.92.7l1.85-1.85A5.5 5.5 0 1 0 12 17.5c3.08 0 5.13-2.17 5.13-5.3z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  auto: '<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor" stroke="none"/>',
}
export const icon = (name, size = 20) =>
  `<span class="c-ic" aria-hidden="true"><svg width="${size}" height="${size}" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PATHS[name]}</svg></span>`

export const card = inner => `<div class="c-card">${inner}</div>`

export const stat = ({ label, value, chip, hint }) => `
  <div class="c-stat">
    <div class="c-stat__label">${label}</div>
    <div class="c-stat__value num">${value}</div>
    ${chip || ''}
    ${hint ? `<div class="c-stat__hint">${hint}</div>` : ''}
  </div>`

export const chip = (text, variant = 'neutral') =>
  `<span class="c-chip c-chip--${variant}">${text}</span>`

export const catRow = ({ name, value, max, aside }) => `
  <div class="c-cat" style="--cat-color:${CAT_COLORS[name] || CAT_COLORS['Outros']}">
    <div class="c-cat__emoji" aria-hidden="true">${CATS[name] || '📦'}</div>
    <div class="c-cat__body">
      <div class="c-cat__line"><span>${esc(name)}</span><span class="num">${brl(value)}</span></div>
      <div class="c-cat__bar"><i style="width:${Math.max(value / max * 100, 2).toFixed(0)}%"></i></div>
    </div>
    ${aside ? `<div class="c-cat__aside muted small num">${aside}</div>` : ''}
  </div>`

export const txRow = r => {
  const d = dateOf(r)
  const initial = (r.sender || '?').trim()[0]?.toUpperCase() || '?'
  return `<div class="c-tx">
    <div class="c-tx__avatar" title="${esc(r.sender || '')}" aria-hidden="true">${esc(initial)}</div>
    <div class="c-tx__body">
      <div class="c-tx__title">${esc(r.estabelecimento || r.descricao || '—')}</div>
      <div class="c-tx__meta">${d.slice(8,10)}/${d.slice(5,7)} · ${CATS[r.categoria] || ''} ${esc(r.categoria)}${r.metodo ? ' · ' + esc(r.metodo) : ''}</div>
    </div>
    <div class="c-tx__value num">${brl(Number(r.valor))}</div>
  </div>`
}

export const empty = (icon_, text) => `
  <div class="c-empty"><div class="c-empty__icon" aria-hidden="true">${icon_}</div>${text}</div>`

export const skeleton = () => `
  <div class="c-stat"><div class="c-skel" style="height:56px;max-width:240px;margin:0 auto"></div></div>
  <div class="c-card"><div class="c-skel" style="height:120px"></div></div>
  <div class="c-card" style="margin-top:12px"><div class="c-skel" style="height:180px"></div></div>`

export function toast(msg) {
  const t = document.createElement('div')
  t.className = 'c-toast'
  t.setAttribute('role', 'status')
  t.textContent = msg
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 2600)
}

/** Bottom sheet (mobile) / centered modal (desktop). */
export function sheet(innerHTML) {
  const ov = document.createElement('div')
  ov.className = 'c-overlay'
  ov.innerHTML = `<div class="c-sheet" role="dialog" aria-modal="true">${innerHTML}</div>`
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove() })
  document.body.appendChild(ov)
  return ov
}

const TABS = [
  ['resumo', 'home', 'Resumo'],
  ['relatorios', 'chart', 'Relatórios'],
  ['tabela', 'table', 'Tabela'],
]
export const nav = active => `
  <nav class="c-nav" aria-label="Navegação principal">
    <span class="c-nav__brand"><img src="icon.svg" alt="">Gastos</span>
    ${TABS.map(([t, ic, label]) => `
      <button class="c-nav__item" data-t="${t}" ${active === t ? 'aria-current="page"' : ''}>
        ${icon(ic, 20)}${label}</button>`).join('')}
    <button class="c-nav__item c-nav__item--theme" id="nav-theme" aria-label="Alternar tema"></button>
  </nav>
  <button class="c-fab" id="nav-add" aria-label="Adicionar gasto">${icon('plus', 26)}</button>`
