// Worker de sergiobc.com: sirve los assets del portafolio y atiende el chat
// del asistente en POST /api/chat con Workers AI. Aislado: si la IA falla,
// el sitio sigue sirviéndose igual.
import { looksLikeManipulation, CHAT_REJECTION } from './guardrail.js'
import { SYSTEM_PROMPT } from './dossier.js'

const MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct'
const VENTANA_MS = 10 * 60 * 1000
const MAX_POR_VENTANA = 10
const MAX_HISTORIAL = 12
const MAX_CHARS_MSG = 1000
const HISTORIAL_AL_MODELO = 8
// Barrera blanda por isolate para no agotar el cupo diario de neuronas que
// se comparte con el asistente de ideam.sergiobc.com.
const TECHO_DIARIO = 400

const MENSAJE_LIMITE =
  'Por ahora no puedo responder más mensajes. Escríbele directo a Sergio: sergiobeltrancoley@gmail.com, linkedin.com/in/sergiobeltrancoley o WhatsApp wa.me/573136726414. / I cannot answer more messages right now. Reach Sergio directly: sergiobeltrancoley@gmail.com, linkedin.com/in/sergiobeltrancoley or WhatsApp wa.me/573136726414.'

export class RateLimiter {
  constructor(max = MAX_POR_VENTANA, ventanaMs = VENTANA_MS) {
    this.max = max
    this.ventanaMs = ventanaMs
    this.porIp = new Map()
  }
  permite(ip, ahora) {
    const previos = (this.porIp.get(ip) || []).filter((t) => ahora - t < this.ventanaMs)
    if (previos.length >= this.max) {
      this.porIp.set(ip, previos)
      return false
    }
    previos.push(ahora)
    this.porIp.set(ip, previos)
    return true
  }
}

export function validaPayload(body) {
  if (!body || !Array.isArray(body.messages)) return { ok: false, error: 'formato inválido' }
  const messages = body.messages
  if (messages.length === 0 || messages.length > MAX_HISTORIAL)
    return { ok: false, error: 'historial fuera de rango' }
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return { ok: false, error: 'rol inválido' }
    if (typeof m.content !== 'string' || m.content.length === 0 || m.content.length > MAX_CHARS_MSG)
      return { ok: false, error: 'mensaje fuera de rango' }
  }
  return { ok: true, messages: messages.map((m) => ({ role: m.role, content: m.content })) }
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

let mensajesHoy = 0
let diaActual = ''

export async function handleChat(request, env, limiter, ahora) {
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }
  const v = validaPayload(body)
  if (!v.ok) return json({ error: v.error }, 400)

  const ip = request.headers.get('cf-connecting-ip') || 'desconocida'
  if (!limiter.permite(ip, ahora)) return json({ reply: MENSAJE_LIMITE, limited: true }, 429)

  const dia = new Date(ahora).toISOString().slice(0, 10)
  if (dia !== diaActual) {
    diaActual = dia
    mensajesHoy = 0
  }
  if (mensajesHoy >= TECHO_DIARIO) return json({ reply: MENSAJE_LIMITE, limited: true }, 429)

  if (v.messages.some((m) => m.role === 'user' && looksLikeManipulation(m.content)))
    return json({ reply: CHAT_REJECTION, blocked: true })

  mensajesHoy += 1
  try {
    const result = await env.AI.run(MODEL, {
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...v.messages.slice(-HISTORIAL_AL_MODELO)],
      max_tokens: 512,
    })
    const reply = typeof result?.response === 'string' && result.response.trim() ? result.response.trim() : null
    if (!reply) throw new Error('respuesta vacía del modelo')
    return json({ reply })
  } catch {
    return json({ reply: MENSAJE_LIMITE })
  }
}

const limiterGlobal = new RateLimiter()

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/api/chat') {
      if (request.method !== 'POST') return json({ error: 'método no permitido' }, 405)
      return handleChat(request, env, limiterGlobal, Date.now())
    }
    return env.ASSETS.fetch(request)
  },
}
