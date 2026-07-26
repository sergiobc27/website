/**
 * Worker ultraligero: sirve los assets estáticos y reenvía /api/* a la API
 * propia (PostgreSQL/TimescaleDB en Oracle, vía Cloudflare Tunnel).
 *
 * Toda la lógica de negocio (Socrata, catálogos, exports, jobs, rate limit)
 * vive ahora en la API FastAPI. La versión anterior de este archivo (lógica
 * completa contra Socrata + Durable Objects + R2) está en el historial git.
 *
 * OJO al editar: este es el módulo de ENTRADA del Worker y workerd solo acepta
 * aquí exports que sean handlers. Un `export` con nombre (una constante o un
 * helper "para el test") hace que el runtime se niegue a arrancar con
 * "Incorrect type for map entry '<NOMBRE>': the provided value is not of type
 * 'function or ExportedHandler'", y `wrangler dev` deja de servir. Lo único que
 * se exporta desde aquí es `export default { fetch }`; todo lo que un test
 * necesite importar suelto vive en un módulo aparte (chatPrompt.js,
 * chatSession.js, proxyHeaders.js, chatData.js, idfPdfDoc.js).
 */

import { buildIdfPdf } from "./idfPdfDoc.js";
import { buildUpstreamHeaders } from "./proxyHeaders.js";
import {
  CHAT_REJECTION,
  CHAT_SYSTEM,
  cifrasConUnidadFueraDe,
  ensureDatoCurioso,
  ensureDisclaimer,
  ensureReferencia,
  insertarAntesDelCierre,
  looksLikeManipulation,
  numerosDeTexto,
} from "./chatPrompt.js";
import {
  CHAT_SESSION_MAX_MSGS,
  CHAT_SESSION_TTL_S,
  claveSesionChat,
  firmarSesionChat,
  verificarSesionChat,
} from "./chatSession.js";
import {
  boxJson,
  pareceConsultaDatos,
  mencionaAqui,
  extraerIntencion,
  consultarDatos,
  promptDeDatos,
  construirAcciones,
  construirAccionesFallback,
  departamentoDeMunicipio,
  extraerSugerencias,
  limpiarFugasDeJson,
  sugerenciasFallback,
  textoDeIA,
  normalizarDecimalesEsCO,
  SUGERENCIAS_PROMPT,
  VISTA_LABELS,
} from "./chatData.js";

// GETs de metadata/catálogo cacheables en el borde. Cloudflare no cachea JSON
// por defecto (la elegibilidad es por extensión de archivo): cacheEverything
// la activa y el TTL lo dicta el Cache-Control que pone la API. Lista BLANCA
// a propósito: jobs, exports y preview son estado vivo y jamás deben cachearse.
const CACHEABLE_GET_PATHS = new Set([
  "/api/meta",
  "/api/date-range",
  "/api/municipalities",
  "/api/stations.geojson",
  "/api/analytics/datasets-overview",
  "/api/analytics/idf-stations",
  "/api/analytics/idf-nearest",
]);

// Allowlist de rutas públicas (hallazgo de auditoría): el secreto del proxy
// autentica al Worker, no al usuario — sin esta lista, TODA la API quedaba
// expuesta de facto. Fuera quedan endpoints internos/huérfanos
// (/api/export-page, /api/catalog-status, /api/export legacy).
const PUBLIC_API_ROUTES = new Set([
  "/api/health",
  // /api/ready NO es público: toca la DB (SELECT 1, conexión del pool) y sería
  // un DoS barato anónimo. El healthcheck del box lo consulta por 127.0.0.1,
  // sin pasar por el Worker (auditoría #4).
  "/api/meta",
  "/api/date-range",
  "/api/municipalities",
  "/api/stations.geojson",
  "/api/catalog-bundle",
  "/api/catalog-options",
  "/api/stations-helper",
  "/api/coverage",
  "/api/preview",
  "/api/export-plan",
  "/api/jobs",
  "/api/analytics/datasets-overview",
  "/api/analytics/timeseries",
  "/api/analytics/summary-stats",
  "/api/analytics/by-region",
  "/api/analytics/by-station",
  "/api/analytics/monthly-climatology",
  "/api/analytics/return-periods",
  "/api/analytics/spi",
  "/api/analytics/histogram",
  "/api/analytics/idf",
  "/api/analytics/idf-stations",
  "/api/analytics/idf-nearest",
]);

