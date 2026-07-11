// One sheet for both flows: add a new record or edit/correct an existing one.
// Handles despesas AND receitas; DB first, then local state; views re-render after.
import { CATS, EXPENSE_CATS, INCOME_CATS, knownCards, todayISO, dateOf,
         addExpense, updateExpense, deleteExpense, state, isIncome, esc } from '../store.js'
import { sheet, toast } from '../ui.js'
import { ALLOWED } from '../supabase.js'

export function openExpenseSheet({ rec = null, onDone }) {
  const isEdit = !!rec
  let tipo = isEdit && isIncome(rec) ? 'receita' : 'despesa'
  let cat = isEdit ? rec.categoria : null

  const chipsFor = t => (t === 'receita' ? INCOME_CATS : EXPENSE_CATS).map(c =>
    `<button data-c="${c}" aria-pressed="${cat === c}">${CATS[c]} ${c}</button>`).join('')

  const ov = sheet(`
    <h1>${isEdit ? 'Corrigir lançamento' : 'Novo lançamento'}</h1>
    <div class="c-seg" role="tablist" aria-label="Tipo">
      <button role="tab" data-tipo="despesa" aria-selected="${tipo === 'despesa'}">Despesa</button>
      <button role="tab" data-tipo="receita" aria-selected="${tipo === 'receita'}">Receita</button>
    </div>
    <div class="c-field"><label for="f-valor">Valor (R$)</label>
      <input id="f-valor" type="number" inputmode="decimal" step="0.01" min="0.01"
        placeholder="0,00" value="${isEdit ? Number(rec.valor) : ''}"></div>
    <div class="c-field"><label for="f-estab" id="l-estab">${tipo === 'receita' ? 'De quem veio' : 'Onde / com quem'}</label>
      <input id="f-estab" type="text" placeholder="ex.: Mercado Carrefour"
        value="${isEdit ? esc(rec.estabelecimento || '') : ''}"></div>
    <div class="c-field"><label>Categoria</label>
      <div class="c-chips" id="f-cats">${chipsFor(tipo)}</div></div>
    <div class="c-field"><label for="f-data">Data</label>
      <input id="f-data" type="date" value="${isEdit ? dateOf(rec) : todayISO()}"></div>
    <div class="c-field" id="w-metodo"><label for="f-metodo">Método</label>
      <select id="f-metodo">${['Pix', 'crédito', 'débito', 'dinheiro', 'boleto', 'outro'].map(m =>
        `<option ${isEdit && rec.metodo === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
    <div class="c-field" id="w-cartao"><label for="f-cartao">Cartão (opcional)</label>
      <input id="f-cartao" type="text" list="cards" placeholder="ex.: Nubank 1234"
        value="${isEdit ? esc(rec.cartao || '') : ''}">
      <datalist id="cards">${knownCards().map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
    <button class="c-btn c-btn--primary" id="f-save">${isEdit ? 'Salvar correção' : 'Salvar'}</button>
    ${isEdit ? `<button class="c-btn c-btn--danger" id="f-del" style="margin-top:8px">Excluir</button>` : ''}
    <p class="center" style="padding-bottom:0"><button class="c-btn--link" id="f-cancel">cancelar</button></p>`)

  function bindCats() {
    for (const b of ov.querySelectorAll('#f-cats button'))
      b.onclick = () => {
        cat = b.dataset.c
        ov.querySelectorAll('#f-cats button').forEach(x => x.setAttribute('aria-pressed', String(x === b)))
      }
  }
  bindCats()

  for (const b of ov.querySelectorAll('[data-tipo]'))
    b.onclick = () => {
      tipo = b.dataset.tipo
      cat = null
      ov.querySelectorAll('[data-tipo]').forEach(x => x.setAttribute('aria-selected', String(x === b)))
      ov.querySelector('#f-cats').innerHTML = chipsFor(tipo)
      ov.querySelector('#l-estab').textContent = tipo === 'receita' ? 'De quem veio' : 'Onde / com quem'
      ov.querySelector('#w-cartao').style.display = tipo === 'receita' ? 'none' : ''
      bindCats()
    }
  if (tipo === 'receita') ov.querySelector('#w-cartao').style.display = 'none'

  ov.querySelector('#f-cancel').onclick = () => ov.remove()
  if (!isEdit) ov.querySelector('#f-valor').focus()

  // two-step destructive action — no native confirm() dialogs
  const del = ov.querySelector('#f-del')
  if (del) del.onclick = async () => {
    if (del.dataset.armed !== '1') {
      del.dataset.armed = '1'
      del.textContent = 'Tocar de novo para excluir'
      setTimeout(() => { if (ov.isConnected) { del.dataset.armed = ''; del.textContent = 'Excluir' } }, 3000)
      return
    }
    del.disabled = true
    try {
      await deleteExpense(rec.id)
      ov.remove(); toast('Lançamento excluído'); onDone()
    } catch (err) { toast('Erro: ' + err.message); del.disabled = false }
  }

  ov.querySelector('#f-save').onclick = async e => {
    const valor = parseFloat(ov.querySelector('#f-valor').value.replace(',', '.'))
    const estab = ov.querySelector('#f-estab').value.trim()
    const data = ov.querySelector('#f-data').value
    const cartao = tipo === 'receita' ? null : (ov.querySelector('#f-cartao').value.trim() || null)
    if (!valor || valor <= 0) return toast('Informe o valor')
    if (!estab) return toast(tipo === 'receita' ? 'Informe de quem veio' : 'Informe onde foi o gasto')
    if (!cat) return toast('Escolha uma categoria')
    e.target.disabled = true; e.target.textContent = 'Salvando…'
    const metodo = ov.querySelector('#f-metodo').value
    const fields = { tipo, valor, estabelecimento: estab, categoria: cat, data, metodo, cartao }
    try {
      if (isEdit) {
        await updateExpense(rec.id, fields)
      } else {
        await addExpense({
          id: 'app-' + crypto.randomUUID(),
          received_at: new Date().toISOString(),
          sender: ALLOWED[state.user.email] || 'app',
          descricao: 'adicionado pelo app',
          ...fields,
        })
      }
      ov.remove(); toast(isEdit ? '✔ Corrigido' : '✔ Registrado'); onDone()
    } catch (err) {
      toast('Erro: ' + err.message)
      e.target.disabled = false; e.target.textContent = isEdit ? 'Salvar correção' : 'Salvar'
    }
  }
}
