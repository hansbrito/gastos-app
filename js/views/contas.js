// Contas: everything the couple owes — bills of the month (with barcode copy
// and paid tracking), future projection, credit cards, and debts.
import { state, brl, esc, todayISO, monthKey, monthLabel, shiftMonth, fmtBRDate,
         contasOcorrencias, ocorrencias, saveConta, deleteConta, togglePago,
         faturaWindow, faturaAberta, parcelaAtual,
         saveCartao, deleteCartao, saveDivida, deleteDivida } from '../store.js'
import { card, empty, sheet, toast, icon } from '../ui.js'

const slug = s => s.toLowerCase().replace(/\W+/g, '-')
const REC_LABEL = { unica: 'única', semanal: 'semanal', quinzenal: 'quinzenal',
                    mensal: 'mensal', semestral: 'semestral', anual: 'anual' }

/* ------------------------------------------------------ contas do mês -- */

function parcelaInfo(o) {
  const c = o.conta
  if (c.recorrencia === 'unica') return ''
  const idx = ocorrencias(c, c.vencimento, o.data).length
  if (!c.fim) return ` · ${idx}ª parcela`
  const total = ocorrencias(c, c.vencimento, c.fim).length
  return ` · parcela ${idx}/${total}`
}

function occRow(o, i) {
  const st = o.pago ? ['paga ✓', 'positive'] : o.atrasada ? ['atrasada', 'negative'] : ['pendente', 'neutral']
  return `
    <div class="c-tx" data-occ="${i}" style="cursor:pointer" title="Tocar para opções">
      <div class="c-tx__avatar" aria-hidden="true" style="${o.pago ? 'opacity:.45' : ''}">📄</div>
      <div class="c-tx__body" style="${o.pago ? 'opacity:.55' : ''}">
        <div class="c-tx__title">${esc(o.conta.descricao)}</div>
        <div class="c-tx__meta">vence ${fmtBRDate(o.data)} · ${REC_LABEL[o.conta.recorrencia]}${parcelaInfo(o)}${o.conta.linha_digitavel ? ' · 📋 código' : ''}</div>
      </div>
      <span class="c-chip c-chip--${st[1]}" style="margin-right:8px">${st[0]}</span>
      <div class="c-tx__value num" style="${o.pago ? 'opacity:.55' : ''}">${o.conta.valor ? brl(Number(o.conta.valor)) : '—'}</div>
    </div>`
}

let proximasRef = []

