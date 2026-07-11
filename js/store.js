// Data store + every aggregation the views need.
// Product rule: NEVER aggregate or rank spending by person — the couple
// tracks what drains the money, not who spends it.
import { sb } from './supabase.js'

export const CATS = {
  'Alimentação':'🍔', 'Mercado':'🛒', 'Transporte':'🚗', 'Moradia':'🏠', 'Saúde':'💊',
  'Educação':'📚', 'Lazer':'🎉', 'Assinaturas':'📺', 'Vestuário':'👕', 'Outros':'📦',
}

export const state = { rows: [], user: null }

/* ---- formatting ---- */
export const brl = v => (v ?? 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
export const brlShort = v => v >= 1000
  ? (v/1000).toLocaleString('pt-BR', { maximumFractionDigits:1 }) + 'k'
  : String(Math.round(v))
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))

/* ---- dates (America/Sao_Paulo) ---- */
export const todayISO = () => new Date().toLocaleDateString('sv-SE', { timeZone:'America/Sao_Paulo' })
export const monthKey = d => (d || '').slice(0, 7)
export const dateOf = r => r.data || (r.received_at || '').slice(0, 10)
export const monthLabel = (ym, style = 'long') => new Date(ym + '-15T12:00:00')
  .toLocaleDateString('pt-BR', { month: style, ...(style === 'long' ? { year:'numeric' } : {}) })
export const shiftMonth = (ym, n) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 15)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
export const fmtBRDate = iso => {
  const [y, mo, d] = (iso || '').split('-')
  return y && mo && d ? `${d}/${mo}` : iso
}

/* ---- aggregation ---- */
export const sum = a => a.reduce((s, r) => s + Number(r.valor || 0), 0)
export const inMonth = ym => state.rows.filter(r => monthKey(dateOf(r)) === ym)

export function byCategory(rows) {
  const m = {}
  for (const r of rows) m[r.categoria] = (m[r.categoria] || 0) + Number(r.valor)
  return Object.entries(m).sort((a, b) => b[1] - a[1])
}

/** Spend in `ym` up to (and incl.) day-of-month `day` — for honest comparisons. */
export const monthToDay = (ym, day) =>
  sum(inMonth(ym).filter(r => Number(dateOf(r).slice(8, 10)) <= day))

/** Waterfall input: how each category changed vs last month (same-day cutoff). */
export function monthDeltas(topN = 6) {
  const today = todayISO(), ym = monthKey(today), day = Number(today.slice(8, 10))
  const prev = shiftMonth(ym, -1)
  const curCat = Object.fromEntries(byCategory(inMonth(ym)))
  const prevCat = Object.fromEntries(byCategory(inMonth(prev).filter(r => Number(dateOf(r).slice(8, 10)) <= day)))
  const cats = [...new Set([...Object.keys(curCat), ...Object.keys(prevCat)])]
  let deltas = cats
    .map(c => ({ cat: c, delta: (curCat[c] || 0) - (prevCat[c] || 0) }))
    .filter(d => Math.abs(d.delta) >= 1)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  if (deltas.length > topN) {
    const rest = deltas.slice(topN).reduce((s, d) => s + d.delta, 0)
    deltas = deltas.slice(0, topN)
    if (Math.abs(rest) >= 1) deltas.push({ cat: 'Outras', delta: rest })
  }
  return { prevYm: prev, ym, day, prevTotal: monthToDay(prev, day), curTotal: sum(inMonth(ym)), deltas }
}

/** The app's core: what is draining the money. Never per-person. */
export function insights() {
  const today = todayISO(), ym = monthKey(today), day = Number(today.slice(8, 10))
  const daysInMonth = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()
  const cur = inMonth(ym), total = sum(cur)
  const out = []
  if (!total) return out

  const cats = byCategory(cur)
  const [topCat, topVal] = cats[0]
  const share = topVal / total * 100
  if (share >= 25) out.push(`💧 <b>${esc(topCat)}</b> é o maior dreno do mês: ${share.toFixed(0)}% de tudo (${brl(topVal)})`)

  const prevMonths = [-1, -2, -3].map(n => shiftMonth(ym, n)).filter(m => inMonth(m).length)
  if (prevMonths.length && day >= 5) {
    for (const [c, v] of cats.slice(0, 6)) {
      const avg = prevMonths.reduce((s, m) => s + sum(inMonth(m).filter(r => r.categoria === c)), 0) / prevMonths.length
      const proj = v / day * daysInMonth
      if (avg >= 50 && proj > avg * 1.25)
        out.push(`📈 <b>${esc(c)}</b> acelerou: ritmo de ${brl(proj)} este mês (+${((proj / avg - 1) * 100).toFixed(0)}% vs média)`)
      if (out.length >= 3) break
    }
  }

  if (out.length < 3) {
    const byPlace = {}
    for (const r of cur) {
      const k = (r.estabelecimento || '').toLowerCase().trim()
      if (!k) continue
      byPlace[k] = byPlace[k] || { n: 0, v: 0, name: r.estabelecimento }
      byPlace[k].n++; byPlace[k].v += Number(r.valor)
    }
    const rep = Object.values(byPlace).filter(p => p.n >= 3).sort((a, b) => b.v - a.v)[0]
    if (rep) out.push(`🔁 <b>${esc(rep.name)}</b>: ${rep.n}× este mês, ${brl(rep.v)} no total`)
  }
  return out.slice(0, 3)
}

/* ---- IO ---- */
export async function loadRows() {
  const since = shiftMonth(monthKey(todayISO()), -12) + '-01'
  const { data, error } = await sb.from('gastos').select('*').gte('data', since)
    .order('data', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  state.rows = data
}

export async function addExpense(rec) {
  const { error } = await sb.from('gastos').insert(rec)
  if (error) throw error
  state.rows.unshift(rec)
  state.rows.sort((a, b) => dateOf(b).localeCompare(dateOf(a)))
}
