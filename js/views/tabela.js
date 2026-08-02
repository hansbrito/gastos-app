// Tabela: the month's realized entries + its projected bills (contas/parcelas
// still to fall due), mixed in one list. Sortable headers; per-column filters
// live in a filter row under the headers, so the top bar stays minimal.
// Tap a row to correct it (realized) or adjust the underlying conta/dívida.
import { state, brl, esc, todayISO, monthKey, monthLabel, inMonth, sum, dateOf, refMonth, CATS,
         isIncome, isExpenseRec, isNeutral, contasOcorrencias, dividaVenceEm } from '../store.js'
import { card, empty } from '../ui.js'
import { openExpenseSheet } from './expense-sheet.js'
import { openContaSheet, openDividaSheet } from './contas.js'

// Persist sort + filters across re-renders within the session.
let sortKey = 'data', sortDir = 'desc'
const filters = { q: '', categoria: '', cartao: '', metodo: '', quem: '', ver: '' }

// Columns: `filter` names the per-column filter (in the filter row); md = desktop-only.
const COLS = [
  // widths in rem (relative to root font, predictable & scalable — not fixed px)
  { key: 'data', label: 'Data', w: '4.4rem' },
  { key: 'ref', label: 'Ref', md: true, w: '4.4rem' },
  { key: 'onde', label: 'Onde', main: true }, // no width → takes the remaining space
  { key: 'categoria', label: 'Categoria', filter: 'categoria', field: 'categoria', w: '9.4rem' },
  { key: 'cartao', label: 'Cartão', md: true, filter: 'cartao', field: 'cartao', w: '7.4rem' },
  { key: 'metodo', label: 'Método', md: true, filter: 'metodo', field: 'metodo', w: '5.8rem' },
  { key: 'sender', label: 'Quem', md: true, filter: 'quem', field: 'sender', w: '4.2rem' },
  { key: 'valor', label: 'Valor', num: true, w: '7rem' },
]

const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const fmtRef = ym => ym ? `${MES3[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}` : '—'
const sortVal = (it, key) => key === 'valor' ? it.valor : String(it[key] || '').toLowerCase()

