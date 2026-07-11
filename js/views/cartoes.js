// Cartões & Dívidas: current state of credit cards (open statement computed
// from the expense records) and installment debts.
import { state, brl, esc, todayISO, monthKey, faturaWindow, faturaAberta, parcelaAtual,
         saveCartao, deleteCartao, saveDivida, deleteDivida, fmtBRDate } from '../store.js'
import { card, empty, sheet, toast } from '../ui.js'

const slug = s => s.toLowerCase().replace(/\W+/g, '-')

function cartaoCard(c) {
  const fatura = faturaAberta(c)
  const w = faturaWindow(c)
  const pct = c.limite ? Math.min(fatura / c.limite * 100, 100) : null
  return `
    <div class="c-cat" data-card="${esc(c.id)}" style="--cat-color:${pct !== null && pct > 80 ? 'var(--color-negative)' : 'var(--color-primary)'};cursor:pointer" title="Tocar para editar">
      <div class="c-cat__emoji" aria-hidden="true">💳</div>
      <div class="c-cat__body">
        <div class="c-cat__line"><span>${esc(c.nome)}</span><span class="num">${brl(fatura)}</span></div>
        ${pct !== null ? `<div class="c-cat__bar"><i style="width:${Math.max(pct, 2).toFixed(0)}%"></i></div>` : ''}
        <div class="muted small" style="margin-top:3px">
          fatura aberta (${fmtBRDate(w.start)}–${fmtBRDate(w.end)}) · fecha dia ${c.dia_fechamento} · vence dia ${c.dia_vencimento}${c.limite ? ` · limite ${brl(c.limite)}` : ''}
        </div>
      </div>
    </div>`
}

function dividaCard(d) {
  const ym = monthKey(todayISO())
  const atual = parcelaAtual(d, ym)
  const restam = d.parcelas_total - atual + 1
  const pct = (atual - 1) / d.parcelas_total * 100
  return `
    <div class="c-cat" data-divida="${esc(d.id)}" style="--cat-color:var(--color-warning);cursor:pointer" title="Tocar para editar">
      <div class="c-cat__emoji" aria-hidden="true">📄</div>
      <div class="c-cat__body">
        <div class="c-cat__line"><span>${esc(d.credor)}</span><span class="num">${brl(d.valor_parcela)}/mês</span></div>
        <div class="c-cat__bar"><i style="width:${Math.max(pct, 2).toFixed(0)}%"></i></div>
        <div class="muted small" style="margin-top:3px">
          parcela ${atual}/${d.parcelas_total} · vence dia ${d.dia_vencimento} · faltam ${brl(restam * d.valor_parcela)}${d.descricao ? ` · ${esc(d.descricao)}` : ''}
        </div>
      </div>
    </div>`
}

