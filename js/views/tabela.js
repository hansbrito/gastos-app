// Tabela: every expense of a month, tap a row to correct or delete it.
// Mobile-first: essential columns always visible; extra columns join on ≥700px.
import { state, brl, esc, todayISO, monthKey, monthLabel, inMonth, sum, dateOf, CATS,
         isIncome, isExpenseRec } from '../store.js'
import { card, empty } from '../ui.js'
import { openExpenseSheet } from './expense-sheet.js'

export function renderTabela(el, selectedYm, onMonth, onChanged) {
  const curYm = monthKey(todayISO())
  const ym = selectedYm || curYm
  // every month that has data + the current one; never drop the current month
  const months = [...new Set([curYm, ...state.rows.map(r => monthKey(dateOf(r)))])]
    .filter(Boolean).sort().reverse()
  const rows = inMonth(ym)

  el.innerHTML = `
    <div style="height:10px"></div>
    <div class="c-field" style="max-width:260px">
      <label for="t-month">Mês</label>
      <select id="t-month">${months.map(m =>
        `<option value="${m}" ${m === ym ? 'selected' : ''}>${monthLabel(m)}${m === curYm ? ' (atual)' : ''}</option>`).join('')}</select>
    </div>

    ${card(rows.length ? `
      <div class="c-table-wrap">
        <table class="c-table">
          <thead><tr>
            <th>Data</th><th>Onde</th><th>Categoria</th>
            <th class="t-md">Cartão</th><th class="t-md">Método</th><th class="t-md">Quem</th>
            <th style="text-align:right">Valor</th>
          </tr></thead>
          <tbody>
            ${rows.map((r, i) => {
              const d = dateOf(r)
              return `<tr data-i="${i}" title="Tocar para corrigir">
                <td class="t-muted num">${d.slice(8,10)}/${d.slice(5,7)}</td>
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
      <p class="muted small" style="margin-top:8px">Toque em um lançamento para corrigir ou excluir.</p>`
      : empty('🧾', `Nenhum lançamento em ${monthLabel(ym)}.`))}`

  el.querySelector('#t-month').onchange = e => onMonth(e.target.value)
  for (const tr of el.querySelectorAll('tbody tr'))
    tr.onclick = () => openExpenseSheet({ rec: rows[Number(tr.dataset.i)], onDone: onChanged })
}
