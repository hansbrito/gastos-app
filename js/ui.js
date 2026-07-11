// Reusable component renderers. Pure functions: data in → HTML string out.
// All dynamic text goes through esc() — no exceptions.
import { esc, brl, CATS, dateOf } from './store.js'

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
  <div class="c-cat">
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

export const empty = (icon, text) => `
  <div class="c-empty"><div class="c-empty__icon" aria-hidden="true">${icon}</div>${text}</div>`

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

/** Bottom sheet. Returns the root; caller wires its inner controls. */
export function sheet(innerHTML) {
  const ov = document.createElement('div')
  ov.className = 'c-overlay'
  ov.innerHTML = `<div class="c-sheet" role="dialog" aria-modal="true">${innerHTML}</div>`
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove() })
  document.body.appendChild(ov)
  return ov
}

export const nav = active => `
  <nav class="c-nav" aria-label="Navegação principal">
    <button class="c-nav__item" data-t="resumo" ${active === 'resumo' ? 'aria-current="page"' : ''}>
      <span class="ic" aria-hidden="true">🏠</span>Resumo</button>
    <button class="c-nav__fab" id="nav-add" aria-label="Adicionar gasto">+</button>
    <button class="c-nav__item" data-t="relatorios" ${active === 'relatorios' ? 'aria-current="page"' : ''}>
      <span class="ic" aria-hidden="true">📊</span>Relatórios</button>
  </nav>`