function isPublicApiPath(pathname) {
  return PUBLIC_API_ROUTES.has(pathname) || pathname.startsWith("/api/jobs/");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Asistente (Workers AI): lo maneja el Worker EN EL EDGE, no se proxea al
    // box (que no tiene IA). Aislado del resto: si falla, nada más se afecta.
    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    // Emisión de la sesión firmada del chat (freno anti-abuso del flujo caro):
    // el navegador canjea aquí su token Turnstile por un token de sesión.
    if (url.pathname === "/api/chat/session") {
      return handleChatSession(request, env);
    }

    // Reportes de violaciones CSP (report-uri/report-to de public/_headers).
    // Va antes del proxy genérico y EXENTO del chequeo de Origin: el navegador
    // manda estos POST fuera del CORS clásico (a veces sin Origin).
    if (url.pathname === "/api/csp-report") {
      return handleCspReport(request);
    }

    // Envío del PDF de curvas IDF por correo (Resend) — manejado EN EL EDGE, no
    // se proxea al box. Anti-abuso: Turnstile + rate-limit por IP en KV.
    if (url.pathname === "/api/email-idf") {
      return handleEmailIdf(request, env);
    }

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      if (!isPublicApiPath(url.pathname)) {
        return new Response(JSON.stringify({ error: "Ruta no disponible." }), {
          status: 404,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      }
      const upstream = new URL(url.pathname + url.search, env.API_ORIGIN);
      // Allowlist de headers (no se clona el header bag del cliente): inyecta el
      // secreto del proxy desde el env, fija el host del upstream y propaga la
      // cf-connecting-ip de confianza del borde.
      const headers = buildUpstreamHeaders(request.headers, env, upstream.host);

      const cacheable = request.method === "GET" && CACHEABLE_GET_PATHS.has(url.pathname);
      return fetch(new Request(upstream, {
        method: request.method,
        headers,
        body: request.body,
        redirect: "manual",
      }), cacheable ? { cf: { cacheEverything: true } } : undefined);
    }

    // PDFs de las fuentes/referencias del proyecto, servidos desde R2 (mismo
    // origen, con noindex). run_worker_first incluye /fuentes/* para que el
    // Worker conteste antes que los assets estáticos.
    if (url.pathname.startsWith("/fuentes/")) {
      return handleFuente(url, request, env);
    }

    // Videoguías (MP4) del proyecto, en el mismo bucket R2 bajo el prefijo
    // `videos/`. La página que las reproduce es la vista /guias del SPA; esta
    // ruta solo entrega el archivo.
    if (url.pathname.startsWith("/videos/")) {
      return handleVideo(url, request, env);
    }

    // Los assets estáticos los sirve Cloudflare directamente (run_worker_first
    // está acotado a /api/*, /fuentes/* y /videos/*), así que las cabeceras de
    // seguridad de documento se definen en `dist/_headers` (public/_headers), no aquí.
    return env.ASSETS.fetch(request);
  },
};

// --- Archivos del proyecto en R2 (PDFs de fuentes, videoguías) ----------------

// Sirve /fuentes/<id>.pdf desde el bucket R2 `FUENTES`, con la clave saneada
// (^[a-z0-9-]+\.pdf$ — evita traversal).
async function handleFuente(url, request, env) {
  let nombre;
  try {
    nombre = decodeURIComponent(url.pathname.slice("/fuentes/".length));
  } catch {
    return new Response("Ruta inválida.", { status: 400 });
  }
  if (!/^[a-z0-9-]+\.pdf$/.test(nombre)) {
    return new Response("No encontrado.", { status: 404 });
  }
  return serveR2(nombre, request, env, { contentType: "application/pdf", maxAge: 86400 });
}

// Sirve /videos/<slug>.mp4 desde el mismo bucket bajo el prefijo `videos/`.
// Caché de 7 días: los slugs son estables, pero una guía corregida no debe
// quedar cacheada un mes en el navegador de quien ya la vio.
async function handleVideo(url, request, env) {
  let nombre;
  try {
    nombre = decodeURIComponent(url.pathname.slice("/videos/".length));
  } catch {
    return new Response("Ruta inválida.", { status: 400 });
  }
  if (!/^[a-z0-9-]+\.mp4$/.test(nombre)) {
    return new Response("No encontrado.", { status: 404 });
  }
  return serveR2(`videos/${nombre}`, request, env, { contentType: "video/mp4", maxAge: 604800 });
}

