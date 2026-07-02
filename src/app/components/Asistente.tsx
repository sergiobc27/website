import { useEffect, useRef, useState, type ReactNode } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { ArrowRight, Bot, Check, Copy, MapPin, MessageCircle, Send, User, X } from 'lucide-react';
import { apiJson, ApiError } from '../lib/ideamApi';
import { cercaDelFondo, formatChatError, parseAcciones, type Accion } from '../lib/chatUi';
import { NAVIGATE_EVENT, type NavigateDetail } from '../lib/navigation';
import { estacionMasCercana, type EstacionFeature, type EstacionGeo } from '../lib/geo';
import { Turnstile } from './Turnstile';

// Sesión firmada del chat (freno anti-abuso del Worker): se obtiene en
// POST /api/chat/session tras pasar Turnstile (una vez por hora, misma site key
// del correo) y el Worker devuelve un token renovado en cada respuesta. Se
// guarda en sessionStorage para sobrevivir a re-montajes del panel.
const CHAT_SESSION_KEY = 'ideam:chat-session';

function leerSesionGuardada(): string | null {
  try {
    const raw = sessionStorage.getItem(CHAT_SESSION_KEY);
    if (!raw) return null;
    const { token, exp } = JSON.parse(raw) as { token?: string; exp?: number | null };
    if (typeof token !== 'string' || !token) return null;
    // Margen de 30 s para no mandar un token a punto de vencer.
    if (typeof exp === 'number' && exp * 1000 < Date.now() + 30_000) return null;
    return token;
  } catch {
    return null;
  }
}

function guardarSesion(token: string | null, exp: number | null) {
  try {
    if (!token) sessionStorage.removeItem(CHAT_SESSION_KEY);
    else sessionStorage.setItem(CHAT_SESSION_KEY, JSON.stringify({ token, exp }));
  } catch {
    /* almacenamiento no disponible: la sesión vive solo en memoria */
  }
}

// Render de fórmulas LaTeX con KaTeX. KaTeX genera su propio markup seguro a
// partir del LaTeX (no inserta HTML del usuario) y con throwOnError:false nunca
// rompe la UI aunque el modelo emita LaTeX inválido.
function Math({ tex, display }: { tex: string; display?: boolean }) {
  // Cap de longitud: LaTeX patológicamente largo/anidado puede ralentizar el
  // render de KaTeX. Por encima del límite lo mostramos como código crudo.
  if (tex.length > 500) {
    return <code className="rounded bg-muted px-1 py-0.5 text-[0.8em]">{tex}</code>;
  }
  let html = '';
  try {
    html = katex.renderToString(tex, { throwOnError: false, displayMode: !!display });
  } catch {
    return <code className="rounded bg-muted px-1 py-0.5 text-[0.8em]">{tex}</code>;
  }
  return display ? (
    <span className="my-1 block overflow-x-auto text-center" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  );
}

