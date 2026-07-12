// Data store + every aggregation the views need.
// Product rule: NEVER aggregate or rank spending by person — the couple
// tracks what drains the money, not who spends it.
import { sb } from './supabase.js'

export const CATS = {
  'Alimentação':'🍔', 'Mercado':'🛒', 'Transporte':'🚗', 'Moradia':'🏠', 'Saúde':'💊',
  'Educação':'📚', 'Lazer':'🎉', 'Assinaturas':'📺', 'Vestuário':'👕', 'Outros':'📦',
  // receitas
  'Salário':'💼', 'Freela':'💻', 'Reembolso':'↩️', 'Investimentos':'📈', 'Outros recebimentos':'💰',
}
export const INCOME_CATS = ['Salário', 'Freela', 'Reembolso', 'Investimentos', 'Outros recebimentos']
export const EXPENSE_CATS = ['Alimentação', 'Mercado', 'Transporte', 'Moradia', 'Saúde',
  'Educação', 'Lazer', 'Assinaturas', 'Vestuário', 'Outros']

export const isIncome = r => (r.tipo || 'despesa') === 'receita'
export const isExpenseRec = r => !isIncome(r)
/** Distinct card names already used — feeds the cartão datalist. */
export const knownCards = () =>
  [...new Set([...state.cartoes.map(c => c.nome), ...state.rows.map(r => r.cartao).filter(Boolean)])].sort()

// Category identity colors (Copilot-Money-style): tiles + bars, both themes.
export const CAT_COLORS = {
  'Alimentação':'#f59e0b', 'Mercado':'#22c55e', 'Transporte':'#3b82f6', 'Moradia':'#a78bfa',
  'Saúde':'#f43f5e', 'Educação':'#eab308', 'Lazer':'#ec4899', 'Assinaturas':'#06b6d4',
  'Vestuário':'#8b5cf6', 'Outros':'#9ca3af',
  'Salário':'#10b981', 'Freela':'#34d399', 'Reembolso':'#2dd4bf', 'Investimentos':'#4ade80',
  'Outros recebimentos':'#6ee7b7',
}

export const state = { rows: [], cartoes: [], dividas: [], contas: [], user: null }

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
export const expensesIn = ym => inMonth(ym).filter(isExpenseRec)
export const incomesIn = ym => inMonth(ym).filter(isIncome)

export function byCategory(rows) {
  const m = {}
  for (const r of rows) m[r.categoria] = (m[r.categoria] || 0) + Number(r.valor)
  return Object.entries(m).sort((a, b) => b[1] - a[1])
}

/** Spend in `ym` up to (and incl.) day-of-month `day` — for honest comparisons. */
export const monthToDay = (ym, day) =>
  sum(expensesIn(ym).filter(r => Number(dateOf(r).slice(8, 10)) <= day))

/** Waterfall input: how each category changed vs last month (same-day cutoff). */
export function monthDeltas(topN = 6) {
  const today = todayISO(), ym = monthKey(today), day = Number(today.slice(8, 10))
  const prev = shiftMonth(ym, -1)
  const curCat = Object.fromEntries(byCategory(expensesIn(ym)))
  const prevCat = Object.fromEntries(byCategory(expensesIn(prev).filter(r => Number(dateOf(r).slice(8, 10)) <= day)))
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
  return { prevYm: prev, ym, day, prevTotal: monthToDay(prev, day), curTotal: sum(expensesIn(ym)), deltas }
}