export function renderCartoes(el, onChanged) {
  const ativas = state.dividas.filter(d => d.ativo && parcelaAtual(d) <= d.parcelas_total)
  const totalMes = ativas.reduce((s, d) => s + Number(d.valor_parcela), 0) +
    state.cartoes.reduce((s, c) => s + faturaAberta(c), 0)

  el.innerHTML = `
    <div style="height:10px"></div>
    <div class="l-grid">
      <section>
        <h2 style="display:flex;justify-content:space-between;align-items:center">Cartões de crédito
          <button class="c-btn--link" id="add-card" style="margin:0">+ cartão</button></h2>
        ${card(state.cartoes.length
          ? state.cartoes.map(cartaoCard).join('')
          : empty('💳', 'Nenhum cartão ainda.<br>Registre aqui ou mande no grupo:<br><i>"cartão: Nubank Hans, limite 8000, fecha dia 28, vence dia 5"</i>'))}
      </section>

      <section>
        <h2 style="display:flex;justify-content:space-between;align-items:center">Dívidas e parcelamentos
          <button class="c-btn--link" id="add-divida" style="margin:0">+ dívida</button></h2>
        ${card(ativas.length
          ? ativas.map(dividaCard).join('')
          : empty('📄', 'Nenhuma dívida ativa.<br>Registre aqui ou no grupo:<br><i>"dívida: financiamento carro, 24x de 890, vence dia 15"</i>'))}
      </section>

      <section class="l-span2">
        ${card(`<div style="display:flex;justify-content:space-around;text-align:center">
          <div><div class="muted small">Comprometido este mês (faturas + parcelas)</div>
          <b class="num" style="font-size:var(--text-lg)">${brl(totalMes)}</b></div></div>`)}
      </section>
    </div>`

  el.querySelector('#add-card').onclick = () => openCartaoSheet(null, onChanged)
  el.querySelector('#add-divida').onclick = () => openDividaSheet(null, onChanged)
  for (const n of el.querySelectorAll('[data-card]'))
    n.onclick = () => openCartaoSheet(state.cartoes.find(c => c.id === n.dataset.card), onChanged)
  for (const n of el.querySelectorAll('[data-divida]'))
    n.onclick = () => openDividaSheet(state.dividas.find(d => d.id === n.dataset.divida), onChanged)
}

/* ---- sheets ---- */

function twoStepDelete(btn, fn) {
  if (!btn) return
  btn.onclick = async () => {
    if (btn.dataset.armed !== '1') {
      btn.dataset.armed = '1'; btn.textContent = 'Tocar de novo para excluir'
      setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = 'Excluir' } }, 3000)
      return
    }
    btn.disabled = true
    try { await fn() } catch (e) { toast('Erro: ' + e.message); btn.disabled = false }
  }
}

function openCartaoSheet(c, onDone) {
  const isEdit = !!c
  const ov = sheet(`
    <h1>${isEdit ? 'Editar cartão' : 'Novo cartão'}</h1>
    <div class="c-field"><label>Nome</label><input id="c-nome" type="text" placeholder="ex.: Nubank Hans" value="${isEdit ? esc(c.nome) : ''}"></div>
    <div class="c-field"><label>Limite (R$, opcional)</label><input id="c-limite" type="number" inputmode="decimal" min="0" value="${isEdit && c.limite ? Number(c.limite) : ''}"></div>
    <div class="c-field"><label>Dia de fechamento</label><input id="c-fecha" type="number" inputmode="numeric" min="1" max="31" value="${isEdit ? c.dia_fechamento : ''}"></div>
    <div class="c-field"><label>Dia de vencimento</label><input id="c-vence" type="number" inputmode="numeric" min="1" max="31" value="${isEdit ? c.dia_vencimento : ''}"></div>
    <button class="c-btn c-btn--primary" id="c-save">Salvar</button>
    ${isEdit ? '<button class="c-btn c-btn--danger" id="c-del" style="margin-top:8px">Excluir</button>' : ''}
    <p class="center" style="padding-bottom:0"><button class="c-btn--link" id="c-cancel">cancelar</button></p>`)
  ov.querySelector('#c-cancel').onclick = () => ov.remove()
  twoStepDelete(ov.querySelector('#c-del'), async () => {
    await deleteCartao(c.id); ov.remove(); toast('Cartão excluído'); onDone()
  })
  ov.querySelector('#c-save').onclick = async e => {
    const nome = ov.querySelector('#c-nome').value.trim()
    const limite = parseFloat(ov.querySelector('#c-limite').value) || null
    const fecha = parseInt(ov.querySelector('#c-fecha').value)
    const vence = parseInt(ov.querySelector('#c-vence').value)
    if (!nome) return toast('Informe o nome')
    if (!fecha || fecha < 1 || fecha > 31) return toast('Dia de fechamento inválido')
    if (!vence || vence < 1 || vence > 31) return toast('Dia de vencimento inválido')
    e.target.disabled = true
    try {
      await saveCartao({ id: isEdit ? c.id : slug(nome), nome, limite, dia_fechamento: fecha, dia_vencimento: vence })
      ov.remove(); toast('✔ Cartão salvo'); onDone()
    } catch (err) { toast('Erro: ' + err.message); e.target.disabled = false }
  }
}

