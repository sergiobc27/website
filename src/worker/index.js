/**
 * Worker ultraligero: sirve los assets estáticos y reenvía /api/* a la API
 * propia (PostgreSQL/TimescaleDB en Oracle, vía Cloudflare Tunnel).
 *
 * Toda la lógica de negocio (Socrata, catálogos, exports, jobs, rate limit)
 * vive ahora en la API FastAPI. La versión anterior de este archivo (lógica
 * completa contra Socrata + Durable Objects + R2) está en el historial git.
 */

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

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      if (!isPublicApiPath(url.pathname)) {
        return new Response(JSON.stringify({ error: "Ruta no disponible." }), {
          status: 404,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      }
      const upstream = new URL(url.pathname + url.search, env.API_ORIGIN);
      const headers = new Headers(request.headers);
      headers.set("host", upstream.host);
      if (env.IDEAM_PROXY_SECRET) {
        headers.set("x-ideam-proxy-secret", env.IDEAM_PROXY_SECRET);
      }
      // La IP real del cliente, para el rate limiting de la API.
      const clientIp = request.headers.get("cf-connecting-ip");
      if (clientIp) headers.set("cf-connecting-ip", clientIp);

      const cacheable = request.method === "GET" && CACHEABLE_GET_PATHS.has(url.pathname);
      return fetch(new Request(upstream, {
        method: request.method,
        headers,
        body: request.body,
        redirect: "manual",
      }), cacheable ? { cf: { cacheEverything: true } } : undefined);
    }

    return env.ASSETS.fetch(request);
  },
};

// --- Asistente / tutor hidrológico (Workers AI) -------------------------------

const CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

const CHAT_SYSTEM = `Eres el asistente de "IDEAM Hydrology Data Automator", una plataforma web (ideam.sergiobc.com) de datos hidrometeorológicos del IDEAM (Colombia) creada como tesis de Ingeniería Civil. Eres un TUTOR que ayuda a estudiantes e ingenieros a entender y usar la plataforma. Responde SIEMPRE en español, claro y breve (2-5 frases salvo que pidan más).

Puedes explicar conceptos de hidrología: precipitación, curvas IDF (Intensidad-Duración-Frecuencia), período de retorno, distribución de Gumbel, SPI (índice de sequía), hietograma, histograma, coeficiente de escorrentía, método racional Q=C·I·A, tiempo de concentración. Y puedes guiar el uso de las pestañas: Dashboard, Analítica, Mapa de Estaciones, Comparador, Ficha Climática, Hidrología (con la calculadora de caudal), Extractor de Datos, Estado del Espejo.

REGLA CRÍTICA: NO inventes datos numéricos específicos (cifras de lluvia, caudales, intensidades, fechas, conteos de estaciones). Si te piden un dato concreto, NO lo adivines: indica en qué pestaña obtenerlo (p. ej. "consulta la pestaña Analítica para esa estación" o "usa la calculadora de caudal en Hidrología"). Si no sabes algo, dilo. Eres una ayuda educativa orientativa, NO una fuente para diseño definitivo de obras.`;

function chatJson(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function handleChat(request, env) {
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
  try {
    const result = await env.AI.run(CHAT_MODEL, {
      messages: [{ role: "system", content: CHAT_SYSTEM }, ...history],
      max_tokens: 512,
    });
    return chatJson({ reply: (result && result.response) || "", usage: (result && result.usage) || null });
  } catch (err) {
    return chatJson({ error: "El asistente no pudo responder en este momento. Intenta de nuevo." }, 502);
  }
}
