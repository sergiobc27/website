import { useMemo, useState } from 'react';
import { Library, Search, ExternalLink, Copy, Check } from 'lucide-react';
import { REFERENCIAS, TEMAS, type Referencia, type Tema } from '../lib/referencias';

type PaisFiltro = 'todos' | 'Colombia' | 'Internacional';

export function BibliotecaReferencias() {
  const [query, setQuery] = useState('');
  const [tema, setTema] = useState<Tema | 'todos'>('todos');
  const [pais, setPais] = useState<PaisFiltro>('todos');
  const [copiado, setCopiado] = useState<string | null>(null);

  const copiar = async (r: Referencia) => {
    try {
      await navigator.clipboard.writeText(r.apa);
      setCopiado(r.id);
      setTimeout(() => setCopiado((c) => (c === r.id ? null : c)), 1500);
    } catch {
      /* clipboard no disponible: degradación silenciosa */
    }
  };

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    return REFERENCIAS.filter(
      (r) =>
        (tema === 'todos' || r.tema === tema) &&
        (pais === 'todos' || r.pais === pais) &&
        (!q || r.apa.toLowerCase().includes(q)),
    );
  }, [query, tema, pais]);

  const porTema = useMemo(
    () =>
      TEMAS.map((t) => ({
        tema: t,
        items: filtradas.filter((r) => r.tema === t).sort((a, b) => a.anio - b.anio),
      })).filter((g) => g.items.length > 0),
    [filtradas],
  );

  const nColombia = REFERENCIAS.filter((r) => r.pais === 'Colombia').length;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-glow">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-card-foreground">
            <Library className="h-5 w-5 text-accent" /> Biblioteca de referencias
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Fuentes normativas y académicas en las que se basa la plataforma — {REFERENCIAS.length} en total,{' '}
            {nColombia} colombianas. Filtra por tema o país, o busca por autor/título/año.
          </p>
        </div>
      </div>

      {/* Buscador */}
      <div className="mb-3 flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-accent">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por autor, título o año…"
          className="w-full bg-transparent text-sm text-card-foreground outline-none"
          aria-label="Buscar referencias"
        />
      </div>

      {/* Filtros */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Chip activo={tema === 'todos'} onClick={() => setTema('todos')}>Todos los temas</Chip>
        {TEMAS.map((t) => (
          <Chip key={t} activo={tema === t} onClick={() => setTema(t)}>{t}</Chip>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(['todos', 'Colombia', 'Internacional'] as PaisFiltro[]).map((p) => (
          <Chip key={p} activo={pais === p} onClick={() => setPais(p)}>
            {p === 'todos' ? 'Todos los países' : p === 'Colombia' ? '🇨🇴 Colombia' : '🌐 Internacional'}
          </Chip>
        ))}
      </div>

      {/* Estantes */}
      {porTema.length === 0 ? (
        <p className="rounded-lg border border-border bg-background px-3 py-6 text-center text-sm text-muted-foreground">
          Ninguna referencia coincide con la búsqueda o los filtros.
        </p>
      ) : (
        <div className="space-y-5">
          {porTema.map(({ tema: t, items }) => (
            <section key={t}>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-accent">
                {t}
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold">{items.length}</span>
              </h4>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {items.map((r) => (
                  <Ficha key={r.id} r={r} copiado={copiado === r.id} onCopiar={() => copiar(r)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Ficha({ r, copiado, onCopiar }: { r: Referencia; copiado: boolean; onCopiar: () => void }) {
  const esFrontera = r.tema === 'Frontera de alcance';
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4">
      <p className="text-sm leading-snug text-card-foreground">{r.apa}</p>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
          {r.pais === 'Colombia' ? '🇨🇴 Colombia' : '🌐 Internacional'}
        </span>
        {esFrontera && (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-400">
            Frontera de alcance
          </span>
        )}
        {r.usadoEn?.map((m) => (
          <span key={m} className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-accent">
            {m}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onCopiar}
            className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-accent"
            aria-label="Copiar cita"
          >
            {copiado ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
          {r.url && (
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent transition-colors hover:underline"
            >
              Ver fuente <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </span>
      </div>
    </div>
  );
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        activo
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-border bg-background text-muted-foreground hover:border-accent/50 hover:text-accent'
      }`}
    >
      {children}
    </button>
  );
}
