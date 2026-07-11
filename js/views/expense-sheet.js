// One sheet for both flows: add a new expense or edit/correct an existing one.
// Every change updates the DB first, then local state — all views re-render after.
import { CATS, todayISO, dateOf, addExpense, updateExpense, deleteExpense, state } from '../store.js'
import { sheet, toast } from '../ui.js'
import { ALLOWED } from '../supabase.js'

export function openExpenseSheet({ rec = null, onDone }) {
  const isEdit = !!rec
  const ov = sheet(`
    <h1>${isEdit ? 'Corrigir gasto' : 'Novo gasto'}</h1>
    <div class="c-field"><label for="f-valor">Valor (R$)</label>
      <input id="f-valor" type="number" inputmode="decimal" step="0.01" min="0.01"
        placeholder="0,00" value="${isEdit ? Number(rec.valor) : ''}"></div>
    <div class="c-field"><label for="f-estab">Onde / com quem</label>
      <input id="f-estab" type="text" placeholder="ex.: Mercado Carrefour"
        value="${isEdit ? String(rec.estabelecimento || '').replace(/"/g, '&quot;') : ''}"></div>
    <div class="c-field"><label>Categoria</label>
      <div class="c-chips">${Object.entries(CATS).map(([c, e]) =>
        `<button data-c="${c}" aria-pressed="${isEdit && rec.categoria === c}">${e} ${c}</button>`).join('')}</div></div>
    <div class="c-field"><label for="f-data">Data</label>
      <input id="f-data" type="date" value="${isEdit ? dateOf(rec) : todayISO()}"></div>
    <div class="c-field"><label for="f-metodo">Método</label>
      <select id="f-metodo">${['Pix', 'crédito', 'débito', 'dinheiro', 'boleto', 'outro'].map(m =>
        `<option ${isEdit && rec.metodo === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
    <button class="c-btn c-btn--primary" id="f-save">${isEdit ? 'Salvar correção' : 'Salvar'}</button>
    ${isEdit ? `<button class="c-btn c-btn--danger" id="f-del" style="margin-top:8px">Excluir</button>` : ''}
    <p class="center" style="padding-bottom:0"><button class="c-btn--link" id="f-cancel">cancelar</button></p>`)

  let cat = isEdit ? rec.categoria : null
  for (const b of ov.querySelectorAll('.c-chips button'))
    b.onclick = () => {
      cat = b.dataset.c
      ov.querySelectorAll('.c-chips button').forEach(x => x.setAttribute('aria-pressed', String(x === b)))
    }
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
      ov.remove(); toast('Gasto excluído'); onDone()
    } catch (err) { toast('Erro: ' + err.message); del.disabled = false }
  }

  ov.querySelector('#f-save').onclick = async e => {
    const valor = parseFloat(ov.querySelector('#f-valor').value.replace(',', '.'))
    const estab = ov.querySelector('#f-estab').value.trim()
    const data = ov.querySelector('#f-data').value
    if (!valor || valor <= 0) return toast('Informe o valor')
    if (!estab) return toast('Informe onde foi o gasto')
    if (!cat) return toast('Escolha uma categoria')
    e.target.disabled = true; e.target.textContent = 'Salvando…'
    const metodo = ov.querySelector('#f-metodo').value
    try {
      if (isEdit) {
        await updateExpense(rec.id, { valor, estabelecimento: estab, categoria: cat, data, metodo })
      } else {
        await addExpense({
          id: 'app-' + crypto.randomUUID(),
          received_at: new Date().toISOString(),
          sender: ALLOWED[state.user.email] || 'app',
          data, valor, estabelecimento: estab, categoria: cat, metodo,
          descricao: 'adicionado pelo app',
        })
      }
      ov.remove(); toast(isEdit ? '✔ Corrigido' : '✔ Gasto registrado'); onDone()
    } catch (err) {
      toast('Erro: ' + err.message)
      e.target.disabled = false; e.target.textContent = isEdit ? 'Salvar correção' : 'Salvar'
    }
  }
}