export function renderContas(el, onChanged) {
  proximasRef = []
  const today = todayISO(), ym = monthKey(today)
  const doMes = contasOcorrencias(`${ym}-01`, `${ym}-31`)
  const pendentesMes = doMes.filter(o => !o.pago)

  // projection: next 6 months — contas + dívidas installments (ask: vencimento as month reference)
  const projecao = []
  for (let i = 1; i <= 6; i++) {
    const m = shiftMonth(ym, i)
    const occs = contasOcorrencias(`${m}-01`, `${m}-31`)
    const contasTotal = occs.reduce((s, o) => s + Number(o.conta.valor || 0), 0)
    const divTotal = state.dividas
      .filter(d => d.ativo && parcelaAtual(d, m) <= d.parcelas_total &&
        (m >= d.inicio_ym) && (parcelaAtual(d, m) < d.parcelas_total || parcelaAtual(d, m) === d.parcelas_total))
      .filter(d => {
        const [y1, mo1] = d.inicio_ym.split('-').map(Number)
        const [y2, mo2] = m.split('-').map(Number)
        const idx = (y2 - y1) * 12 + (mo2 - mo1) + 1
        return idx >= 1 && idx <= d.parcelas_total
      })
      .reduce((s, d) => s + Number(d.valor_parcela), 0)
    projecao.push({ m, contas: contasTotal, dividas: divTotal, total: contasTotal + divTotal, n: occs.length })
  }

  const ativas = state.dividas.filter(d => d.ativo && parcelaAtual(d) <= d.parcelas_total)

  el.innerHTML = `
    <div style="height:10px"></div>
    <div class="l-grid">
      <section class="l-span2">
        <h2>Contas de ${monthLabel(ym)}</h2>
        ${card((doMes.length
          ? doMes.map(occRow).join('') + `
            <div style="display:flex;justify-content:space-between;border-top:1px solid var(--color-border);padding-top:10px;margin-top:4px" class="small">
              <span class="muted">${pendentesMes.length} pendente${pendentesMes.length !== 1 ? 's' : ''}</span>
              <b class="num">falta pagar ${brl(pendentesMes.reduce((s, o) => s + Number(o.conta.valor || 0), 0))}</b>
            </div>`
          : empty('📄', 'Nenhuma conta este mês.<br>Mande um <b>boleto</b> no grupo (salva com código de barras) ou agende uma conta.'))
          + `<button class="c-add" id="add-conta">＋ nova conta</button>`)}

        ${(() => {
          const proxFrom = shiftMonth(ym, 1) + '-01'
          const proxTo = shiftMonth(ym, 3) + '-31'
          const prox = contasOcorrencias(proxFrom, proxTo).filter(o => !o.pago)
          if (!prox.length) return ''
          const shown = prox.slice(0, 12)
          proximasRef = shown
          return `<h2>Próximas contas</h2>` + card(
            shown.map((o, i) => occRow(o, 'p' + i)).join('') +
            (prox.length > shown.length ? `<p class="muted small" style="margin-top:8px">… e mais ${prox.length - shown.length} nos próximos meses.</p>` : ''))
        })()}
      </section>

      <section>
        <h2>Progresso das parcelas</h2>
        ${(() => {
          const finitas = state.contas.filter(c => c.recorrencia !== 'unica' && c.fim)
          // group contas únicas whose name ends with "N/M" (e.g. carnê/financiamento parcels)
          const grupos = {}
          for (const c of state.contas.filter(c => c.recorrencia === 'unica')) {
            const m = /^(.*?)\s*(\d+)\/(\d+)\s*$/.exec(c.descricao || '')
            if (!m) continue
            const key = m[1].trim().toLowerCase() + '|' + m[3]
            grupos[key] = grupos[key] || { nome: m[1].trim(), total: Number(m[3]), valor: Number(c.valor || 0), pendentes: 0 }
            const pago = (c.pagos || []).includes(c.vencimento)
            if (!pago) grupos[key].pendentes++
          }
          const parcelados = Object.values(grupos).filter(g => g.total > 1)
          if (!finitas.length && !ativas.length && !parcelados.length)
            return card(empty('🏁', 'Contas parceladas e dívidas com prazo aparecem aqui com o progresso de quitação.'))
          const items = []
          for (const g of parcelados) {
            const done = Math.max(g.total - g.pendentes, 0)
            const pct = done / g.total * 100
            items.push(`
              <div class="c-cat" style="--cat-color:${pct >= 100 ? 'var(--color-positive)' : 'var(--color-primary)'}">
                <div class="c-cat__emoji" aria-hidden="true">${pct >= 100 ? '🎉' : '🏁'}</div>
                <div class="c-cat__body">
                  <div class="c-cat__line"><span>${esc(g.nome)}</span><span class="num">${done}/${g.total}</span></div>
                  <div class="c-cat__bar"><i style="width:${Math.max(pct, 2).toFixed(0)}%"></i></div>
                  <div class="muted small" style="margin-top:3px">
                    ${g.valor ? `já pagamos ${brl(done * g.valor)} de ${brl(g.total * g.valor)} · ` : ''}${pct.toFixed(0)}%${pct >= 100 ? ' 🎉' : ` · faltam ${g.total - done} parcelas`}
                  </div>
                </div>
              </div>`)
          }
          for (const c of finitas) {
            const total = ocorrencias(c, c.vencimento, c.fim).length
            const pagosN = (c.pagos || []).length
            const pct = total ? pagosN / total * 100 : 0
            const v = Number(c.valor || 0)
            items.push(`
              <div class="c-cat" style="--cat-color:${pct >= 100 ? 'var(--color-positive)' : 'var(--color-primary)'}">
                <div class="c-cat__emoji" aria-hidden="true">${pct >= 100 ? '🎉' : '🏁'}</div>
                <div class="c-cat__body">
                  <div class="c-cat__line"><span>${esc(c.descricao)}</span><span class="num">${pagosN}/${total}</span></div>
                  <div class="c-cat__bar"><i style="width:${Math.max(pct, 2).toFixed(0)}%"></i></div>
                  <div class="muted small" style="margin-top:3px">
                    ${v ? `já pagamos ${brl(pagosN * v)} de ${brl(total * v)} · ` : ''}${pct.toFixed(0)}% concluído${pct >= 100 ? ' 🎉' : ` · faltam ${total - pagosN}`}
                  </div>
                </div>
              </div>`)
          }
          for (const d of ativas) {
            const atual = parcelaAtual(d)
            const pagas = atual - 1
            const pct = pagas / d.parcelas_total * 100
            items.push(`
              <div class="c-cat" style="--cat-color:var(--color-warning)">
                <div class="c-cat__emoji" aria-hidden="true">🏁</div>
                <div class="c-cat__body">
                  <div class="c-cat__line"><span>${esc(d.credor)}</span><span class="num">${pagas}/${d.parcelas_total}</span></div>
                  <div class="c-cat__bar"><i style="width:${Math.max(pct, 2).toFixed(0)}%"></i></div>
                  <div class="muted small" style="margin-top:3px">
                    já pagamos ${brl(pagas * Number(d.valor_parcela))} de ${brl(d.parcelas_total * Number(d.valor_parcela))} · ${pct.toFixed(0)}% · faltam ${d.parcelas_total - pagas} parcelas
                  </div>
                </div>
              </div>`)
          }
          return card(items.join(''))
        })()}

        <h2>Próximos meses (projeção)</h2>
        ${card(projecao.some(p => p.total > 0)
          ? projecao.map(p => `
            <div class="c-cat" style="--cat-color:var(--color-primary)">
              <div class="c-cat__body">
                <div class="c-cat__line"><span>${monthLabel(p.m)}</span><span class="num">${brl(p.total)}</span></div>
                <div class="muted small">${p.n ? `${p.n} conta${p.n > 1 ? 's' : ''} ${brl(p.contas)}` : ''}${p.n && p.dividas ? ' · ' : ''}${p.dividas ? `parcelas ${brl(p.dividas)}` : ''}${!p.total ? 'nada previsto' : ''}</div>
              </div>
            </div>`).join('')
          : empty('🔮', 'Sem contas futuras ainda — agende uma conta recorrente.'))}
      </section>

      <section>
        <h2>Cartões de crédito</h2>
        ${card((state.cartoes.length ? state.cartoes.map(cartaoCard).join('')
          : empty('💳', 'Nenhum cartão ainda.'))
          + `<button class="c-add" id="add-card">＋ novo cartão</button>`)}
        <h2>Dívidas e parcelamentos</h2>
        ${card((ativas.length ? ativas.map(dividaCard).join('')
          : empty('🧾', 'Nenhuma dívida ativa.'))
          + `<button class="c-add" id="add-divida">＋ nova dívida</button>`)}
      </section>
    </div>`

  el.querySelector('#add-conta').onclick = () => openContaSheet(null, onChanged)
  el.querySelector('#add-card').onclick = () => openCartaoSheet(null, onChanged)
  el.querySelector('#add-divida').onclick = () => openDividaSheet(null, onChanged)
  for (const n of el.querySelectorAll('[data-occ]'))
    n.onclick = () => {
      const k = n.dataset.occ
      const o = String(k).startsWith('p') ? proximasRef[Number(k.slice(1))] : doMes[Number(k)]
      if (o) openOccSheet(o, onChanged)
    }
  for (const n of el.querySelectorAll('[data-card]'))
    n.onclick = () => openCartaoSheet(state.cartoes.find(c => c.id === n.dataset.card), onChanged)
  for (const n of el.querySelectorAll('[data-divida]'))
    n.onclick = () => openDividaSheet(state.dividas.find(d => d.id === n.dataset.divida), onChanged)
}

