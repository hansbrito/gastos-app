// Tabela: the month's realized entries + its projected bills (contas/parcelas
// still to fall due), mixed in one list. Tap a row to correct it (realized) or
// adjust the underlying conta/dívida (projected). Sortable + filterable.
import { state, brl, esc, todayISO, monthKey, monthLabel, inMonth, sum, dateOf, refMonth, CATS,
         isIncome, isExpenseRec, isNeutral, contasOcorrencias, dividaVenceEm } from '../store.js'
import { card, empty } from '../ui.js'
import { openExpenseSheet } from './expense-sheet.js'
import { openContaSheet, openDividaSheet } from './contas.js'

// Persist sort + filters across re-renders within the session.
let sortKey = 'data', sortDir = 'desc'
const filters = { q: '', categoria: '', cartao: '', metodo: '', quem: '', ver: '' }

const COLS = [
  { key: 'data', label: 'Data' },
  { key: 'onde', label: 'Onde', main: true },
  { key: 'categoria', label: 'Categoria' },
  { key: 'cartao', label: 'Cartão', md: true },
  { key: 'metodo', label: 'Método', md: true },
  { key: 'sender', label: 'Quem', md: true },
  { key: 'valor', label: 'Valor', num: true },
]

const sortVal = (it, key) => key === 'valor' ? it.valor : String(it[key] || '').toLowerCase()

/** Realized entries + projected bills of `ym`, as one normalized list. */
function monthItems(ym) {
  const items = []
  for (const r of inMonth(ym)) items.push({
    kind: 'real', ref: r, previsto: false, neutral: isNeutral(r),
    data: dateOf(r), onde: r.estabelecimento || r.descricao || '—',
    categoria: r.categoria || '', catLabel: `${CATS[r.categoria] || ''} ${esc(r.categoria || '—')}`,
    cartao: r.cartao || '', metodo: r.metodo || '', sender: r.sender || '',
    valor: Number(r.valor) || 0, tipo: r.tipo || 'despesa',
  })

  // dívidas with a parcela due this month (source of truth for their installments)
  const dividasMes = state.dividas.filter(d => d.ativo && dividaVenceEm(d, ym))
  const matchDivida = v => dividasMes.some(d => Math.abs(Number(d.valor_parcela) - v) <= Math.max(v * 0.01, 0.5))

  // projected contas: unpaid occurrences, minus any that a dívida already covers
  for (const o of contasOcorrencias(`${ym}-01`, `${ym}-31`)) {
    if (o.pago) continue
    const v = Number(o.conta.valor) || 0
    if (v && matchDivida(v)) continue
    items.push({
      kind: 'conta', ref: o.conta, previsto: true,
      data: o.data, onde: o.conta.descricao || 'Conta',
      categoria: '', catLabel: '📄 conta a pagar',
      cartao: '', metodo: o.conta.linha_digitavel ? 'boleto' : '', sender: '',
      valor: v, tipo: 'despesa',
    })
  }

  // projected dívida parcelas, unless a realized despesa already matches the value
  const realizadas = inMonth(ym).filter(isExpenseRec)
  for (const d of dividasMes) {
    const v = Number(d.valor_parcela) || 0
    if (realizadas.some(r => Math.abs((Number(r.valor) || 0) - v) <= Math.max(v * 0.01, 0.5))) continue
    items.push({
      kind: 'divida', ref: d, previsto: true,
      data: `${ym}-${String(d.dia_vencimento).padStart(2, '0')}`,
      onde: d.credor, categoria: '', catLabel: '📆 parcela de dívida',
      cartao: '', metodo: '', sender: '', valor: v, tipo: 'despesa',
    })
  }
  return items
}