function openDividaSheet(d, onDone) {
  const isEdit = !!d
  const ov = sheet(`
    <h1>${isEdit ? 'Editar dívida' : 'Nova dívida'}</h1>
    <div class="c-field"><label>Credor</label><input id="d-credor" type="text" placeholder="ex.: Financiamento carro" value="${isEdit ? esc(d.credor) : ''}"></div>
    <div class="c-field"><label>Descrição (opcional)</label><input id="d-desc" type="text" value="${isEdit ? esc(d.descricao || '') : ''}"></div>
    <div class="c-field"><label>Valor da parcela (R$)</label><input id="d-valor" type="number" inputmode="decimal" min="0.01" step="0.01" value="${isEdit ? Number(d.valor_parcela) : ''}"></div>
    <div class="c-field"><label>Total de parcelas</label><input id="d-total" type="number" inputmode="numeric" min="1" value="${isEdit ? d.parcelas_total : ''}"></div>
    <div class="c-field"><label>Primeira parcela (mês)</label><input id="d-inicio" type="month" value="${isEdit ? d.inicio_ym : monthKey(todayISO())}"></div>
    <div class="c-field"><label>Dia de vencimento</label><input id="d-vence" type="number" inputmode="numeric" min="1" max="31" value="${isEdit ? d.dia_vencimento : ''}"></div>
    <button class="c-btn c-btn--primary" id="d-save">Salvar</button>
    ${isEdit ? `<button class="c-btn c-btn--ghost" id="d-quitar" style="margin-top:8px">Marcar como quitada</button>
                <button class="c-btn c-btn--danger" id="d-del" style="margin-top:8px">Excluir</button>` : ''}
    <p class="center" style="padding-bottom:0"><button class="c-btn--link" id="d-cancel">cancelar</button></p>`)
  ov.querySelector('#d-cancel').onclick = () => ov.remove()
  twoStepDelete(ov.querySelector('#d-del'), async () => {
    await deleteDivida(d.id); ov.remove(); toast('Dívida excluída'); onDone()
  })
  const quitar = ov.querySelector('#d-quitar')
  if (quitar) quitar.onclick = async () => {
    quitar.disabled = true
    try { await saveDivida({ ...d, ativo: false }); ov.remove(); toast('🎉 Dívida quitada!'); onDone() }
    catch (e) { toast('Erro: ' + e.message); quitar.disabled = false }
  }
  ov.querySelector('#d-save').onclick = async e => {
    const credor = ov.querySelector('#d-credor').value.trim()
    const valor = parseFloat(ov.querySelector('#d-valor').value)
    const total = parseInt(ov.querySelector('#d-total').value)
    const inicio = ov.querySelector('#d-inicio').value
    const vence = parseInt(ov.querySelector('#d-vence').value)
    if (!credor) return toast('Informe o credor')
    if (!valor || valor <= 0) return toast('Informe o valor da parcela')
    if (!total || total < 1) return toast('Informe o total de parcelas')
    if (!inicio) return toast('Informe o mês da primeira parcela')
    if (!vence || vence < 1 || vence > 31) return toast('Dia de vencimento inválido')
    e.target.disabled = true
    try {
      await saveDivida({
        id: isEdit ? d.id : `${slug(credor)}-${inicio}`,
        credor, descricao: ov.querySelector('#d-desc').value.trim() || null,
        valor_parcela: valor, parcelas_total: total, inicio_ym: inicio,
        dia_vencimento: vence, ativo: isEdit ? d.ativo : true,
      })
      ov.remove(); toast('✔ Dívida salva'); onDone()
    } catch (err) { toast('Erro: ' + err.message); e.target.disabled = false }
  }
}
