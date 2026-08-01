// Tabela: every expense of a month, tap a row to correct or delete it.
// Mobile-first: essential columns always visible; extra columns join on ≥700px.
// Sortable headers + per-column filters; footer totals reflect the filter.
import { state, brl, esc, todayISO, monthKey, monthLabel, inMonth, sum, dateOf, CATS,
         isIncome, isExpenseRec } from '../store.js'
import { card, empty } from '../ui.js'
import { openExpenseSheet } from './expense-sheet.js'

// Persist sort + filters across re-renders within the session.
let sortKey = 'data', sortDir = 'desc'
const filters = { q: '', categoria: '', cartao: '', metodo: '', quem: '' }

const COLS = [
  { key: 'data', label: 'Data' },
  { key: 'estabelecimento', label: 'Onde', main: true },
  { key: 'categoria', label: 'Categoria' },
  { key: 'cartao', label: 'Cartão', md: true },
  { key: 'metodo', label: 'Método', md: true },
  { key: 'sender', label: 'Quem', md: true },
  { key: 'valor', label: 'Valor', num: true },
]

const sortVal = (r, key) => {
  if (key === 'valor') return Number(r.valor) || 0
  if (key === 'data') return dateOf(r)
  if (key === 'estabelecimento') return (r.estabelecimento || r.descricao || '').toLowerCase()
  if (key === 'sender') return (r.sender || '').toLowerCase()
  return (r[key] || '').toLowerCase()
}

