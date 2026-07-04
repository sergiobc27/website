/* Burbuja flotante + panel del asistente del portafolio (POST /api/chat).
   Vanilla TS, sin librerías. El render del modelo se construye con nodos
   (textContent + <strong>), nunca innerHTML del texto que devuelve la IA. */

type Msg = { role: 'user' | 'assistant'; content: string }

const t = (es: string, en: string) => (document.documentElement.lang === 'en' ? en : es)

const SUGERENCIAS = [
  '¿Qué experiencia tiene Sergio?',
  'Tell me about his thesis',
  '¿Cómo lo contacto?',
]

const ERROR_RED = () =>
  t(
    'No pude conectar. Escríbele directo: sergiobeltrancoley@gmail.com o linkedin.com/in/sergiobeltrancoley',
    'Connection failed. Reach Sergio directly: sergiobeltrancoley@gmail.com or linkedin.com/in/sergiobeltrancoley',
  )

/* Texto plano -> nodos: párrafos por salto de línea y **negrita** */
function renderTexto(destino: HTMLElement, texto: string): void {
  for (const linea of texto.split(/\n+/)) {
    if (!linea.trim()) continue
    const p = document.createElement('p')
    const partes = linea.split(/\*\*(.+?)\*\*/g)
    partes.forEach((parte, i) => {
      if (i % 2 === 1) {
        const b = document.createElement('strong')
        b.textContent = parte
        p.appendChild(b)
      } else if (parte) {
        p.appendChild(document.createTextNode(parte))
      }
    })
    destino.appendChild(p)
  }
}

export function initChat(): void {
  const historial: Msg[] = []
  let ocupado = false

  const fab = document.createElement('button')
  fab.className = 'chat-fab hover-target'
  fab.setAttribute('aria-label', t('Abrir chat sobre Sergio', 'Open chat about Sergio'))
  fab.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H9l-4.2 3.6c-.4.34-.8.05-.8-.45V5.5z" fill="currentColor"/><circle cx="9" cy="9.5" r="1.15" fill="var(--bg)"/><circle cx="12.2" cy="9.5" r="1.15" fill="var(--bg)"/><circle cx="15.4" cy="9.5" r="1.15" fill="var(--bg)"/></svg>'

  const panel = document.createElement('div')
  panel.className = 'chat-panel'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', t('Chat sobre Sergio', 'Chat about Sergio'))
  panel.innerHTML = `
    <div class="chat-head">
      <div>
        <b>${t('Pregúntame por Sergio', 'Ask me about Sergio')}</b>
        <small>${t('Responde en tu idioma', 'Replies in your language')}</small>
      </div>
      <button class="chat-close hover-target" aria-label="${t('Cerrar', 'Close')}">×</button>
    </div>
    <div class="chat-msgs" aria-live="polite"></div>
    <form class="chat-form">
      <input type="text" maxlength="500" placeholder="${t('Escribe tu pregunta…', 'Type your question…')}" aria-label="${t('Tu pregunta', 'Your question')}">
      <button type="submit" class="hover-target" aria-label="${t('Enviar', 'Send')}">➤</button>
    </form>`

  const msgs = panel.querySelector<HTMLElement>('.chat-msgs')!
  const form = panel.querySelector<HTMLFormElement>('.chat-form')!
  const input = panel.querySelector<HTMLInputElement>('input')!
  const cerrar = panel.querySelector<HTMLButtonElement>('.chat-close')!

  function burbuja(role: Msg['role'], texto: string): HTMLElement {
    const el = document.createElement('div')
    el.className = `chat-msg ${role}`
    renderTexto(el, texto)
    msgs.appendChild(el)
    msgs.scrollTop = msgs.scrollHeight
    return el
  }

  function saludo(): void {
    burbuja('assistant', t(
      'Hola, soy el asistente de este portafolio. Pregúntame lo que quieras sobre **Sergio**: su experiencia, estudios, proyectos o cómo contactarlo.',
      'Hi, I am this portfolio’s assistant. Ask me anything about **Sergio**: his experience, education, projects or how to reach him.',
    ))
    const chips = document.createElement('div')
    chips.className = 'chat-chips'
    for (const s of SUGERENCIAS) {
      const c = document.createElement('button')
      c.type = 'button'
      c.className = 'chat-chip hover-target'
      c.textContent = s
      c.addEventListener('click', () => { input.value = s; form.requestSubmit() })
      chips.appendChild(c)
    }
    msgs.appendChild(chips)
  }

  async function enviar(texto: string): Promise<void> {
    if (ocupado || !texto.trim()) return
    ocupado = true
    panel.querySelector('.chat-chips')?.remove()
    burbuja('user', texto)
    historial.push({ role: 'user', content: texto })
    input.value = ''
    const espera = document.createElement('div')
    espera.className = 'chat-msg assistant chat-espera'
    espera.textContent = '…'
    msgs.appendChild(espera)
    msgs.scrollTop = msgs.scrollHeight
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: historial.slice(-8) }),
      })
      const data = await res.json().catch(() => null)
      espera.remove()
      const reply = data && typeof data.reply === 'string' ? data.reply : ERROR_RED()
      burbuja('assistant', reply)
      historial.push({ role: 'assistant', content: reply })
    } catch {
      espera.remove()
      burbuja('assistant', ERROR_RED())
    }
    ocupado = false
    input.focus()
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); void enviar(input.value) })

  const abierto = () => panel.classList.contains('on')
  function abrir(): void {
    panel.classList.add('on')
    fab.classList.add('open')
    if (!msgs.childElementCount) saludo()
    input.focus()
  }
  function cerrarPanel(): void {
    panel.classList.remove('on')
    fab.classList.remove('open')
    fab.focus()
  }
  fab.addEventListener('click', () => (abierto() ? cerrarPanel() : abrir()))
  cerrar.addEventListener('click', cerrarPanel)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && abierto()) cerrarPanel()
  })

  document.body.append(fab, panel)
}