/** The app's core: what is draining the money. Never per-person. */
export function insights() {
  const today = todayISO(), ym = monthKey(today), day = Number(today.slice(8, 10))
  const daysInMonth = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()
  const cur = expensesIn(ym), total = sum(cur)
  const out = []
  if (!total) return out

  const cats = byCategory(cur)
  const [topCat, topVal] = cats[0]
  const share = topVal / total * 100
  if (share >= 25) out.push(`💧 <b>${esc(topCat)}</b> é o maior dreno do mês: ${share.toFixed(0)}% de tudo (${brl(topVal)})`)

  const prevMonths = [-1, -2, -3].map(n => shiftMonth(ym, n)).filter(m => expensesIn(m).length)
  if (prevMonths.length && day >= 5) {
    for (const [c, v] of cats.slice(0, 6)) {
      const avg = prevMonths.reduce((s, m) => s + sum(expensesIn(m).filter(r => r.categoria === c)), 0) / prevMonths.length
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
  const [g, c, d, ct] = await Promise.all([
    sb.from('gastos').select('*').gte('data', since)
      .order('data', { ascending: false }).order('created_at', { ascending: false }),
    sb.from('cartoes').select('*').order('nome'),
    sb.from('dividas').select('*').order('credor'),
    sb.from('contas').select('*').eq('ativo', true).order('vencimento'),
  ])
  if (g.error) throw g.error
  state.rows = g.data
  state.cartoes = c.data || []
  state.dividas = d.data || []
  state.contas = ct.data || []
}

/* ---- cartões & dívidas ---- */
export async function saveCartao(row) {
  const { error } = await sb.from('cartoes').upsert(row)
  if (error) throw error
  const i = state.cartoes.findIndex(c => c.id === row.id)
  if (i >= 0) state.cartoes[i] = { ...state.cartoes[i], ...row }
  else state.cartoes.push(row)
  state.cartoes.sort((a, b) => a.nome.localeCompare(b.nome))
}
export async function deleteCartao(id) {
  const { error } = await sb.from('cartoes').delete().eq('id', id)
  if (error) throw error
  state.cartoes = state.cartoes.filter(c => c.id !== id)
}
export async function saveDivida(row) {
  const { error } = await sb.from('dividas').upsert(row)
  if (error) throw error
  const i = state.dividas.findIndex(d => d.id === row.id)
  if (i >= 0) state.dividas[i] = { ...state.dividas[i], ...row }
  else state.dividas.push(row)
}
export async function deleteDivida(id) {
  const { error } = await sb.from('dividas').delete().eq('id', id)
  if (error) throw error
  state.dividas = state.dividas.filter(d => d.id !== id)
}

/** Open-statement window for a card given its closing day. */
export function faturaWindow(card, todayIso = todayISO()) {
  const d = new Date(todayIso + 'T12:00:00')
  const start = new Date(d), end = new Date(d)
  if (d.getDate() > card.dia_fechamento) {
    start.setDate(card.dia_fechamento + 1)
    end.setMonth(end.getMonth() + 1); end.setDate(card.dia_fechamento)
  } else {
    start.setMonth(start.getMonth() - 1); start.setDate(card.dia_fechamento + 1)
    end.setDate(card.dia_fechamento)
  }
  const iso = x => x.toLocaleDateString('sv-SE')
  return { start: iso(start), end: iso(end) }
}

/** Sum of the card's open statement from loaded rows (fuzzy name match). */
export function faturaAberta(card) {
  const { start, end } = faturaWindow(card)
  const nome = card.nome.toLowerCase()
  return sum(state.rows.filter(r => {
    if (isIncome(r) || !r.cartao) return false
    const rc = String(r.cartao).toLowerCase()
    const match = rc === nome || rc.includes(nome) || nome.includes(rc)
    return match && dateOf(r) >= start && dateOf(r) <= end
  }))
}

/* ---- contas (bills) ---- */
export async function saveConta(row) {
  const { error } = await sb.from('contas').upsert(row)
  if (error) throw error
  const i = state.contas.findIndex(c => c.id === row.id)
  if (i >= 0) state.contas[i] = { ...state.contas[i], ...row }
  else state.contas.push(row)
  state.contas.sort((a, b) => a.vencimento.localeCompare(b.vencimento))
}
export async function deleteConta(id) {
  const { error } = await sb.from('contas').delete().eq('id', id)
  if (error) throw error
  state.contas = state.contas.filter(c => c.id !== id)
}
export async function togglePago(conta, occDate) {
  const pagos = (conta.pagos || []).includes(occDate)
    ? conta.pagos.filter(p => p !== occDate)
    : [...(conta.pagos || []), occDate]
  const { error } = await sb.from('contas').update({ pagos }).eq('id', conta.id)
  if (error) throw error
  conta.pagos = pagos
}

/** Expand occurrences of a conta within [from, to] ISO dates. */
export function ocorrencias(c, from, to) {
  const out = []
  const stepDays = { semanal: 7, quinzenal: 14 }
  const d = new Date(c.vencimento + 'T12:00:00')
  const end = c.fim ? new Date(c.fim + 'T12:00:00') : null
  const lim = new Date(to + 'T12:00:00')
  for (let i = 0; i < 200 && d <= lim; i++) {
    if (end && d > end) break
    const iso = d.toLocaleDateString('sv-SE')
    if (iso >= from && iso <= to) out.push(iso)
    if (c.recorrencia === 'unica') break
    if (stepDays[c.recorrencia]) d.setDate(d.getDate() + stepDays[c.recorrencia])
    else if (c.recorrencia === 'mensal') d.setMonth(d.getMonth() + 1)
    else if (c.recorrencia === 'semestral') d.setMonth(d.getMonth() + 6)
    else if (c.recorrencia === 'anual') d.setFullYear(d.getFullYear() + 1)
    else break
  }
  return out
}

/** All occurrences (flat) between dates with status. */
export function contasOcorrencias(from, to) {
  const today = todayISO()
  const out = []
  for (const c of state.contas) {
    for (const occ of ocorrencias(c, from, to)) {
      const pago = (c.pagos || []).includes(occ)
      out.push({ conta: c, data: occ, pago, atrasada: !pago && occ < today })
    }
  }
  return out.sort((a, b) => a.data.localeCompare(b.data))
}

export function parcelaAtual(dv, ym = monthKey(todayISO())) {
  const [y1, m1] = dv.inicio_ym.split('-').map(Number)
  const [y2, m2] = ym.split('-').map(Number)
  return Math.min(Math.max((y2 - y1) * 12 + (m2 - m1) + 1, 1), dv.parcelas_total)
}

export async function addExpense(rec) {
  const { error } = await sb.from('gastos').insert(rec)
  if (error) throw error
  state.rows.unshift(rec)
  state.rows.sort((a, b) => dateOf(b).localeCompare(dateOf(a)))
}

export async function updateExpense(id, patch) {
  const { error } = await sb.from('gastos').update(patch).eq('id', id)
  if (error) throw error
  const r = state.rows.find(r => r.id === id)
  if (r) Object.assign(r, patch)
  state.rows.sort((a, b) => dateOf(b).localeCompare(dateOf(a)))
}

export async function deleteExpense(id) {
  const { error } = await sb.from('gastos').delete().eq('id', id)
  if (error) throw error
  state.rows = state.rows.filter(r => r.id !== id)
}
