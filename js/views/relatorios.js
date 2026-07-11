import { state, brl, todayISO, monthKey, monthLabel, shiftMonth, inMonth, sum,
         byCategory, monthDeltas, dateOf } from '../store.js'
import { card, catRow, empty } from '../ui.js'
import { monthlyBars, waterfall } from '../charts.js'

export function renderRelatorios(el, repRange, onRange) {
  const ym = monthKey(todayISO())
  const n = repRange === '3m' ? 4 : 12
  const months = Array.from({ length: n }, (_, i) => shiftMonth(ym, -(n - 1 - i)))
  const period = state.rows.filter(r => monthKey(dateOf(r)) >= months[0])
  const totalPeriod = sum(period)
  const monthsWithData = new Set(period.map(r => monthKey(dateOf(r)))).size || 1
  const cats = byCategory(period)
  const maxCat = cats[0]?.[1] || 1
  const wf = monthDeltas()

  el.innerHTML = `
    <div style="height:10px"></div>
    <div class="c-seg l-span2" role="tablist" aria-label="Período" style="max-width:420px">
      <button role="tab" data-r="3m" aria-selected="${repRange === '3m'}">Últimos 3 meses</button>
      <button role="tab" data-r="12m" aria-selected="${repRange === '12m'}">12 meses</button>
    </div>

    <div class="l-grid">
      <section>
        ${card(`
          <div id="chart-months" class="c-chart" role="img" aria-label="Gastos por mês"></div>
          <div style="display:flex;justify-content:space-around;text-align:center;border-top:1px solid var(--color-border);padding-top:12px">
            <div><div class="muted small">Total período</div><b class="num">${brl(totalPeriod)}</b></div>
            <div><div class="muted small">Média/mês</div><b class="num">${brl(totalPeriod / monthsWithData)}</b></div>
          </div>`)}
      </section>

      <section>
        <h2 style="margin-top:0">O que mudou vs ${monthLabel(wf.prevYm, 'short')} (até o dia ${wf.day})</h2>
        ${wf.deltas.length
          ? card(`<div id="chart-wf" class="c-chart c-chart--tall" role="img"
                  aria-label="Variação de gastos por categoria vs mês anterior"></div>
                  <p class="muted small" style="text-align:center;margin-top:4px">
                    vermelho = gastamos mais · verde = economizamos</p>`)
          : card(empty('🌊', 'Sem dados suficientes para comparar com o mês passado.'))}
      </section>

      <section class="l-span2">
        <h2>Por categoria no período</h2>
        ${card(cats.length
          ? cats.map(([name, value]) => catRow({ name, value, max: maxCat, aside: `${brl(value / monthsWithData)}/mês` })).join('')
          : empty('🧾', 'Sem dados no período.'))}
      </section>
    </div>`

  for (const b of el.querySelectorAll('.c-seg button')) b.onclick = () => onRange(b.dataset.r)

  monthlyBars(el.querySelector('#chart-months'), months.map(m => ({
    label: monthLabel(m, 'short').replace('.', ''),
    value: sum(inMonth(m)),
    on: m === ym,
  })))

  if (wf.deltas.length) waterfall(el.querySelector('#chart-wf'), {
    prevLabel: monthLabel(wf.prevYm, 'short').replace('.', ''),
    curLabel: monthLabel(wf.ym, 'short').replace('.', ''),
    prevTotal: wf.prevTotal,
    curTotal: wf.curTotal,
    deltas: wf.deltas,
  })
}