// Render ligero de markdown para las respuestas del asistente. Construye nodos
// React (NUNCA HTML crudo del modelo) → sin riesgo de XSS aunque el LLM emita lo
// que sea. Cubre lo que produce Llama: fórmulas LaTeX ($…$), negritas, cursivas,
// `código`, viñetas, listas numeradas, párrafos y el realce del "💡 Dato curioso".
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /\$([^$\n]+)\$|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      nodes.push(<Math key={`${keyPrefix}-m${i}`} tex={m[1]} />);
    } else if (m[2] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`} className="font-semibold">{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      nodes.push(<em key={`${keyPrefix}-i${i}`}>{m[3]}</em>);
    } else if (m[4] !== undefined) {
      nodes.push(<code key={`${keyPrefix}-c${i}`} className="rounded bg-muted px-1 py-0.5 text-[0.8em]">{m[4]}</code>);
    }
    last = m.index + m[0].length;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function MensajeFormateado({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((block, bi) => {
        const lines = block.split('\n').filter((l) => l.trim().length > 0);
        if (lines.length === 0) return null;
        // Fórmula en bloque (centrada): $$ ... $$
        const mathBlock = block.match(/^\s*\$\$([\s\S]+?)\$\$\s*$/);
        if (mathBlock) {
          return <Math key={bi} tex={mathBlock[1].trim()} display />;
        }
        if (/^\s*\**\s*(💡|dato curioso)/i.test(block)) {
          // Limpia etiquetas/emojis repetidos ("Dato curioso: 💡 Dato curioso:")
          // y deja un único realce uniforme.
          const limpio = block
            .replace(/\n+/g, ' ')
            .replace(/(\*\*\s*)?💡?\s*dato curioso\s*:?\s*/gi, '')
            .trim();
          return (
            <div key={bi} className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2">
              💡 <strong className="font-semibold">Dato curioso:</strong> {renderInline(limpio, `dc${bi}`)}
            </div>
          );
        }
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return (
            <ul key={bi} className="list-disc space-y-1 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^\s*[-*•]\s+/, ''), `ul${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
          return (
            <ol key={bi} className="list-decimal space-y-1 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^\s*\d+[.)]\s+/, ''), `ol${bi}-${li}`)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={bi} className="leading-relaxed">
            {lines.map((l, li) => (
              <span key={li}>
                {renderInline(l, `p${bi}-${li}`)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGERENCIAS = [
  '¿Qué es un período de retorno?',
  '¿Cómo interpreto una curva IDF?',
  '¿Qué significa un SPI de -1.8?',
  '¿Cómo descargo datos de un departamento?',
  '¿Para qué sirve el coeficiente de escorrentía?',
];

interface AsistenteProps {
  /** Vista actual de la app (contexto "qué estoy viendo"); se envía al Worker. */
  view?: string;
  /** Dentro del panel flotante: layout compacto que llena el alto del panel. */
  compact?: boolean;
}

export function Asistente({ view, compact }: AsistenteProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [copiado, setCopiado] = useState<number | null>(null);
  const [ubicacion, setUbicacion] = useState<EstacionGeo | null>(null);
  const [geoEstado, setGeoEstado] = useState<'idle' | 'cargando' | 'activa' | 'error'>('idle');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const featuresRef = useRef<EstacionFeature[] | null>(null);
  // Freno anti-abuso del chat: sesión firmada + verificación Turnstile.
  const sesionRef = useRef<string | null>(null);
  const sesionNoRequeridaRef = useRef(false); // el Worker no exige sesión (dev sin secretos)
  const pendienteRef = useRef<ChatMessage[] | null>(null); // consulta en espera del widget
  const reintentoSesionRef = useRef(false); // evita un bucle 401 -> verificar -> 401
  const [verificando, setVerificando] = useState(false);
  if (sesionRef.current === null) sesionRef.current = leerSesionGuardada();

  const fijarSesion = (token: string | null, exp: number | null) => {
    sesionRef.current = token;
    guardarSesion(token, exp);
  };

  // Canjea (opcionalmente) un token Turnstile por la sesión firmada del chat.
  // session:null en la respuesta significa que el Worker no exige sesión.
  const abrirSesion = async (turnstileToken?: string) => {
    const data = await apiJson<{ session?: string | null; exp?: number }>(
      '/api/chat/session',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(turnstileToken ? { turnstileToken } : {}),
      },
      'No se pudo abrir la sesión del chat.',
    );
    if (typeof data.session === 'string' && data.session) {
      fijarSesion(data.session, typeof data.exp === 'number' ? data.exp : null);
    } else {
      sesionNoRequeridaRef.current = true;
    }
  };

  // "Dónde estoy": pide la ubicación al navegador, resuelve la estación más
  // cercana EN EL CLIENTE (con stations.geojson) y guarda solo el lugar. Las
  // coordenadas nunca se envían al servidor.
  const activarUbicacion = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeoEstado('error');
      return;
    }
    setGeoEstado('cargando');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          if (!featuresRef.current) {
            const geo = await apiJson<{ features: EstacionFeature[] }>(
              '/api/stations.geojson',
              undefined,
              'No se pudo cargar el catálogo de estaciones.',
            );
            featuresRef.current = Array.isArray(geo.features) ? geo.features : [];
          }
          const est = estacionMasCercana(
            { lat: pos.coords.latitude, lng: pos.coords.longitude },
            featuresRef.current,
          );
          if (est && est.municipio) {
            setUbicacion(est);
            setGeoEstado('activa');
          } else {
            setGeoEstado('error');
          }
        } catch {
          setGeoEstado('error');
        }
      },
      () => setGeoEstado('error'),
      { timeout: 10000, maximumAge: 600000 },
    );
  };

  const quitarUbicacion = () => {
    setUbicacion(null);
    setGeoEstado('idle');
  };
  // Pegado al fondo: solo auto-desplazamos si el usuario ya estaba abajo, para
  // no pisar un scroll-up manual mientras lee mensajes anteriores.
  const pegadoAlFondo = useRef(true);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) pegadoAlFondo.current = cercaDelFondo(el);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el && pegadoAlFondo.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Lanza la consulta con un historial dado SIN tocar `messages`: así
  // "Reintentar" reusa la conversación actual sin duplicar el turno del usuario.
  const ejecutarConsulta = async (turnos: ChatMessage[]) => {
    setError('');
    setSuggestions([]);
    setAcciones([]);
    setIsLoading(true);
    // Timeout de red: si el modelo no responde, no dejamos la UI colgada.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      // Freno anti-abuso: sin sesión firmada se intenta abrir una. Un 403 del
      // Worker significa "hace falta Turnstile": la consulta queda en espera y
      // se muestra el widget (una sola vez por hora, como en el correo).
      if (!sesionRef.current && !sesionNoRequeridaRef.current) {
        try {
          await abrirSesion();
        } catch (cause) {
          if (cause instanceof ApiError && cause.status === 403) {
            pendienteRef.current = turnos;
            setVerificando(true);
            return;
          }
          throw cause;
        }
      }
      const data = await apiJson<{ reply?: string; suggestions?: unknown; acciones?: unknown; session?: unknown; exp?: unknown }>(
        '/api/chat',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            messages: turnos.slice(-10),
            ...(view ? { view } : {}),
            ...(ubicacion ? { ubicacion } : {}),
            ...(sesionRef.current ? { session: sesionRef.current } : {}),
          }),
          signal: controller.signal,
        },
        'El asistente no pudo responder.',
      );
      if (typeof data.reply !== 'string' || !data.reply.trim()) {
        throw new Error('El asistente no pudo responder.');
      }
      // El Worker devuelve la sesión renovada (lleva el conteo de mensajes):
      // siempre se usa el último token recibido.
      if (typeof data.session === 'string' && data.session) {
        fijarSesion(data.session, typeof data.exp === 'number' ? data.exp : null);
      }
      reintentoSesionRef.current = false;
      const reply = data.reply;
      setMessages((current) => [...current, { role: 'assistant', content: reply }]);
      setSuggestions(
        Array.isArray(data.suggestions)
          ? data.suggestions.filter((s: unknown): s is string => typeof s === 'string').slice(0, 3)
          : [],
      );
      // Botones de acción: el Worker los arma de forma determinista; aquí se
      // revalidan (whitelist + saneo) antes de pintarlos.
      setAcciones(parseAcciones(data.acciones));
    } catch (cause) {
      // 401 = la sesión venció o agotó su tope: se repite la verificación UNA
      // vez con la consulta en espera; si vuelve a fallar, error normal.
      if (cause instanceof ApiError && cause.status === 401 && !reintentoSesionRef.current) {
        reintentoSesionRef.current = true;
        fijarSesion(null, null);
        pendienteRef.current = turnos;
        setVerificando(true);
        return;
      }
      // El 429/Retry-After y el caso "respuesta HTML" los traduce formatChatError.
      setError(formatChatError(cause));
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
    }
  };

  // Token del widget Turnstile: se canjea por la sesión y se retoma la consulta
  // que quedó en espera. token null = el widget expiró o falló (se auto-reinicia).
  const alTokenTurnstile = (token: string | null) => {
    if (!token) return;
    void (async () => {
      try {
        await abrirSesion(token);
        setVerificando(false);
        const pendiente = pendienteRef.current;
        pendienteRef.current = null;
        if (pendiente) void ejecutarConsulta(pendiente);
      } catch (cause) {
        // El widget queda visible para reintentar.
        setError(formatChatError(cause));
      }
    })();
  };

  const send = (text: string) => {
    const pregunta = text.trim();
    if (!pregunta || isLoading) return;
    const nuevos: ChatMessage[] = [...messages, { role: 'user', content: pregunta }];
    setMessages(nuevos);
    setInput('');
    void ejecutarConsulta(nuevos);
  };

  const reintentar = () => {
    if (isLoading || !messages.length) return;
    void ejecutarConsulta(messages);
  };

  // Click en un botón de acción: emite el evento global de navegación. App lo
  // escucha, fija la URL con los params y cambia de pestaña; el panel flotante
  // se cierra solo (escucha el mismo evento) para que se vea el resultado.
  const irA = (accion: Accion) => {
    const detail: NavigateDetail = { view: accion.view, params: accion.params };
    window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail }));
  };

  const copiar = async (index: number, texto: string) => {
    try {
      await navigator.clipboard?.writeText(texto);
      setCopiado(index);
      setTimeout(() => setCopiado((c) => (c === index ? null : c)), 1500);
    } catch {
      /* portapapeles no disponible: no romper la UI */
    }
  };

  return (
    <div className={compact ? 'flex h-full min-h-0 flex-col' : 'flex h-[calc(100vh-180px)] min-h-[480px] flex-col'}>
      {!compact && (
        <div className="mb-3">
          <h2 className="flex items-center gap-2 text-2xl font-bold text-card-foreground">
            <MessageCircle className="h-6 w-6 text-accent" /> Asistente Hídrico
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ayuda con conceptos de hidrología y el uso de la plataforma, nada más. Es orientativa: no inventa
            datos ni reemplaza el criterio de diseño.
          </p>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversación con el Asistente Hídrico"
        className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-glow"
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-muted-foreground">
            <Bot className="h-10 w-10 text-accent" />
            <div className="max-w-md text-sm">
              <p className="font-semibold text-card-foreground">¡Hola! Soy el Asistente Hídrico de la plataforma.</p>
              <p className="mt-1">
                Te ayudo a entender conceptos de hidrología (IDF, período de retorno, SPI, caudal…) y a usar la
                plataforma. <span className="text-card-foreground">Solo manejo temas relacionados con estos datos y la herramienta.</span> Prueba con:
              </p>
            </div>
            <div className="flex max-w-lg flex-wrap justify-center gap-2">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-card-foreground transition-colors hover:border-accent/50 hover:text-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, index) => (
          <div key={index} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.role === 'user' ? 'bg-primary/15 text-primary' : 'bg-accent/15 text-accent'}`}>
              {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className={`flex max-w-[80%] flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`break-words rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'whitespace-pre-wrap bg-primary/10 text-card-foreground' : 'border border-border bg-background text-card-foreground'}`}>
                {m.role === 'user' ? m.content : <MensajeFormateado text={m.content} />}
              </div>
              {m.role === 'assistant' && (
                <button
                  type="button"
                  onClick={() => void copiar(index, m.content)}
                  aria-label="Copiar respuesta"
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {copiado === index ? (
                    <><Check className="h-3 w-3" /> Copiado</>
                  ) : (
                    <><Copy className="h-3 w-3" /> Copiar</>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground">
              <span className="sr-only">El asistente está escribiendo una respuesta…</span>
              <span className="inline-flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        {!isLoading && acciones.length > 0 && messages.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-11">
            {acciones.map((a) => (
              <button
                key={`${a.view}-${a.label}`}
                type="button"
                onClick={() => irA(a)}
                className="group inline-flex items-center gap-1.5 rounded-lg border border-accent/60 bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                {a.label.replace(/\s*→\s*$/, '')}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        )}

        {!isLoading && suggestions.length > 0 && messages.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-11">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="rounded-full border border-accent/40 bg-accent/5 px-3 py-1.5 text-xs text-card-foreground transition-colors hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="mt-2 flex items-start justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <span>{error}</span>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => reintentar()}
              disabled={isLoading}
              className="shrink-0 rounded-md border border-destructive/40 px-2 py-1 font-medium transition-colors hover:bg-destructive/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-destructive disabled:opacity-50"
            >
              Reintentar
            </button>
          )}
        </div>
      )}

      {verificando && (
        <div className="mt-2 rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Verificación rápida anti-robots para abrir el chat (una vez por hora). Tu pregunta se envía apenas termine:
          </p>
          <Turnstile onToken={alTokenTurnstile} />
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {geoEstado === 'activa' && ubicacion ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/5 px-2 py-1 text-card-foreground">
            <MapPin className="h-3 w-3 text-accent" /> {ubicacion.municipio}
            <button
              type="button"
              onClick={quitarUbicacion}
              aria-label="Quitar mi ubicación"
              className="ml-0.5 rounded text-muted-foreground transition-colors hover:text-card-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={activarUbicacion}
            disabled={geoEstado === 'cargando'}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
          >
            <MapPin className="h-3 w-3" /> {geoEstado === 'cargando' ? 'Obteniendo ubicación…' : 'Usar mi ubicación'}
          </button>
        )}
        {geoEstado === 'error' && (
          <span className="text-muted-foreground">No pudimos obtener tu ubicación; nombra el lugar en tu pregunta.</span>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
        className="mt-2 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Escribe tu pregunta..."
          disabled={isLoading}
          className="h-11 flex-1 rounded-xl border border-border bg-card px-4 text-sm text-card-foreground outline-none transition-colors focus:border-accent focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white transition-transform duration-150 ease-out hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50 disabled:hover:scale-100"
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
