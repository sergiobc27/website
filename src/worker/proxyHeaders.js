/**
 * Headers salientes hacia la API propia (el "box"): allowlist de lo que se
 * reenvía + inyección del secreto del proxy. Módulo aparte porque el módulo de
 * entrada del Worker solo puede exportar handlers (un `export` con nombre en
 * index.js hace que workerd se niegue a arrancar: "Incorrect type for map
 * entry"), y esta función se testea aislada.
 */

// Allowlist de headers reenviados al box (hallazgo de auditoría): clonar TODO el
// header bag del cliente filtraba a la API privada cookies, Authorization y
// cabeceras arbitrarias. Solo dejamos pasar lo que la API necesita; el resto se
// descarta. `cf-connecting-ip` es de CONFIANZA del borde (Cloudflare la fija),
// se propaga aparte para el rate-limit de la API.
const FORWARDED_HEADERS = new Set([
  "content-type",
  "accept",
  "content-length",
  "user-agent",
]);

// Construye los headers salientes hacia el box a partir de una allowlist (NO
// clona el header bag del cliente). Inyecta el secreto del proxy desde el env y
// fija el host del upstream. Pura y exportada para poder testearla aislada.
export function buildUpstreamHeaders(requestHeaders, env, upstreamHost) {
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const v = requestHeaders.get(name);
    if (v != null) headers.set(name, v);
  }
  // La IP real del cliente la fija el borde (Cloudflare); es de confianza y la
  // API la usa para su rate-limiting.
  const clientIp = requestHeaders.get("cf-connecting-ip");
  if (clientIp) headers.set("cf-connecting-ip", clientIp);

  headers.set("host", upstreamHost);
  // Nunca dejar pasar un secreto falsificado por el cliente: al construir desde
  // cero la allowlist ya lo excluye, pero el secreto del Worker se inyecta
  // SIEMPRE desde el env (jamás el que pudiera mandar el cliente).
  if (env.IDEAM_PROXY_SECRET) {
    headers.set("x-ideam-proxy-secret", env.IDEAM_PROXY_SECRET);
  }
  return headers;
}
