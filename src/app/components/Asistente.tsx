import { useEffect, useRef, useState, type ReactNode } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Bot, MessageCircle, Send, User } from 'lucide-react';
import { apiUrl } from '../lib/ideamApi';

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
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  const send = async (text: string) => {
    const pregunta = text.trim();
    if (!pregunta || isLoading) return;
    setError('');
    setSuggestions([]);
    const nuevos: ChatMessage[] = [...messages, { role: 'user', content: pregunta }];
    setMessages(nuevos);
    setInput('');
    setIsLoading(true);
    // Timeout de red: si el modelo no responde, no dejamos la UI colgada.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: nuevos.slice(-10), ...(view ? { view } : {}) }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || typeof data.reply !== 'string' || !data.reply.trim()) {
        throw new Error((data && data.error) || 'El asistente no pudo responder.');
      }
      setMessages((current) => [...current, { role: 'assistant', content: data.reply }]);
      setSuggestions(
        Array.isArray(data.suggestions)
          ? data.suggestions.filter((s: unknown): s is string => typeof s === 'string').slice(0, 3)
          : [],
      );
    } catch (cause) {
      const msg =
        cause instanceof DOMException && cause.name === 'AbortError'
          ? 'El asistente tardó demasiado en responder. Intenta de nuevo.'
          : cause instanceof Error
            ? cause.message
            : 'El asistente no está disponible ahora.';
      setError(msg);
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
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
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'whitespace-pre-wrap bg-primary/10 text-card-foreground' : 'border border-border bg-background text-card-foreground'}`}>
              {m.role === 'user' ? m.content : <MensajeFormateado text={m.content} />}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
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
        <div role="alert" className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
        className="mt-3 flex items-center gap-2"
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