/* ------------------------------------------------- occurrence actions -- */

function openOccSheet(o, onDone) {
  const c = o.conta
  const ov = sheet(`
    <h1>${esc(c.descricao)}</h1>
    <p class="muted small" style="margin-bottom:12px">
      ${c.valor ? brl(Number(c.valor)) + ' · ' : ''}vence ${fmtBRDate(o.data)} · ${REC_LABEL[c.recorrencia]}${c.credor ? ' · ' + esc(c.credor) : ''}</p>
    ${c.linha_digitavel ? `
      <div class="c-field"><label>Linha digitável</label>
        <div style="display:flex;gap:8px">
          <input id="o-linha" readonly value="${esc(c.linha_digitavel)}" style="flex:1;font-size:13px">
          <button class="c-btn c-btn--ghost" id="o-copy" style="width:auto;padding:0 14px" aria-label="Copiar">${icon('copy', 18)}</button>
        </div></div>` : ''}
    <button class="c-btn c-btn--primary" id="o-pago">${o.pago ? 'Desfazer pagamento' : '✓ Marcar como paga'}</button>
    <button class="c-btn c-btn--ghost" id="o-edit" style="margin-top:8px">Editar conta</button>
    <button class="c-btn c-btn--danger" id="o-del" style="margin-top:8px">Excluir conta</button>
    <p class="center" style="padding-bottom:0"><button class="c-btn--link" id="o-cancel">fechar</button></p>`)
  ov.querySelector('#o-cancel').onclick = () => ov.remove()
  const copy = ov.querySelector('#o-copy')
  if (copy) copy.onclick = async () => {
    try { await navigator.clipboard.writeText(c.linha_digitavel); toast('📋 Linha digitável copiada') }
    catch { ov.querySelector('#o-linha').select(); document.execCommand('copy'); toast('📋 Copiada') }
  }
  ov.querySelector('#o-pago').onclick = async e => {
    e.target.disabled = true
    try { await togglePago(c, o.data); ov.remove(); toast(o.pago ? 'Pagamento desfeito' : '✓ Conta paga'); onDone() }
    catch (err) { toast('Erro: ' + err.message); e.target.disabled = false }
  }
  ov.querySelector('#o-edit').onclick = () => { ov.remove(); openContaSheet(c, onDone) }
  twoStepDelete(ov.querySelector('#o-del'), async () => {
    await deleteConta(c.id); ov.remove(); toast('Conta excluída'); onDone()
  })
}