/** Realized entries + projected bills of `ym`, as one normalized list. */
function monthItems(ym) {
  const items = []
  for (const r of inMonth(ym)) {
    const pay = monthKey(dateOf(r))
    items.push({
      kind: 'real', ref: refMonth(r), refOverride: !!r.competencia && r.competencia !== pay,
      obj: r, previsto: false, neutral: isNeutral(r),
      data: dateOf(r), onde: r.estabelecimento || r.descricao || '—',
      categoria: r.categoria || '', catLabel: `${CATS[r.categoria] || ''} ${esc(r.categoria || '—')}`,
      cartao: r.cartao || '', metodo: r.metodo || '', sender: r.sender || '',
      valor: Number(r.valor) || 0, tipo: r.tipo || 'despesa',
    })
  }

  // dívidas with a parcela due this month (source of truth for their installments)
  const dividasMes = state.dividas.filter(d => d.ativo && dividaVenceEm(d, ym))
  const matchDivida = v => dividasMes.some(d => Math.abs(Number(d.valor_parcela) - v) <= Math.max(v * 0.01, 0.5))

  const realizadas = inMonth(ym).filter(isExpenseRec)
  const temGasto = v => realizadas.some(r => Math.abs((Number(r.valor) || 0) - v) <= Math.max(v * 0.01, 0.5))

  // contas of the month: unpaid → previsto; paid but with no matching gasto →
  // realized (so a bill marked paid still shows and counts). Skip when a dívida
  // is the source of truth, or when a realized gasto already covers it.
  for (const o of contasOcorrencias(`${ym}-01`, `${ym}-31`)) {
    const v = Number(o.conta.valor) || 0
    if (v && matchDivida(v)) continue
    if (o.pago && temGasto(v)) continue // already counted as a realized gasto
    const paga = !!o.pago
    items.push({
      kind: 'conta', obj: o.conta, previsto: !paga, neutral: false, paga,
      ref: o.data.slice(0, 7), refOverride: false,
      data: o.data, onde: o.conta.descricao || 'Conta',
      categoria: '', catLabel: paga ? '📄 conta paga' : '📄 conta a pagar',
      cartao: '', metodo: o.conta.linha_digitavel ? 'boleto' : '', sender: '',
      valor: v, tipo: 'despesa',
    })
  }

  // projected dívida parcelas, unless a realized despesa already matches the value
  for (const d of dividasMes) {
    const v = Number(d.valor_parcela) || 0
    if (realizadas.some(r => Math.abs((Number(r.valor) || 0) - v) <= Math.max(v * 0.01, 0.5))) continue
    items.push({
      kind: 'divida', obj: d, previsto: true, neutral: false, ref: ym, refOverride: false,
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
  const months = [...new Set([curYm, ...state.rows.map(refMonth)])].filter(Boolean).sort().reverse()
  const all = monthItems(ym)
  const distinct = field => [...new Set(all.map(r => r[field]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)))

  el.innerHTML = `
    <div style="height:10px"></div>
    <div class="t-top">
      <label class="t-filter t-filter--grow">Buscar
        <input id="t-q" type="search" placeholder="mercado, aluguel, farmácia…" value="${esc(filters.q)}">
      </label>
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
      <button id="t-clear" class="t-clear" type="button" hidden>✕ limpar filtros</button>
    </div>
    <div id="t-table"></div>`

  const $ = s => el.querySelector(s)
  const $$ = s => el.querySelectorAll(s)

  function syncActive() {
    const any = ['categoria', 'cartao', 'metodo', 'quem', 'ver'].some(k => filters[k]) || !!filters.q
    $('#t-clear').hidden = !any
    $('#t-q').classList.toggle('is-active', !!filters.q)
    $('#t-ver').classList.toggle('is-active', !!filters.ver)
  }

  function apply() {
    let out = all.filter(it =>
      (!filters.ver || (filters.ver === 'previsto' ? it.previsto : !it.previsto)) &&
      (!filters.q || it.onde.toLowerCase().includes(filters.q.toLowerCase())) &&
      (!filters.categoria || it.categoria === filters.categoria) &&
      (!filters.cartao || it.cartao === filters.cartao) &&
      (!filters.metodo || it.metodo === filters.metodo) &&
      (!filters.quem || it.sender === filters.quem))
    return out.slice().sort((a, b) => {
      const va = sortVal(a, sortKey), vb = sortVal(b, sortKey)
      const c = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === 'asc' ? c : -c
    })
  }

  function paint() {
    const rows = apply()
    const realOut = sum(rows.filter(it => !it.previsto && !it.neutral && it.tipo !== 'receita').map(it => ({ valor: it.valor })))
    const realIn = sum(rows.filter(it => !it.previsto && !it.neutral && it.tipo === 'receita').map(it => ({ valor: it.valor })))
    const prev = sum(rows.filter(it => it.previsto).map(it => ({ valor: it.valor })))
    const arrow = k => sortKey === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''
    const head = COLS.map(c =>
      `<th class="${c.md ? 't-md ' : ''}t-sort" data-sort="${c.key}" style="${c.w ? `width:${c.w};` : ''}${c.num ? 'text-align:right' : ''}"
           role="button" tabindex="0" aria-sort="${sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}"
           title="Ordenar por ${c.label}">${c.label}${arrow(c.key)}</th>`).join('')
    const filterRow = COLS.map(c => {
      if (!c.filter) return `<th class="${c.md ? 't-md' : ''}"></th>`
      const vals = distinct(c.field)
      return `<th class="${c.md ? 't-md' : ''}"><select class="t-colfilter${filters[c.filter] ? ' is-active' : ''}" data-fk="${c.filter}">
        <option value="">todos</option>${vals.map(v => `<option value="${esc(v)}" ${filters[c.filter] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></th>`
    }).join('')

    $('#t-table').innerHTML = rows.length ? card(`
      <div class="c-table-wrap">
        <table class="c-table">
          <thead><tr>${head}</tr><tr class="t-filterrow">${filterRow}</tr></thead>
          <tbody>
            ${rows.map((it, i) => {
              const d = it.data, isInc = it.tipo === 'receita'
              return `<tr data-i="${i}" class="${it.previsto ? 't-previsto' : ''}" title="${it.previsto ? 'Tocar para ajustar' : 'Tocar para corrigir'}">
                <td data-label="Data" class="t-muted num">${d.slice(8, 10)}/${d.slice(5, 7)}</td>
                <td data-label="Ref" class="t-md num ${it.refOverride ? 't-ref-over' : 't-muted'}">${fmtRef(it.ref)}</td>
                <td data-label="Onde" class="t-main">${esc(it.onde)}${it.previsto ? ' <span class="c-chip c-chip--neutral t-tag">previsto</span>' : it.paga ? ' <span class="c-chip c-chip--positive t-tag">pago</span>' : it.neutral ? ' <span class="c-chip c-chip--neutral t-tag">transferência</span>' : ''}</td>
                <td data-label="Categoria" class="t-cat"><span class="t-md-inline">${it.catLabel}</span></td>
                <td data-label="Cartão" class="t-md t-muted">${esc(it.cartao || '—')}</td>
                <td data-label="Método" class="t-md t-muted">${esc(it.metodo || '—')}</td>
                <td data-label="Quem" class="t-md">${it.kind !== 'real' ? '<span class="t-muted">—</span>' : `<span class="t-avatar" title="${esc(it.sender)}">${esc((it.sender || '?').trim()[0]?.toUpperCase() || '?')}</span>`}</td>
                <td data-label="Valor" class="t-num num" ${isInc ? 'style="color:var(--color-positive)"' : ''}>${isInc ? '+' : ''}${brl(it.valor)}</td>
              </tr>`
            }).join('')}
          </tbody>
          <tfoot><tr>
            <th colspan="4" style="border-bottom:0">Realizado: saídas ${brl(realOut)} · entradas ${brl(realIn)}${prev ? ` · Previsto ${brl(prev)}` : ''} · ${rows.length} item${rows.length > 1 ? 's' : ''}</th>
            <th class="t-md" colspan="2" style="border-bottom:0"></th>
            <th class="t-md" style="border-bottom:0;text-align:right;font-size:var(--text-xs);color:var(--color-text-muted)">esperado</th>
            <th class="t-num num" style="border-bottom:0;font-size:var(--text-sm);color:var(--color-text)">${brl(realOut + prev)}</th>
          </tr></tfoot>
        </table>
      </div>
      <p class="muted small" style="margin-top:8px">Toque num lançamento para corrigir; num <b>previsto</b> para ajustar a conta/dívida.</p>`)
      : empty('🧾', all.length ? 'Nada com esses filtros.' : `Nenhum lançamento ou conta prevista em ${monthLabel(ym)}.`)

    for (const th of $$('#t-table .t-sort')) {
      const go = () => {
        const k = th.dataset.sort
        if (sortKey === k) sortDir = sortDir === 'asc' ? 'desc' : 'asc'
        else { sortKey = k; sortDir = k === 'valor' || k === 'data' || k === 'ref' ? 'desc' : 'asc' }
        paint()
      }
      th.onclick = go
      th.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() } }
    }
    for (const sel of $$('#t-table .t-colfilter'))
      sel.onchange = e => { filters[sel.dataset.fk] = e.target.value; syncActive(); paint() }
    for (const tr of $$('#t-table tbody tr')) {
      const it = rows[Number(tr.dataset.i)]
      tr.onclick = () => {
        if (it.kind === 'real') openExpenseSheet({ rec: it.obj, onDone: onChanged })
        else if (it.kind === 'conta') openContaSheet(it.obj, onChanged)
        else openDividaSheet(it.obj, onChanged)
      }
    }
  }

  $('#t-month').onchange = e => onMonth(e.target.value)
  $('#t-ver').onchange = e => { filters.ver = e.target.value; syncActive(); paint() }
  $('#t-q').oninput = e => { filters.q = e.target.value; syncActive(); paint() }
  $('#t-clear').onclick = () => {
    filters.q = filters.categoria = filters.cartao = filters.metodo = filters.quem = filters.ver = ''
    $('#t-q').value = ''; $('#t-ver').value = ''
    syncActive(); paint()
  }

  syncActive()
  paint()
}
