import { CATS, todayISO, addExpense, state } from '../store.js'
import { sheet, toast } from '../ui.js'
import { ALLOWED } from '../supabase.js'

export function openAdd(onSaved) {
  const ov = sheet(`
    <h1>Novo gasto</h1>
    <div class="c-field"><label for="f-valor">Valor (R$)</label>
      <input id="f-valor" type="number" inputmode="decimal" step="0.01" min="0.01" placeholder="0,00"></div>
    <div class="c-field"><label for="f-estab">Onde / com quem</label>
      <input id="f-estab" type="text" placeholder="ex.: Mercado Carrefour"></div>
    <div class="c-field"><label>Categoria</label>
      <div class="c-chips">${Object.entries(CATS).map(([c, e]) =>
        `<button data-c="${c}" aria-pressed="false">${e} ${c}</button>`).join('')}</div></div>
    <div class="c-field"><label for="f-data">Data</label>
      <input id="f-data" type="date" value="${todayISO()}"></div>
    <div class="c-field"><label for="f-metodo">Método</label>
      <select id="f-metodo"><option>Pix</option><option>crédito</option><option>débito</option>
      <option>dinheiro</option><option>boleto</option><option>outro</option></select></div>
    <button class="c-btn c-btn--primary" id="f-save">Salvar</button>
    <p class="center" style="padding-bottom:0"><button class="c-btn--link" id="f-cancel">cancelar</button></p>`)

  let cat = null
  for (const b of ov.querySelectorAll('.c-chips button'))
    b.onclick = () => {
      cat = b.dataset.c
      ov.querySelectorAll('.c-chips button').forEach(x => x.setAttribute('aria-pressed', String(x === b)))
    }
  ov.querySelector('#f-cancel').onclick = () => ov.remove()
  ov.querySelector('#f-valor').focus()

  ov.querySelector('#f-save').onclick = async e => {
    const valor = parseFloat(ov.querySelector('#f-valor').value.replace(',', '.'))
    const estab = ov.querySelector('#f-estab').value.trim()
    const data = ov.querySelector('#f-data').value
    if (!valor || valor <= 0) return toast('Informe o valor')
    if (!estab) return toast('Informe onde foi o gasto')
    if (!cat) return toast('Escolha uma categoria')
    e.target.disabled = true; e.target.textContent = 'Salvando…'
    try {
      await addExpense({
        id: 'app-' + crypto.randomUUID(),
        received_at: new Date().toISOString(),
        sender: ALLOWED[state.user.email] || 'app',
        data, valor, estabelecimento: estab, categoria: cat,
        metodo: ov.querySelector('#f-metodo').value,
        descricao: 'adicionado pelo app',
      })
      ov.remove(); toast('✔ Gasto registrado'); onSaved()
    } catch (err) {
      toast('Erro: ' + err.message)
      e.target.disabled = false; e.target.textContent = 'Salvar'
    }
  }
}