/* ------------------------------------------------------- conta editor -- */

function proximasPreview(venc, rec, fim) {
  if (!venc) return ''
  const c = { vencimento: venc, recorrencia: rec, fim: fim || null, pagos: [] }
  const end = new Date(venc + 'T12:00:00'); end.setFullYear(end.getFullYear() + 1)
  const occs = ocorrencias(c, venc, end.toLocaleDateString('sv-SE')).slice(0, 4)
  if (rec === 'unica' || occs.length <= 1) return `Vence em ${fmtBRDate(venc)}.`
  return `Próximas: ${occs.map(fmtBRDate).join(' · ')}…`
}

function openContaSheet(c, onDone) {
  const isEdit = !!c
  let rec = isEdit ? c.recorrencia : 'mensal'
  const ov = sheet(`
    <h1>${isEdit ? 'Editar conta' : 'Nova conta'}</h1>
    <div class="c-field"><label>Descrição</label>
      <input id="ct-desc" type="text" placeholder="ex.: Condomínio" value="${isEdit ? esc(c.descricao) : ''}"></div>
    <div class="c-field"><label>Valor (R$ — deixe vazio se varia)</label>
      <input id="ct-valor" type="number" inputmode="decimal" min="0" step="0.01" value="${isEdit && c.valor ? Number(c.valor) : ''}"></div>
    <div class="c-field"><label>${isEdit ? 'Vencimento (âncora)' : 'Primeiro vencimento'}</label>
      <input id="ct-venc" type="date" value="${isEdit ? c.vencimento : todayISO()}"></div>
    <div class="c-field"><label>Repete</label>
      <div class="c-chips" id="ct-rec">${Object.entries(REC_LABEL).map(([k, l]) =>
        `<button data-r="${k}" aria-pressed="${rec === k}">${l}</button>`).join('')}</div></div>
    <div class="c-field" id="ct-fim-w" style="${rec === 'unica' ? 'display:none' : ''}">
      <label>Repetir até (opcional — vazio = sem fim)</label>
      <input id="ct-fim" type="date" value="${isEdit && c.fim ? c.fim : ''}"></div>
    <p class="muted small" id="ct-preview" style="margin:-4px 0 12px"></p>
    <div class="c-field"><label>Linha digitável (opcional)</label>
      <input id="ct-linha" type="text" inputmode="numeric" placeholder="código de barras do boleto"
        value="${isEdit ? esc(c.linha_digitavel || '') : ''}"></div>
    <button class="c-btn c-btn--primary" id="ct-save">Salvar</button>
    <p class="center" style="padding-bottom:0"><button class="c-btn--link" id="ct-cancel">cancelar</button></p>`)

  const preview = () => {
    ov.querySelector('#ct-preview').textContent =
      proximasPreview(ov.querySelector('#ct-venc').value, rec, ov.querySelector('#ct-fim').value)
  }
  for (const b of ov.querySelectorAll('#ct-rec button'))
    b.onclick = () => {
      rec = b.dataset.r
      ov.querySelectorAll('#ct-rec button').forEach(x => x.setAttribute('aria-pressed', String(x === b)))
      ov.querySelector('#ct-fim-w').style.display = rec === 'unica' ? 'none' : ''
      preview()
    }
  ov.querySelector('#ct-venc').onchange = preview
  ov.querySelector('#ct-fim').onchange = preview
  preview()

  ov.querySelector('#ct-cancel').onclick = () => ov.remove()
  ov.querySelector('#ct-save').onclick = async e => {
    const descricao = ov.querySelector('#ct-desc').value.trim()
    const valor = parseFloat(ov.querySelector('#ct-valor').value) || null
    const vencimento = ov.querySelector('#ct-venc').value
    const fim = rec === 'unica' ? null : (ov.querySelector('#ct-fim').value || null)
    const linha = ov.querySelector('#ct-linha').value.replace(/\D/g, '') || null
    if (!descricao) return toast('Informe a descrição')
    if (!vencimento) return toast('Informe o vencimento')
    if (linha && linha.length !== 47 && linha.length !== 48) toast('⚠ linha digitável com tamanho incomum — confira')
    e.target.disabled = true
    try {
      await saveConta({
        id: isEdit ? c.id : `${slug(descricao)}-${vencimento}`,
        descricao, credor: isEdit ? c.credor : null, valor, vencimento,
        recorrencia: rec, fim, linha_digitavel: linha,
        pagos: isEdit ? (c.pagos || []) : [], ativo: true,
      })
      ov.remove(); toast('✔ Conta salva'); onDone()
    } catch (err) { toast('Erro: ' + err.message); e.target.disabled = false }
  }
}

/* ------------------------------------- cartões & dívidas (unchanged UX) -- */

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

function twoStepDelete(btn, fn) {
  if (!btn) return
  btn.onclick = async () => {
    if (btn.dataset.armed !== '1') {
      btn.dataset.armed = '1'; btn.textContent = 'Tocar de novo para excluir'
      setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = btn.id === 'o-del' ? 'Excluir conta' : 'Excluir' } }, 3000)
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