// Entrega un objeto de R2 con soporte de Range (solo GET/HEAD) y
// X-Robots-Tag: noindex. El Range no es un lujo: es lo que permite al visor de
// PDF pedir páginas sueltas de un documento grande (RAS, ENA 2022) y al
// reproductor de video arrastrar la barra de tiempo, en vez de bajar el archivo
// completo. `key` llega ya validada por quien llama, nunca cruda de la URL.
async function serveR2(key, request, env, { contentType, maxAge }) {
  if (!env.FUENTES) {
    return new Response("Almacenamiento no disponible.", { status: 503 });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Método no permitido.", { status: 405, headers: { allow: "GET, HEAD" } });
  }

  const rangeHeader = request.headers.get("range");
  let object;
  if (rangeHeader) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (m && (m[1] !== "" || m[2] !== "")) {
      const r = {};
      if (m[1] !== "") {
        r.offset = Number(m[1]);
        if (m[2] !== "") r.length = Number(m[2]) - Number(m[1]) + 1;
      } else {
        r.suffix = Number(m[2]);
      }
      object = await env.FUENTES.get(key, { range: r });
    } else {
      object = await env.FUENTES.get(key);
    }
  } else {
    object = await env.FUENTES.get(key);
  }

  if (!object) {
    return new Response("No encontrado.", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", contentType);
  headers.set("content-disposition", "inline");
  headers.set("cache-control", `public, max-age=${maxAge}`);
  headers.set("x-robots-tag", "noindex");
  headers.set("x-content-type-options", "nosniff");
  headers.set("accept-ranges", "bytes");
  if (object.httpEtag) headers.set("etag", object.httpEtag);

  const body = request.method === "HEAD" ? null : object.body;

  if (rangeHeader && object.range) {
    const size = object.size;
    let start = object.range.offset ?? 0;
    let end = size - 1;
    if (object.range.length != null) end = start + object.range.length - 1;
    else if (object.range.suffix != null) start = size - object.range.suffix;
    headers.set("content-range", `bytes ${start}-${end}/${size}`);
    return new Response(body, { status: 206, headers });
  }

  return new Response(body, { status: 200, headers });
}

// --- Reportes de violaciones CSP ----------------------------------------------

// Recibe los reportes que el navegador envía por el report-uri/report-to de la
// política CSP (public/_headers) y los deja en Workers Observability vía
// console.log, para observar violaciones ANTES de promover la política
// Report-Only a enforcing. Con límite de tamaño para que nadie lo use como
// canal de log-spam. Siempre responde 204 (el navegador ignora el cuerpo).
const CSP_REPORT_MAX_BYTES = 16 * 1024;

async function handleCspReport(request) {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { allow: "POST" } });
  }
  const declarado = Number(request.headers.get("content-length") || "0");
  if (declarado > CSP_REPORT_MAX_BYTES) {
    return new Response(null, { status: 413 });
  }
  let texto = "";
  try {
    texto = (await request.text()).slice(0, CSP_REPORT_MAX_BYTES);
  } catch {
    /* cuerpo ilegible: igual respondemos 204, no hay nada que registrar */
  }
  if (texto.trim()) console.log("csp-report:", texto);
  return new Response(null, { status: 204 });
}

// --- Asistente / tutor hidrológico (Workers AI) -------------------------------

// Llama 4 Scout (17B MoE): salto de calidad sobre el 8B (mejor español, presenta
// el dato parcial en vez de negarse, menos invención), gratis y dentro de la
// cuota de neuronas según el consumo real medido. (El 8B base se deprecó el
// 2026-05-30 → AiError 5028; el fp8 fue el puente.) Devuelve `.response` (texto)
// y, en JSON mode, el intent como objeto; textoDeIA/extraerIntencion lo manejan.
const CHAT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

