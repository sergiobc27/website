/**
 * Sesión firmada del chat (HMAC-SHA256): emisión, firma y verificación. Aparte
 * de index.js porque el módulo de entrada del Worker solo puede exportar
 * handlers y el tope de mensajes se usa desde los tests.
 */

// El chat es el flujo caro (Workers AI, hasta 3 llamadas por mensaje) y su único
// freno era el contador KV con carrera conocida (hallazgo de auditoría). Ahora:
// el navegador pasa Turnstile UNA vez (misma site key del correo) en
// POST /api/chat/session y recibe un token de sesión firmado (HMAC-SHA256) con
// vencimiento (~1 h) y tope de mensajes; cada POST /api/chat presenta el token y
// recibe uno renovado con el contador incrementado. El contador KV queda como
// RESPALDO (el token con contador es replayable si el cliente lo reusa en
// paralelo; el KV por-IP y el tope global acotan ese abuso).
export const CHAT_SESSION_TTL_S = 3600;   // vencimiento de la sesión (~1 hora)
export const CHAT_SESSION_MAX_MSGS = 30;  // tope de mensajes por sesión (= cupo/h por IP)

// Clave HMAC derivada de un secreto YA presente en el entorno (no se inventa un
// secreto nuevo): el del proxy, con etiqueta de contexto para no reutilizar la
// clave "a pelo" en dos usos distintos. Sin secretos (wrangler dev pelado) no
// hay clave y el chat opera sin sesión (el rate-limit KV sigue activo).
export async function claveSesionChat(env) {
  const secreto = env.IDEAM_PROXY_SECRET || env.TURNSTILE_SECRET_KEY;
  if (!secreto) return null;
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`ideam-chat-session-v1|${secreto}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function b64urlEncode(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  const b64 = String(str).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function firmarSesionChat(env, payload) {
  const key = await claveSesionChat(env);
  if (!key) return null;
  const cuerpo = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const firma = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(cuerpo));
  return `${cuerpo}.${b64urlEncode(new Uint8Array(firma))}`;
}

// Devuelve el payload {iat, exp, n, c} si el token es auténtico y vigente; null
// si falta, está mal firmado o venció. La firma la compara crypto.subtle.verify
// (tiempo constante).
export async function verificarSesionChat(env, token) {
  if (typeof token !== "string" || token.length < 10 || token.length > 600) return null;
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const key = await claveSesionChat(env);
  if (!key) return null;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(partes[1]),
      new TextEncoder().encode(partes[0]),
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(partes[0])));
    if (!payload || typeof payload !== "object") return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    if (typeof payload.c !== "number" || payload.c < 0) return null;
    return payload;
  } catch {
    return null;
  }
}