export function renderTabela(el, selectedYm, onMonth, onChanged) {
  const curYm = monthKey(todayISO())
  const ym = selectedYm || curYm
  const months = [...new Set([curYm, ...state.rows.map(r => monthKey(dateOf(r)))])]
    .filter(Boolean).sort().reverse()
  const monthRows = inMonth(ym)

  const distinct = key => [...new Set(monthRows.map(r => r[key]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b)))
  const filterSelect = (id, key, label, values) => `
    <label class="t-filter">${label}
      <select id="${id}"><option value="">todos</option>${values.map(v =>
        `<option value="${esc(v)}" ${filters[key] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
    </label>`

  el.innerHTML = `
    <div style="height:10px"></div>
    <div class="t-controls">
      <label class="t-filter">Mês
        <select id="t-month">${months.map(m =>
          `<option value="${m}" ${m === ym ? 'selected' : ''}>${monthLabel(m)}${m === curYm ? ' (atual)' : ''}</option>`).join('')}</select>
      </label>
      <label class="t-filter t-filter--grow">Buscar em "Onde"
        <input id="t-q" type="search" placeholder="ex.: mercado, aluguel…" value="${esc(filters.q)}">
      </label>
      ${filterSelect('t-f-cat', 'categoria', 'Categoria', distinct('categoria'))}
      ${filterSelect('t-f-cartao', 'cartao', 'Cartão', distinct('cartao'))}
      ${filterSelect('t-f-metodo', 'metodo', 'Método', distinct('metodo'))}
      ${filterSelect('t-f-quem', 'quem', 'Quem', distinct('sender'))}
      <button id="t-clear" class="c-btn--link" type="button">limpar filtros</button>
    </div>
    <div id="t-table"></div>`

  const $ = s => el.querySelector(s)

  function apply() {
    let out = monthRows.filter(r =>
      (!filters.q || (r.estabelecimento || r.descricao || '').toLowerCase().includes(filters.q.toLowerCase())) &&
      (!filters.categoria || r.categoria === filters.categoria) &&
      (!filters.cartao || (r.cartao || '') === filters.cartao) &&
      (!filters.metodo || (r.metodo || '') === filters.metodo) &&
      (!filters.quem || (r.sender || '') === filters.quem))
    out = out.slice().sort((a, b) => {
      const va = sortVal(a, sortKey), vb = sortVal(b, sortKey)
      const c = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === 'asc' ? c : -c
    })
    return out
  }

  function paint() {
    const rows = apply()
    const arrow = k => sortKey === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''
    const head = COLS.map(c =>
      `<th class="${c.md ? 't-md ' : ''}t-sort" data-sort="${c.key}"
           ${c.num ? 'style="text-align:right"' : ''}
           role="button" tabindex="0" aria-sort="${sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}"
           title="Ordenar por ${c.label}">${c.label}${arrow(c.key)}</th>`).join('')

    $('#t-table').innerHTML = rows.length ? card(`
      <div class="c-table-wrap">
        <table class="c-table">
          <thead><tr>${head}</tr></thead>
          <tbody>
            ${rows.map((r, i) => {
              const d = dateOf(r)
              return `<tr data-i="${i}" title="Tocar para corrigir">
                <td class="t-muted num">${d.slice(8, 10)}/${d.slice(5, 7)}</td>
                <td class="t-main">${esc(r.estabelecimento || r.descricao || '—')}</td>
                <td class="t-cat">${CATS[r.categoria] || ''} <span class="t-md-inline">${esc(r.categoria)}</span></td>
                <td class="t-md t-muted">${esc(r.cartao || '—')}</td>
                <td class="t-md t-muted">${esc(r.metodo || '—')}</td>
                <td class="t-md"><span class="t-avatar" title="${esc(r.sender || '')}">${esc((r.sender || '?').trim()[0]?.toUpperCase() || '?')}</span></td>
                <td class="t-num num" ${isIncome(r) ? 'style="color:var(--color-positive)"' : ''}>${isIncome(r) ? '+' : ''}${brl(Number(r.valor))}</td>
              </tr>`
            }).join('')}
          </tbody>
          <tfoot><tr>
            <th colspan="3" style="border-bottom:0">Saídas ${brl(sum(rows.filter(isExpenseRec)))} · Entradas ${brl(sum(rows.filter(isIncome)))} · ${rows.length} lançamento${rows.length > 1 ? 's' : ''}</th>
            <th class="t-md" colspan="3" style="border-bottom:0"></th>
            <th class="t-num num" style="border-bottom:0;font-size:var(--text-sm);color:var(--color-text)">${brl(sum(rows.filter(isIncome)) - sum(rows.filter(isExpenseRec)))}</th>
          </tr></tfoot>
        </table>
      </div>
      <p class="muted small" style="margin-top:8px">Toque em um lançamento para corrigir ou excluir.</p>`)
      : empty('🧾', monthRows.length ? 'Nenhum lançamento com esses filtros.' : `Nenhum lançamento em ${monthLabel(ym)}.`)

    for (const th of $('#t-table').querySelectorAll('.t-sort')) {
      const go = () => {
        const k = th.dataset.sort
        if (sortKey === k) sortDir = sortDir === 'asc' ? 'desc' : 'asc'
        else { sortKey = k; sortDir = k === 'valor' || k === 'data' ? 'desc' : 'asc' }
        paint()
      }
      th.onclick = go
      th.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() } }
    }
    for (const tr of $('#t-table').querySelectorAll('tbody tr'))
      tr.onclick = () => openExpenseSheet({ rec: rows[Number(tr.dataset.i)], onDone: onChanged })
  }

  $('#t-month').onchange = e => onMonth(e.target.value)
  $('#t-q').oninput = e => { filters.q = e.target.value; paint() }
  $('#t-f-cat').onchange = e => { filters.categoria = e.target.value; paint() }
  $('#t-f-cartao').onchange = e => { filters.cartao = e.target.value; paint() }
  $('#t-f-metodo').onchange = e => { filters.metodo = e.target.value; paint() }
  $('#t-f-quem').onchange = e => { filters.quem = e.target.value; paint() }
  $('#t-clear').onclick = () => {
    filters.q = filters.categoria = filters.cartao = filters.metodo = filters.quem = ''
    for (const id of ['#t-q', '#t-f-cat', '#t-f-cartao', '#t-f-metodo', '#t-f-quem']) $(id).value = ''
    paint()
  }

  paint()
}