function chatJson(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// Sanea la ubicación que manda el cliente (municipio/departamento/estación ya
// resueltos en el navegador). Era la única entrada de texto libre del cliente
// que llegaba al system prompt sin whitelist (hallazgo de auditoría), así que
// además de recortar longitud y colapsar espacios/saltos: (1) se restringe a un
// charset de topónimos (letras con tildes, dígitos y puntuación básica; fuera
// comillas, llaves y símbolos con los que se arma una instrucción), y (2) se
// pasa el MISMO guardrail anti-manipulación del historial; si dispara, la
// ubicación se descarta entera y no llega al prompt. Si no hay ni municipio ni
// departamento, no hay ubicación utilizable.
function saneaUbicacion(u) {
  if (!u || typeof u !== "object") return null;
  const s = (v) =>
    String(v == null ? "" : v)
      .replace(/[^0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ .,()/-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
  const municipio = s(u.municipio);
  const departamento = s(u.departamento);
  const estacion = s(u.estacion);
  if (!municipio && !departamento) return null;
  if (looksLikeManipulation(`${municipio} ${departamento} ${estacion}`)) return null;
  return { municipio, departamento, estacion };
}

// Solo nuestro propio sitio puede consumir la cuota de Workers AI y el envío de
// correo desde el navegador. Para los POST con costo/estado (chat, sesión del
// chat, correo) el Origin se exige PRESENTE y en la allowlist (hallazgo de
// auditoría: un fetch POST del navegador siempre manda Origin, incluso
// same-origin, así que exigirlo no rompe al usuario legítimo y sí frena al
// cliente no-browser casual; la defensa real anti-abuso sigue siendo Turnstile
// + sesión firmada + rate-limit). Los GET same-origin (que llegan sin Origin)
// no pasan por aquí. /api/csp-report queda exento: los navegadores mandan esos
// reportes fuera del CORS clásico.
const CHAT_ORIGIN_HOSTS = new Set(["ideam.sergiobc.com", "sergiobc.com", "localhost", "127.0.0.1"]);
function originValido(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return CHAT_ORIGIN_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

// POST /api/chat/session: canjea un token Turnstile por la sesión firmada del
// chat. Turnstile se verifica fail-CLOSED (igual que en el correo). Si el
// entorno no tiene TURNSTILE_SECRET_KEY (p. ej. dev), emite la sesión sin
// challenge; si tampoco hay secreto para firmar, responde session:null y el
// chat opera sin sesión. La emisión tiene su propio rate-limit ligero por IP
// (prefijo "rls") para que nadie cultive tokens en granja.
async function handleChatSession(request, env) {
  if (request.method !== "POST") {
    return chatJson({ error: "Método no permitido." }, 405);
  }
  if (!originValido(request)) return chatJson({ error: "Origen no permitido." }, 403);
  const key = await claveSesionChat(env);
  if (!key) return chatJson({ session: null });
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const ip = request.headers.get("cf-connecting-ip");
  if (await kvRateLimited(env, "rls", 10, 500, ip)) {
    return chatJson({ error: "Demasiadas verificaciones por ahora. Intenta más tarde." }, 429);
  }
  if (env.TURNSTILE_SECRET_KEY) {
    const token = body && typeof body.turnstileToken === "string" ? body.turnstileToken : "";
    // Sin token ni siquiera se consulta siteverify: el 403 le dice al frontend
    // que muestre el widget (primer intento "a ciegas" del cliente).
    if (!token) return chatJson({ error: "Se necesita la verificación anti-robot." }, 403);
    const ok = await verifyTurnstile(token, ip, env.TURNSTILE_SECRET_KEY);
    if (!ok) return chatJson({ error: "Verificación anti-robot fallida." }, 403);
  }
  const ahora = Math.floor(Date.now() / 1000);
  const payload = { iat: ahora, exp: ahora + CHAT_SESSION_TTL_S, n: crypto.randomUUID(), c: 0 };
  return chatJson({
    session: await firmarSesionChat(env, payload),
    exp: payload.exp,
    mensajesMax: CHAT_SESSION_MAX_MSGS,
  });
}

async function handleChat(request, env) {
  if (!originValido(request)) return chatJson({ error: "Origen no permitido." }, 403);
  if (!env.AI) return chatJson({ error: "El asistente no está disponible (IA no configurada)." }, 503);
  let body;
  try {
    body = await request.json();
  } catch {
    return chatJson({ error: "Solicitud inválida." }, 400);
  }
  // Saneo: solo roles válidos, contenido string acotado, máximo 10 turnos.
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const history = incoming
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!history.length || history[history.length - 1].role !== "user") {
    return chatJson({ error: "Falta el mensaje del usuario." }, 400);
  }
  // Guardrail determinista ANTES del modelo: ataja intentos de manipulación /
  // jailbreak por patrón, sin depender del LLM (que es débil resistiéndolos) y
  // sin gastar neurons. El off-topic sutil lo maneja el system prompt. Se revisa
  // TODO el historial entrante —incluidos los turnos `assistant`, que el cliente
  // puede fabricar—, para cerrar la inyección indirecta (un turno previo
  // contaminado que reactive el jailbreak). El contenido legítimo del asistente
  // (dominio hídrico) no dispara los patrones, así que no hay falsos positivos.
  if (history.some((m) => looksLikeManipulation(m.content))) {
    return chatJson({ reply: CHAT_REJECTION, blocked: true, suggestions: [] });
  }
  // Freno del flujo caro (hallazgo de auditoría): cuando el entorno tiene
  // secretos, /api/chat exige la sesión firmada emitida en /api/chat/session
  // (detrás de Turnstile). El 401 con code:"sesion" le pide al frontend repetir
  // la verificación; el contador KV de abajo queda como respaldo.
  let sesion = null;
  if (await claveSesionChat(env)) {
    sesion = await verificarSesionChat(env, body.session);
    if (!sesion || sesion.c >= CHAT_SESSION_MAX_MSGS) {
      return chatJson(
        { error: "La sesión del chat venció o llegó a su tope de mensajes. Completa la verificación para continuar.", code: "sesion" },
        401,
      );
    }
  }
  // Rate-limit ANTES de gastar neurons: evita que un script anónimo vacíe la
  // cuota diaria gratis de Workers AI y deje el asistente caído para todos.
  if (await chatRateLimited(env, request.headers.get("cf-connecting-ip"))) {
    return chatJson({ error: "Has alcanzado el límite de mensajes por ahora. Intenta de nuevo en un rato." }, 429);
  }
  // Contexto "qué pestaña mira el usuario": whitelist (nunca texto libre del cliente).
  const view = typeof body.view === "string" && VISTA_LABELS[body.view] ? body.view : null;
  // "Dónde estoy": el cliente resuelve la estación más cercana a su ubicación y
  // manda SOLO el lugar (no las coordenadas). Se sanea (longitud, saltos de línea)
  // y se cotejará contra el catálogo, así un valor fabricado no hace daño.
  const ubicacion = saneaUbicacion(body.ubicacion);
  try {
    // Pipeline "pregúntale a tus datos": pre-filtro gratis -> extractor (IA) ->
    // consulta determinista al box. Cualquier fallo degrada al chat conceptual.
    let resultadoDatos = null;
    let intent = null;
    const ultimo = history[history.length - 1].content;
    if (pareceConsultaDatos(ultimo)) {
      intent = await extraerIntencion(env, CHAT_MODEL, history);
      if (intent && intent.intent !== "ninguno") {
        // Geografía DETERMINISTA: si el modelo dio el municipio pero no el
        // departamento, lo completa el gazetteer (no depende de que el modelo
        // sepa geografía). Sirve tanto para consultar como para el botón de fallo.
        if (intent.lugar && !intent.departamento) {
          const dep = departamentoDeMunicipio(intent.lugar);
          if (dep) intent = { ...intent, departamento: dep };
        }
        // "Dónde estoy": si el usuario alude a su ubicación ("aquí", "mi zona") —
        // o pide un valor puntual/IDF sin nombrar lugar— y hay ubicación activa,
        // resolvemos al municipio del usuario antes de consultar el espejo.
        if (
          ubicacion &&
          (mencionaAqui(ultimo) ||
            (!intent.lugar && !intent.departamento && (intent.intent === "dato_puntual" || intent.intent === "idf_tr")))
        ) {
          intent = {
            ...intent,
            lugar: intent.lugar || ubicacion.municipio,
            departamento: intent.departamento || ubicacion.departamento,
          };
        }
        resultadoDatos = await consultarDatos(env, intent);
      }
    }

    const systemParts = [CHAT_SYSTEM, SUGERENCIAS_PROMPT];
    if (view) {
      systemParts.push(`CONTEXTO DE PANTALLA: el usuario está viendo ahora mismo la pestaña "${VISTA_LABELS[view]}".`);
    }
    if (ubicacion) {
      systemParts.push(
        `CONTEXTO DE UBICACIÓN: el usuario está cerca de ${ubicacion.estacion || ubicacion.municipio} en ${ubicacion.municipio}, ${ubicacion.departamento}. Si pregunta por "aquí", "mi zona" o "donde estoy", usa ese lugar.`,
      );
    }
    if (resultadoDatos) systemParts.push(promptDeDatos(resultadoDatos));

    const result = await env.AI.run(CHAT_MODEL, {
      messages: [{ role: "system", content: systemParts.join("\n\n") }, ...history],
      max_tokens: 900,
    });
    const extraido = extraerSugerencias(textoDeIA(result));
    let reply = limpiarFugasDeJson(extraido.reply); // el bloque interno de datos jamás se muestra
    reply = normalizarDecimalesEsCO(reply); // 174.6 mm/h -> 174,6 mm/h (es-CO)
    // OJO al orden: ensureReferencia va ANTES del disclaimer. El disclaimer
    // menciona "RAS 0330 / INVÍAS"; si corriera primero, ensureReferencia
    // detectaría esos nombres y pegaría citas que el modelo nunca hizo (sello
    // bibliográfico a una alucinación). Así solo cita lo que citó el MODELO.
    reply = ensureReferencia(reply); // anexa "📚 Referencia" si el modelo citó y faltaba
    reply = ensureDisclaimer(reply); // ⚠️ orientativo / verifica constantes en fórmulas
    reply = ensureDatoCurioso(reply); // garantiza/valida "💡 Dato curioso" al final
    const esRechazo = /solo puedo ayudarte con esta plataforma/i.test(reply);
    const dataUsed = !!(resultadoDatos && resultadoDatos.ok) && !esRechazo;
    if (dataUsed) {
      // #9 — cobertura parcial garantizada por CÓDIGO (no se fía del 8B).
      if (resultadoDatos.datos && resultadoDatos.datos.coberturaParcial && !/parcial/i.test(reply)) {
        reply = insertarAntesDelCierre(reply, "ℹ️ Algunos años de la serie tienen cobertura parcial; el total puede subestimar la realidad.");
      }
      // #8 — cifra con unidad física que no proviene del bloque de datos → caveat
      // suave anclado a unidades (no reescribe ni borra, solo advierte).
      const permitidos = numerosDeTexto(JSON.stringify(resultadoDatos.datos || {}));
      if (cifrasConUnidadFueraDe(reply, permitidos) && !/confirma las cifras exactas/i.test(reply)) {
        reply = insertarAntesDelCierre(reply, "ℹ️ Confirma las cifras exactas en la pestaña correspondiente; algún número podría no provenir directamente de los datos consultados.");
      }
    }
    if (dataUsed && !reply.includes("📊 Fuente:")) {
      // La línea de fuente la pone el CÓDIGO, no el modelo: una respuesta con
      // datos del espejo siempre declara su origen. Un rechazo (el 8B a veces
      // rechaza pese a tener datos) jamás lleva fuente: sería contradictorio.
      reply += "\n\n📊 Fuente: espejo de datos IDEAM (consulta en vivo)";
    }
    let suggestions = extraido.suggestions;
    if (esRechazo) {
      suggestions = []; // el rechazo va literal, sin chips
    } else if (!suggestions.length) {
      suggestions = sugerenciasFallback(intent);
    }
    // Botones de acción (deep-links) que el CÓDIGO arma desde el intent resuelto.
    // Con datos: enlaces precisos. Sin datos (pero era pregunta de datos y no fue
    // un rechazo): igual ofrece DÓNDE verlo en la plataforma (lo que pidió Sergio).
    const acciones = dataUsed
      ? construirAcciones(intent, resultadoDatos)
      : (intent && !esRechazo ? construirAccionesFallback(intent, resultadoDatos) : []);
    // Sesión renovada: mismo vencimiento y nonce, contador de mensajes +1. El
    // cliente debe usar SIEMPRE el último token recibido.
    const session = sesion ? await firmarSesionChat(env, { ...sesion, c: sesion.c + 1 }) : undefined;
    return chatJson({
      reply,
      suggestions,
      acciones,
      dataUsed,
      usage: (result && result.usage) || null,
      ...(session ? { session, exp: sesion.exp } : {}),
    });
  } catch (err) {
    // El 502 de cara al usuario es mudo; este log deja la causa real en Workers
    // Observability (p. ej. fallo o cuota agotada de Workers AI).
    console.error("handleChat: fallo en el pipeline del chat:", err && (err.stack || err.message || String(err)));
    return chatJson({ error: "El asistente no pudo responder en este momento. Intenta de nuevo." }, 502);
  }
}

// --- Envío de curvas IDF por correo (Resend) ---------------------------------

// Validación deliberadamente PERMISIVA (cualquier "algo@algo.algo"): solo evita
// basura obvia, no pretende validar RFC 5322 (intentarlo rechaza correos válidos
// y nunca atrapa todos los inválidos). La defensa real contra abuso es Turnstile
// + el rate-limit; la entregabilidad la resuelve el manejo de rebotes de Resend.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RL_MAX_PER_HOUR = 15;                  // tope relajado por IP (correo)
const RL_GLOBAL_PER_DAY = 100;               // backstop global (límite gratis de Resend)
const CHAT_RL_PER_HOUR = 30;                 // mensajes/hora por IP (chat)
const CHAT_GLOBAL_CALLS_PER_DAY = 1500;      // backstop global en LLAMADAS IA (peso 3/mensaje)
const CHAT_CALLS_POR_MENSAJE = 3;            // peor caso del pipeline: extractor + reintento + redactor

function emailJson(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function verifyTurnstile(token, ip, secret) {
  if (!secret) return false;
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token || "");
  if (ip) body.set("remoteip", ip);
  // Fail-CLOSED: si la red a siteverify cae (el fetch lanza) o el JSON es
  // inválido, tratamos al cliente como NO verificado. Antes el .catch solo
  // cubría el parseo del JSON, no la excepción del propio fetch (hallazgo de
  // auditoría): una red caída habría tumbado la request con un 500.
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const data = await r.json().catch(() => ({ success: false }));
    return data.success === true;
  } catch {
    return false;
  }
}

// KV admite ~1 escritura/segundo por clave: bajo ráfaga el put rechaza la
// promesa y sin esto la excepción tumbaba la request con un 500 (hallazgo de
// auditoría). El rate-limit falla ABIERTO en el conteo, nunca rompe el flujo.
async function kvPutSafe(env, key, value, expirationTtl) {
  try {
    await env.EMAIL_RL.put(key, value, { expirationTtl });
  } catch {
    /* contar de menos un hit es aceptable; tumbar la request no */
  }
}

// Rate-limit genérico en KV: contador horario por IP (TTL 1h) + tope GLOBAL
// diario (TTL 24h) como backstop contra rotación de IP. `prefix` aísla los
// contadores por feature (correo vs chat). Si no hay binding KV, no limita.
// `commitGlobal: false` solo CHEQUEA el tope global sin consumirlo (el correo
// lo consume después de validar la estación, vía bumpGlobalDay).
//
// LIMITACIÓN CONOCIDA (carrera read-modify-write, hallazgo de auditoría): el
// patrón get-luego-put NO es atómico. Bajo una RÁFAGA concurrente desde la misma
// IP, varias requests leen el mismo `current` antes de que ninguna escriba, así
// que el contador por IP puede sub-contar (un atacante decidido obtiene un
// bypass SUAVE del límite por-IP). NO se corrige aquí a propósito: la solución
// correcta —un Durable Object contador o el binding nativo de Rate Limiting—
// exige una migración de wrangler.jsonc (riesgo de despliegue) y un rearmado que
// queda DIFERIDO. Mitigaciones vigentes que ACOTAN el radio de impacto:
//   1) el tope GLOBAL diario (`perDay`) limita el daño agregado aunque una IP
//      escape su cupo horario: es el verdadero techo duro y está alineado a las
//      cuotas free reales (Resend 100/día; Workers AI vía peso 3/mensaje), y
//      su lectura falla CERRADO (ver abajo) para que un fallo de KV no deje el
//      flujo caro sin techo;
//   2) los DOS flujos caros exigen prueba-de-humano ANTES del rate-limit: el
//      correo verifica Turnstile por envío y el chat exige la sesión firmada
//      (emitida tras Turnstile en /api/chat/session), así que una ráfaga
//      anónima ni siquiera llega a esta función;
//   3) KV es de "consistencia eventual" pero converge en segundos, de modo que
//      la ventana de sub-conteo es breve, no permanente.
//
// Los prefijos ("rl" correo, "rlc" chat, "rls" emisión de sesión) separan los
// contadores dentro del MISMO namespace KV (EMAIL_RL): un incidente de KV los
// degrada a la vez, limitación aceptada y documentada; la salida definitiva
// (namespace aparte o el binding nativo de Rate Limiting) exige migración de
// wrangler.jsonc y queda diferida a propósito.
async function kvRateLimited(env, prefix, perHour, perDay, ip, commitGlobal = true, pesoGlobal = 1) {
  if (!env.EMAIL_RL) return false;

  // Tope GLOBAL diario: el contador que protege el GASTO (cuota de Resend /
  // neurons de Workers AI) falla CERRADO. Antes un fallo de KV tumbaba a la vez
  // el freno por-IP y el global (fail-open compuesto, hallazgo de auditoría) y
  // el backstop real quedaba reducido a Turnstile + la cuota del proveedor.
  const gKey = `${prefix}:global:day`;
  let gCount;
  try {
    gCount = Number((await env.EMAIL_RL.get(gKey)) || "0");
  } catch {
    return true;
  }
  if (gCount >= perDay) return true;

  // Contador por-IP: sigue fallando ABIERTO (contar de menos un hit es
  // aceptable; el techo del gasto ya quedó garantizado arriba).
  try {
    if (ip) {
      const key = `${prefix}:ip:${ip}`;
      const current = Number((await env.EMAIL_RL.get(key)) || "0");
      if (current >= perHour) return true;
      await kvPutSafe(env, key, String(current + 1), 3600);
    }

    // `pesoGlobal` permite que un flujo descuente más de 1 del tope global (el
    // chat gasta hasta 3 llamadas IA por mensaje: el cupo refleja neuronas reales).
    if (commitGlobal) await kvPutSafe(env, gKey, String(gCount + pesoGlobal), 86400);
    return false;
  } catch {
    return false;
  }
}

// Consume 1 unidad del tope global diario (para flujos que validan ANTES de
// gastar cupo, como el correo: una estación inválida ya no quema los 100/día).
async function bumpGlobalDay(env, prefix) {
  if (!env.EMAIL_RL) return;
  try {
    const gKey = `${prefix}:global:day`;
    const gCount = Number((await env.EMAIL_RL.get(gKey)) || "0");
    await kvPutSafe(env, gKey, String(gCount + 1), 86400);
  } catch {
    /* fallar abierto */
  }
}

// Correo: tope relajado + backstop global alineado al límite gratis de Resend.
// commitGlobal=false: el cupo global se consume tras validar la estación.
const emailRateLimited = (env, ip) => kvRateLimited(env, "rl", RL_MAX_PER_HOUR, RL_GLOBAL_PER_DAY, ip, false);
// Chat (Workers AI): protege la cuota diaria de neurons del tier gratis. El tope
// global cuenta LLAMADAS IA (peso 3/mensaje); el límite por IP cuenta mensajes.
const chatRateLimited = (env, ip) =>
  kvRateLimited(env, "rlc", CHAT_RL_PER_HOUR, CHAT_GLOBAL_CALLS_PER_DAY, ip, true, CHAT_CALLS_POR_MENSAJE);

// Escapa HTML para impedir inyección/phishing en el cuerpo del correo: los
// campos vienen del cliente y el correo sale desde nuestro dominio verificado.
function escHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function emailHtml(stationName, stationCode, filename) {
  return `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
  <div style="max-width:560px;margin:0 auto;background:#ffffff">
    <div style="background:#A3161A;padding:20px 24px;color:#ffffff">
      <div style="font-size:20px;font-weight:bold">Curvas IDF</div>
      <div style="font-size:12px;opacity:.9">Intensidad-Duracion-Frecuencia</div>
    </div>
    <div style="height:4px;background:#C9A227"></div>
    <div style="padding:24px">
      <p>Hola,</p>
      <p>Adjunto encontrar&aacute;s el PDF con las curvas Intensidad-Duraci&oacute;n-Frecuencia
      de la estaci&oacute;n <strong>${escHtml(stationName)}</strong> (${escHtml(stationCode)}), solicitadas en la plataforma.</p>
      <p style="color:#595959">&#128206; ${escHtml(filename)}</p>
    </div>
    <div style="border-top:1px solid #e5e5e5;padding:16px 24px;font-size:12px;color:#595959">
      <a href="https://ideam.sergiobc.com" style="color:#A3161A;text-decoration:none">ideam.sergiobc.com</a><br/>
      Ing. Civil Sergio Beltr&aacute;n Coley &middot; Universidad de la Costa (CUC)
    </div>
  </div>
</body></html>`;
}

// boxJson (llamadas al box con el secreto del proxy) vive en chatData.js.

function u8ToBase64(u8) {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
  }
  return btoa(s);
}

function slugCode(v) {
  return String(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function todayCO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

async function handleEmailIdf(request, env) {
  if (request.method !== "POST") {
    return emailJson({ error: "Método no permitido." }, 405);
  }
  // Mismo control de Origin estricto que el chat: es un POST con costo (correo
  // saliente desde nuestro dominio) que solo dispara nuestro propio frontend.
  if (!originValido(request)) {
    return emailJson({ error: "Origen no permitido." }, 403);
  }
  // Sin el secreto de Resend no hay forma de enviar: cortar TEMPRANO (igual que
  // el guard de !env.AI del chat), antes de Turnstile, generar el PDF y quemar
  // cupo de rate-limit. Sin esto, disparábamos a Resend con "Bearer undefined".
  if (!env.RESEND_API_KEY) {
    return emailJson({ error: "El envío de correo no está disponible (servicio no configurado)." }, 503);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return emailJson({ error: "JSON inválido." }, 400);
  }
  const { to, turnstileToken, stationCode } = body || {};
  if (typeof to !== "string" || !EMAIL_RE.test(to.trim())) {
    return emailJson({ error: "Correo inválido." }, 400);
  }
  // El cliente SOLO aporta el código de estación (validado contra el catálogo del
  // box). El PDF lo genera el Worker desde datos de confianza: el endpoint no
  // puede usarse para colar adjuntos arbitrarios (cierre del open relay).
  if (typeof stationCode !== "string" || !/^[0-9A-Za-z]{3,20}$/.test(stationCode)) {
    return emailJson({ error: "Código de estación inválido." }, 400);
  }
  const ip = request.headers.get("cf-connecting-ip");

  const ok = await verifyTurnstile(turnstileToken, ip, env.TURNSTILE_SECRET_KEY);
  if (!ok) {
    return emailJson({ error: "Verificación anti-robot fallida." }, 403);
  }
  if (await emailRateLimited(env, ip)) {
    return emailJson({ error: "Demasiados envíos. Intenta más tarde." }, 429);
  }

  // Metadatos de la estación (catálogo de IDF, de confianza). Si el código no
  // está, no es una estación con IDF: no enviamos nada.
  const catalog = await boxJson(env, "/api/analytics/idf-stations");
  const meta = ((catalog && catalog.stations) || []).find((s) => s.codigo === stationCode);
  if (!meta) {
    return emailJson({ error: "Esa estación no tiene curvas IDF disponibles." }, 422);
  }

  // Curvas IDF reales de esa estación (mismo contrato que usa la web).
  const idf = await boxJson(env, "/api/analytics/idf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ datasetId: "s54a-sgyg", departments: [], catalogFilters: { stations: [stationCode] } }),
  });
  if (!idf || !idf.available) {
    return emailJson({ error: "Esa estación no tiene curvas IDF disponibles." }, 422);
  }

  const station = {
    nombre: meta.nombre || stationCode,
    codigo: stationCode,
    municipio: meta.municipio || "N/D",
    departamento: meta.departamento || "N/D",
    fecha: todayCO(),
  };

  let pdfBytes;
  try {
    pdfBytes = await buildIdfPdf(idf, station);
  } catch {
    return emailJson({ error: "No se pudo generar el PDF." }, 500);
  }
  const filename = `curva-idf-${slugCode(station.nombre) || stationCode}.pdf`;

  // Ya pasó todas las validaciones: ahora sí consume cupo global del día.
  await bumpGlobalDay(env, "rl");

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: "IDEAM · Curvas IDF <contacto@sergiobc.com>",
      to: to.trim(),
      reply_to: "sergiobeltrancoley@gmail.com",
      subject: `Tus curvas IDF · ${station.nombre} — ideam.sergiobc.com`,
      html: emailHtml(station.nombre, station.codigo, filename),
      attachments: [{ filename, content: u8ToBase64(pdfBytes) }],
    }),
  });

  if (!resp.ok) {
    return emailJson({ error: "No se pudo enviar el correo." }, 502);
  }
  return emailJson({ ok: true }, 200);
}
