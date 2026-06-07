import { useEffect, useRef, useState } from 'react';
import { Bot, Send, Sparkles, User } from 'lucide-react';
import { apiUrl } from '../lib/ideamApi';

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

export function Asistente() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  const send = async (text: string) => {
    const pregunta = text.trim();
    if (!pregunta || isLoading) return;
    setError('');
    const nuevos: ChatMessage[] = [...messages, { role: 'user', content: pregunta }];
    setMessages(nuevos);
    setInput('');
    setIsLoading(true);
    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: nuevos.slice(-10) }),
      });
      const data = await response.json();
      if (!response.ok || !data.reply) {
        throw new Error(data.error || 'El asistente no pudo responder.');
      }
      setMessages((current) => [...current, { role: 'assistant', content: data.reply }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'El asistente no está disponible ahora.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-180px)] min-h-[480px] flex-col">
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-card-foreground">
          <Sparkles className="h-6 w-6 text-accent" /> Asistente hidrológico
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tutor para entender conceptos y usar la plataforma. Es una ayuda educativa orientativa — no inventa datos
          ni reemplaza el criterio de diseño.
        </p>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-[0_0_40px_rgba(201,162,39,0.06)]"
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-muted-foreground">
            <Bot className="h-10 w-10 text-accent" />
            <p className="max-w-md text-sm">Pregúntame sobre conceptos de hidrología o cómo usar la plataforma. Por ejemplo:</p>
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
            <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-primary/10 text-card-foreground' : 'border border-border bg-background text-card-foreground'}`}>
              {m.content}
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
          className="h-11 flex-1 rounded-xl border border-border bg-card px-4 text-sm text-card-foreground outline-none transition-colors focus:border-accent disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
