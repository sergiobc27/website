// Guardrail determinista anti-manipulación, portado del asistente de
// ideam.sergiobc.com (battle-tested con red-team en vivo). Combinaciones,
// no palabras sueltas, para no bloquear preguntas legítimas. Se evalúa
// sobre texto en minúsculas y sin tildes.
const MANIPULATION_PATTERNS = [
  /ignor\w*.{0,25}(instruccion|regla|directriz|orden|prompt|restriccion|lo anterior|lo de arriba)/,
  /olvid\w*.{0,25}(instruccion|regla|anterior|prompt|restriccion)/,
  /(descart\w*|salt\w*).{0,25}(instruccion|regla|directriz|directrices|anterior|prompt|restriccion|filtro|limit)/,
  /(actu\w*|haz|comp[oó]rt\w*)\s+como\s+(si|un|una)\b|hazte\s+pasar|pret[eu]nd\w*\s+(que\s+)?(eres|ser)|finge\s+(que\s+)?(eres|ser)|simula\s+ser/,
  /(ahora\s+eres|a\s+partir\s+de\s+ahora.{0,10}eres|de\s+ahora\s+en\s+adelante.{0,10}eres|seras\b).{0,15}(asistente|modelo|ia\b|chatbot|gpt|dan\b|experto|profesor|persona|poeta|traductor)/,
  /modo\s+(desarrollador|dios|libre|sin\s+restriccion|dan\b|jailbreak|experto)/,
  /sin\s+(restriccion|restricciones|filtro|filtros|limites|limite|censura|reglas)/,
  /system\s*prompt|prompt\s+(del\s+sistema|inicial|de\s+sistema)/,
  /(revela\w*|muestr\w*|dame|dime|repit\w*|transcrib\w*|resum\w*|enumer\w*|list\w*|copia\w*|reproduc\w*|escrib\w*|cita\w*|cual\w*\s+(es|son)).{0,40}(instruccion\w*|directriz\w*|directrices|prompt|reglas\s+(que|internas|del)|configuracion\s+(inicial|del\s+sistema)|tus\s+reglas|tu\s+(comportamiento|configuracion|programacion))/,
  /(instruccion\w*|directriz\w*|directrices|texto|reglas|mensaje)\s+(que\s+)?(recibiste|te\s+(dieron|pasaron|entregaron|configuraron|dijeron)|iniciales?|del\s+sistema|al\s+inicio)/,
  /(el\s+)?(texto|mensaje|prompt|instruccion\w*)\s+(inicial|de\s+arriba|que\s+recibiste|que\s+te\s+(dieron|pasaron))/,
  /al\s+(inicio|principio|comienzo)\s+de\s+(esta|la|nuestra|tu)\s+(conversacion|charla|chat|sesion)/,
  /(que|lo\s+que)\s+te\s+(dijeron|indicaron|ordenaron|configuraron|programaron|pidieron)\b/,
  /(que|cuales?)\s+(cosas\s+)?no\s+(puedes|debes|tienes\s+permitido)\s+(hacer|decir|responder)/,
  /tu\s+(comportamiento|configuracion|programacion)/,
  /\b(jailbreak|dan\s+mode|developer\s+mode|ignore\s+(previous|all|your|the)|disregard\s+(previous|all|your|the)|you\s+are\s+now|act\s+as\b|pretend\s+(to\s+be|you)|forget\s+(your|all|previous)|no\s+restrictions|without\s+restrictions|(reveal|show\s+me)\s+(your|the)\s+(system\s+)?(prompt|instructions))\b/,
]

export function looksLikeManipulation(text) {
  const t = String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return MANIPULATION_PATTERNS.some((re) => re.test(t))
}

export const CHAT_REJECTION =
  'Solo puedo contarte sobre Sergio: su experiencia, estudios, proyectos, certificaciones y cómo contactarlo. / I can only talk about Sergio: his experience, education, projects, certifications and how to reach him.'
