import { state, brl, esc, todayISO, monthKey, monthLabel, shiftMonth, inMonth, sum,
         expensesIn, incomesIn, monthToDay, byCategory, insights } from '../store.js'
import { card, stat, chip, catRow, txRow, empty } from '../ui.js'
import { ALLOWED } from '../supabase.js'
import { installAvailable, promptInstall } from '../install.js'

function paceChip() {
  const today = todayISO(), ym = monthKey(today), day = Number(today.slice(8, 10))
  const prevYm = shiftMonth(ym, -1)
  const cur = sum(expensesIn(ym))
  const prevSameDay = monthToDay(prevYm, day)
  if (!prevSameDay) return ''
  const d = (cur - prevSameDay) / prevSameDay * 100
  return chip(`${d <= 0 ? '↓' : '↑'} ${Math.abs(d).toFixed(0)}% vs ${monthLabel(prevYm, 'short')} até o dia ${day}`,
    d <= 0 ? 'positive' : 'negative')
}

export function renderResumo(el) {
  const today = todayISO(), ym = monthKey(today)
  const cur = expensesIn(ym), total = sum(cur)
  const inTotal = sum(incomesIn(ym))
  const day = Number(today.slice(8, 10))
  const daysInMonth = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()
  const projection = day >= 3 && total > 0 ? total / day * daysInMonth : null
  const cats = byCategory(cur)
  const maxCat = cats[0]?.[1] || 1
  const tips = insights()
  const recent = state.rows.slice(0, 8)

  el.innerHTML = `
    <div class="l-grid">
      <div class="l-span2">
        ${stat({
          label: `Gastamos em ${monthLabel(ym)}`,
          value: brl(total),
          chip: paceChip(),
          hint: [
            inTotal ? `Recebemos ${brl(inTotal)} · Saldo ${brl(inTotal - total)}` : '',
            projection ? `No ritmo atual: ~${brl(projection)} até o fim do mês` : '',
          ].filter(Boolean).join('<br>'),
        })}
      </div>

      <section>
        ${tips.length ? `<h2>O que está drenando</h2>` +
          card(tips.map(t => `<div style="padding:8px 0;font-size:14px">${t}</div>`).join('')) : ''}
        <h2>Para onde foi</h2>
        ${card(cats.length
          ? cats.map(([name, value]) => catRow({ name, value, max: maxCat })).join('')
          : empty('🧾', `Nenhum gasto em ${monthLabel(ym, 'short')} ainda.<br>Envie um comprovante no grupo 💬 ou toque no +`))}
      </section>

      <section>
        <h2>Últimos lançamentos</h2>
        ${card(recent.length ? recent.map(txRow).join('') : empty('✨', 'Nada ainda.'))}
      </section>
    </div>

    <p class="center">
      ${installAvailable() ? `<button class="c-btn--link" id="install">📲 instalar no celular</button> · ` : ''}
      <button class="c-btn--link" id="out">sair (${esc(ALLOWED[state.user.email] || '')})</button>
    </p>`

  const inst = el.querySelector('#install')
  if (inst) inst.onclick = promptInstall
}