export function renderTabela(el, selectedYm, onMonth, onChanged) {
  const curYm = monthKey(todayISO())
  const ym = selectedYm || curYm
  const months = [...new Set([curYm, ...state.rows.map(refMonth)])]
    .filter(Boolean).sort().reverse()
  const all = monthItems(ym)

  const distinct = key => [...new Set(all.map(r => r[key]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b)))
  const filterSelect = (id, key, label, values) => `
    <label class="t-filter">${label}
      <select id="${id}"><option value="">todos</option>${values.map(v =>
        `<option value="${esc(v)}" ${filters[key] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
    </label>`

  el.innerHTML = `
    <div style="height:10px"></div>
    <div class="t-controls">
      <div class="t-filters">
        <label class="t-filter">Mês
          <select id="t-month">${months.map(m =>
            `<option value="${m}" ${m === ym ? 'selected' : ''}>${monthLabel(m)}${m === curYm ? ' (atual)' : ''}</option>`).join('')}</select>
        </label>
        <label class="t-filter">Ver
          <select id="t-ver">
            <option value="" ${filters.ver === '' ? 'selected' : ''}>tudo</option>
            <option value="real" ${filters.ver === 'real' ? 'selected' : ''}>só realizado</option>
            <option value="previsto" ${filters.ver === 'previsto' ? 'selected' : ''}>só previsto</option>
          </select>
        </label>
        <label class="t-filter t-filter--grow">Buscar
          <input id="t-q" type="search" placeholder="mercado, aluguel, farmácia…" value="${esc(filters.q)}">
        </label>
        ${filterSelect('t-f-cat', 'categoria', 'Categoria', distinct('categoria'))}
        ${filterSelect('t-f-cartao', 'cartao', 'Cartão', distinct('cartao'))}
        ${filterSelect('t-f-metodo', 'metodo', 'Método', distinct('metodo'))}
        ${filterSelect('t-f-quem', 'quem', 'Quem', distinct('sender'))}
      </div>
      <div class="t-actions">
        <button id="t-clear" class="t-clear" type="button" hidden>✕ limpar filtros</button>
      </div>
    </div>
    <div id="t-table"></div>`

  const $ = s => el.querySelector(s)

  // Light up active filters in cobalt and reveal "limpar" only when something is filtered.
  const ACTIVE = { '#t-ver': 'ver', '#t-q': 'q', '#t-f-cat': 'categoria', '#t-f-cartao': 'cartao', '#t-f-metodo': 'metodo', '#t-f-quem': 'quem' }
  function syncActive() {
    let any = false
    for (const [sel, key] of Object.entries(ACTIVE)) {
      const on = !!filters[key]
      $(sel).classList.toggle('is-active', on)
      if (on) any = true
    }
    $('#t-clear').hidden = !any
  }

  function apply() {
    let out = all.filter(it =>
      (!filters.ver || (filters.ver === 'previsto' ? it.previsto : !it.previsto)) &&
      (!filters.q || it.onde.toLowerCase().includes(filters.q.toLowerCase())) &&
      (!filters.categoria || it.categoria === filters.categoria) &&
      (!filters.cartao || it.cartao === filters.cartao) &&
      (!filters.metodo || it.metodo === filters.metodo) &&
      (!filters.quem || it.sender === filters.quem))
    out = out.slice().sort((a, b) => {
      const va = sortVal(a, sortKey), vb = sortVal(b, sortKey)
      const c = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === 'asc' ? c : -c
    })
    return out
  }

  function paint() {
    const rows = apply()
    const realOut = sum(rows.filter(it => !it.previsto && !it.neutral && it.tipo !== 'receita').map(it => ({ valor: it.valor })))
    const realIn = sum(rows.filter(it => !it.previsto && !it.neutral && it.tipo === 'receita').map(it => ({ valor: it.valor })))
    const prev = sum(rows.filter(it => it.previsto).map(it => ({ valor: it.valor })))
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
            ${rows.map((it, i) => {
              const d = it.data
              const isInc = it.tipo === 'receita'
              return `<tr data-i="${i}" class="${it.previsto ? 't-previsto' : ''}" title="${it.previsto ? 'Tocar para ajustar' : 'Tocar para corrigir'}">
                <td class="t-muted num">${d.slice(8, 10)}/${d.slice(5, 7)}</td>
                <td class="t-main">${esc(it.onde)}${it.previsto ? ' <span class="c-chip c-chip--neutral t-tag">previsto</span>' : it.neutral ? ' <span class="c-chip c-chip--neutral t-tag">transferência</span>' : ''}</td>
                <td class="t-cat"><span class="t-md-inline">${it.catLabel}</span></td>
                <td class="t-md t-muted">${esc(it.cartao || '—')}</td>
                <td class="t-md t-muted">${esc(it.metodo || '—')}</td>
                <td class="t-md">${it.previsto ? '<span class="t-muted">—</span>' : `<span class="t-avatar" title="${esc(it.sender)}">${esc((it.sender || '?').trim()[0]?.toUpperCase() || '?')}</span>`}</td>
                <td class="t-num num" ${isInc ? 'style="color:var(--color-positive)"' : ''}>${isInc ? '+' : ''}${brl(it.valor)}</td>
              </tr>`
            }).join('')}
          </tbody>
          <tfoot><tr>
            <th colspan="3" style="border-bottom:0">Realizado: saídas ${brl(realOut)} · entradas ${brl(realIn)}${prev ? ` · Previsto ${brl(prev)}` : ''} · ${rows.length} item${rows.length > 1 ? 's' : ''}</th>
            <th class="t-md" colspan="2" style="border-bottom:0"></th>
            <th class="t-md" style="border-bottom:0;text-align:right;font-size:var(--text-xs);color:var(--color-text-muted)">esperado</th>
            <th class="t-num num" style="border-bottom:0;font-size:var(--text-sm);color:var(--color-text)">${brl(realOut + prev)}</th>
          </tr></tfoot>
        </table>
      </div>
      <p class="muted small" style="margin-top:8px">Toque num lançamento para corrigir; num <b>previsto</b> para ajustar a conta/dívida.</p>`)
      : empty('🧾', all.length ? 'Nada com esses filtros.' : `Nenhum lançamento ou conta prevista em ${monthLabel(ym)}.`)

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
    for (const tr of $('#t-table').querySelectorAll('tbody tr')) {
      const it = rows[Number(tr.dataset.i)]
      tr.onclick = () => {
        if (it.kind === 'real') openExpenseSheet({ rec: it.ref, onDone: onChanged })
        else if (it.kind === 'conta') openContaSheet(it.ref, onChanged)
        else openDividaSheet(it.ref, onChanged)
      }
    }
  }

  $('#t-month').onchange = e => onMonth(e.target.value)
  $('#t-ver').onchange = e => { filters.ver = e.target.value; syncActive(); paint() }
  $('#t-q').oninput = e => { filters.q = e.target.value; syncActive(); paint() }
  $('#t-f-cat').onchange = e => { filters.categoria = e.target.value; syncActive(); paint() }
  $('#t-f-cartao').onchange = e => { filters.cartao = e.target.value; syncActive(); paint() }
  $('#t-f-metodo').onchange = e => { filters.metodo = e.target.value; syncActive(); paint() }
  $('#t-f-quem').onchange = e => { filters.quem = e.target.value; syncActive(); paint() }
  $('#t-clear').onclick = () => {
    filters.q = filters.categoria = filters.cartao = filters.metodo = filters.quem = filters.ver = ''
    for (const id of ['#t-q', '#t-f-cat', '#t-f-cartao', '#t-f-metodo', '#t-f-quem', '#t-ver']) $(id).value = ''
    syncActive(); paint()
  }

  syncActive()
  paint()
}
