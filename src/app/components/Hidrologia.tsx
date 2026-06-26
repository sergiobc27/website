import { useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { ChartDownloadButton } from './ChartDownloadButton';
import { EnviarPorCorreo } from './EnviarPorCorreo';
import { buildIdfPdfModel, renderIdfPdf } from '../lib/pdf/idfPdf';
import { loadImageDataUrl } from '../lib/pdf/loadImage';
import { useUrlSync } from '../lib/urlState';
import logoCucUrl from '../../imports/Logo_CUC_PNG_letra_blanca_barra_roja_vtcal.png';
import logoIdeamUrl from '../../imports/Ideam_(Colombia)_logo.png';
import { AlertTriangle, BarChart4, CheckCircle2, CloudRain, Droplets, FileDown, Mail, Navigation, Plus, Search, Waves } from 'lucide-react';
import { InfoGrafica } from './InfoGrafica';
import {
  Bar,
  Area,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SkeletonLoader } from './SkeletonLoader';
import { CalculadoraCaudal } from './CalculadoraCaudal';
import { Formula, Frac, Sub, Sup, V } from './Formula';
import { fmt } from '../lib/format';
import { MONTH_NAMES, PRECIP_DATASET } from '../lib/constants';
import { apiJson, apiUrl } from '../lib/ideamApi';
import type {
  AnalyticsTimeseriesResponse,
  Fiabilidad,
  FiabilidadNivel,
  HistogramResponse,
  IdfNearestResponse,
  IdfResponse,
  IdfStationsResponse,
  ReturnPeriodsResponse,
  SpiResponse,
} from '../../shared/ideamContracts';

const IDF_COLORS = ['#60a5fa', '#34d399', '#C9A227', '#f59e0b', '#A3161A', '#7f1d1d'];

// Δaltitud: en zona de montaña un desnivel grande importa más que la distancia
// horizontal (otro piso térmico → otro régimen de lluvia). Avisamos sobre 300 m.
const ALT_WARN_M = 300;
const fmtAltDiff = (d: number | null) =>
  d == null ? null : d === 0 ? '±0 m' : `${d > 0 ? '+' : '−'}${Math.abs(d)} m`;

interface StationLite {
  codigo: string;
  nombre: string;
  municipio: string;
  departamento: string;
  aniosValidos?: number;
  zonaHidrografica?: string | null;
  corriente?: string | null;
  fiabilidad?: Fiabilidad | null;
}

// Color del punto del semáforo (misma convención del detalle / Lote 3A).
const NIVEL_COLOR: Record<FiabilidadNivel, string> = {
  verde: '#10b981',
  amarillo: '#f59e0b',
  rojo: '#ef4444',
};
const NIVEL_LABEL: Record<FiabilidadNivel, string> = {
  verde: 'Confiable',
  amarillo: 'Fiabilidad media',
  rojo: 'Baja fiabilidad',
};

function NivelChip({ activo, onClick, dot, children }: { activo: boolean; onClick: () => void; dot?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        activo ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-background text-muted-foreground hover:border-accent/40'
      }`}
    >
      {dot && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />}
      {children}
    </button>
  );
}

function FiltroSelect({ value, onChange, options, placeholder, aria, disabled }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string; aria: string; disabled?: boolean }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={aria}
      className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-sm text-card-foreground outline-none focus:border-accent disabled:opacity-50"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function spiColor(z: number | null) {
  if (z === null) return '#3f3f46'; // no calculable (<3 años de historia)
  if (z <= -2) return '#7f1d1d';
  if (z <= -1.5) return '#A3161A';
  if (z <= -1) return '#dc7633';
  if (z < 1) return '#9ca3af';
  if (z < 1.5) return '#60a5fa';
  if (z < 2) return '#2563eb';
  return '#1e3a8a';
}

const tooltipStyle = {
  backgroundColor: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--foreground)',
};

export function Hidrologia() {
  const [catalog, setCatalog] = useState<StationLite[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [nivelFiltro, setNivelFiltro] = useState<FiabilidadNivel | 'todos'>('todos');
  const [depFiltro, setDepFiltro] = useState('');
  const [munFiltro, setMunFiltro] = useState('');
  const [aniosFiltro, setAniosFiltro] = useState(0); // mínimo de años de registro
  const [zonaFiltro, setZonaFiltro] = useState('');
  const [corrienteFiltro, setCorrienteFiltro] = useState('');
  const [station, setStation] = useState<StationLite | null>(null);
  const idfChartRef = useRef<HTMLDivElement>(null);

  // Municipios del departamento elegido (TODOS, de /api/municipalities): así, si
  // eliges uno sin estación, podemos sugerir la más cercana. Más la respuesta de
  // "estación más cercana" cuando el municipio elegido no tiene estación propia.
  const [munOptions, setMunOptions] = useState<string[]>([]);
  const [nearest, setNearest] = useState<IdfNearestResponse | null>(null);
  const [nearestLoading, setNearestLoading] = useState(false);

  const [returnPeriods, setReturnPeriods] = useState<ReturnPeriodsResponse | null>(null);
  const [spi, setSpi] = useState<SpiResponse | null>(null);
  const [spiScale, setSpiScale] = useState<3 | 6 | 12>(12);
  const [histogramData, setHistogramData] = useState<HistogramResponse | null>(null);
  const [idf, setIdf] = useState<IdfResponse | null>(null);
  const [hyetographYear, setHyetographYear] = useState('');
  const [hyetograph, setHyetograph] = useState<AnalyticsTimeseriesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [correoOpen, setCorreoOpen] = useState(false);

  // Código de estación pendiente de restaurar desde la URL (la estación solo
  // puede seleccionarse una vez cargado el catálogo).
  const pendingStationCode = useRef<string | null>(null);

  // Estado en la URL: ?est=<codigo>&spi=12&anio=2020 (defaults omitidos).
  useUrlSync({
    params: {
      est: station?.codigo || undefined,
      spi: spiScale === 12 ? undefined : String(spiScale),
      anio: hyetographYear || undefined,
    },
    onRestore: (p) => {
      pendingStationCode.current = p.est || null;
      if (p.spi === '3' || p.spi === '6' || p.spi === '12') setSpiScale(Number(p.spi) as 3 | 6 | 12);
      if (p.anio) setHyetographYear(p.anio);
    },
  });

  // Cuando el catálogo está disponible, selecciona la estación pendiente por
  // código. Si no existe, avisa suave y deja el selector.
  useEffect(() => {
    const code = pendingStationCode.current;
    if (!code || !catalog.length) return;
    pendingStationCode.current = null;
    const found = catalog.find((s) => s.codigo === code);
    if (found) setStation(found);
    else toast.error(`No se encontró la estación ${code}; elige otra del listado.`);
  }, [catalog]);

  // Solo las estaciones con IDF ya precomputado y usable (>=5 años): el resto
  // daría "no disponible". Mostrarlas directamente evita que el usuario adivine
  // un código a ciegas (las demás analíticas también funcionan sobre estas, que
  // son las pluviográficas con buen registro).
  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    // no-store: la lista lleva el semáforo de fiabilidad, que puede cambiar tras el
    // job mensual; evitamos que el navegador sirva una copia vieja (el edge sigue
    // cacheando ~30 min, así que el box queda protegido).
    fetch(apiUrl('/api/analytics/idf-stations'), { headers: { accept: 'application/json' }, cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('catálogo'))))
      .then((data: IdfStationsResponse) => {
        if (cancelled) return;
        setCatalog(
          (data.stations || []).map((s) => ({
            codigo: s.codigo,
            nombre: s.nombre || s.codigo,
            municipio: s.municipio || 'N/D',
            departamento: s.departamento || 'N/D',
            aniosValidos: s.aniosValidos,
            zonaHidrografica: s.zonaHidrografica ?? null,
            corriente: s.corriente ?? null,
            fiabilidad: s.fiabilidad ?? null,
          }))
        );
      })
      .catch(() => setError('No fue posible cargar la lista de estaciones disponibles.'))
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Lista filtrada por la búsqueda (o todas las disponibles si no hay query),
  // ordenada por departamento → municipio para recorrerla cómodamente.
  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return catalog.filter((s) => {
      if (nivelFiltro !== 'todos' && s.fiabilidad?.level !== nivelFiltro) return false;
      if (depFiltro && s.departamento !== depFiltro) return false;
      if (munFiltro && s.municipio.toUpperCase() !== munFiltro.toUpperCase()) return false;
      if (aniosFiltro && (s.aniosValidos ?? 0) < aniosFiltro) return false;
      if (zonaFiltro && (s.zonaHidrografica || '') !== zonaFiltro) return false;
      if (corrienteFiltro && (s.corriente || '') !== corrienteFiltro) return false;
      if (!q) return true;
      return (
        s.codigo.includes(q) ||
        s.nombre.toUpperCase().includes(q) ||
        s.municipio.toUpperCase().includes(q) ||
        s.departamento.toUpperCase().includes(q) ||
        (s.zonaHidrografica || '').toUpperCase().includes(q) ||
        (s.corriente || '').toUpperCase().includes(q)
      );
    });
  }, [catalog, query, nivelFiltro, depFiltro, munFiltro, aniosFiltro, zonaFiltro, corrienteFiltro]);

  const colator = (a: string, b: string) => a.localeCompare(b, 'es');
  // Departamentos disponibles en el catálogo (para el desplegable).
  const depsDisponibles = useMemo(() => Array.from(new Set(catalog.map((s) => s.departamento))).sort(colator), [catalog]);
  // Zonas/corrientes presentes, acotadas por los filtros de arriba para que sigan siendo relevantes.
  const zonasDisponibles = useMemo(
    () =>
      Array.from(
        new Set(catalog.filter((s) => !depFiltro || s.departamento === depFiltro).map((s) => s.zonaHidrografica).filter(Boolean) as string[]),
      ).sort(colator),
    [catalog, depFiltro],
  );
  const corrientesDisponibles = useMemo(
    () =>
      Array.from(
        new Set(
          catalog
            .filter((s) => (!depFiltro || s.departamento === depFiltro) && (!zonaFiltro || (s.zonaHidrografica || '') === zonaFiltro))
            .map((s) => s.corriente)
            .filter(Boolean) as string[],
        ),
      ).sort(colator),
    [catalog, depFiltro, zonaFiltro],
  );
  // ¿El municipio elegido (del desplegable, que lista TODOS) no tiene estación propia?
  const munSinEstacion = useMemo(
    () => !!munFiltro && !catalog.some((s) => (!depFiltro || s.departamento === depFiltro) && s.municipio.toUpperCase() === munFiltro.toUpperCase()),
    [catalog, depFiltro, munFiltro],
  );
  const hayFiltros = !!(query || nivelFiltro !== 'todos' || depFiltro || munFiltro || aniosFiltro || zonaFiltro || corrienteFiltro);
  const limpiarFiltros = () => {
    setQuery(''); setNivelFiltro('todos'); setDepFiltro(''); setMunFiltro('');
    setAniosFiltro(0); setZonaFiltro(''); setCorrienteFiltro('');
  };

  // Conteo por nivel para los chips de filtro.
  const conteoNivel = useMemo(() => {
    const c = { verde: 0, amarillo: 0, rojo: 0 };
    for (const s of catalog) if (s.fiabilidad) c[s.fiabilidad.level] += 1;
    return c;
  }, [catalog]);

  // Municipios (TODOS) del departamento elegido — para poder sugerir la estación
  // más cercana incluso si el municipio no tiene estación propia.
  useEffect(() => {
    setMunOptions([]);
    setMunFiltro('');
    setNearest(null);
    if (!depFiltro) return;
    let cancelled = false;
    apiJson<{ municipalities: string[] }>(
      `/api/municipalities?department=${encodeURIComponent(depFiltro)}`,
      undefined,
      'Sin municipios.'
    )
      .then((data) => {
        if (!cancelled) setMunOptions(data.municipalities || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [depFiltro]);

  // Estación más cercana: solo cuando el municipio elegido NO tiene estación propia.
  useEffect(() => {
    if (!munSinEstacion || !depFiltro || !munFiltro) {
      setNearest(null);
      return;
    }
    const controller = new AbortController();
    setNearestLoading(true);
    setNearest(null);
    apiJson<IdfNearestResponse>(
      `/api/analytics/idf-nearest?departamento=${encodeURIComponent(depFiltro)}&municipio=${encodeURIComponent(munFiltro)}`,
      { signal: controller.signal },
      'No fue posible calcular la estación más cercana.'
    )
      .then((data) => {
        if (!controller.signal.aborted) setNearest(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setNearest(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setNearestLoading(false);
      });
    return () => controller.abort();
  }, [munSinEstacion, depFiltro, munFiltro]);

  const scopeFor = (code: string) => ({
    datasetId: PRECIP_DATASET,
    departments: [] as string[],
    catalogFilters: { stations: [code] },
  });
  const post = (body: object, signal: AbortSignal) => ({
    method: 'POST' as const,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  // Períodos de retorno + histograma (dependen solo de la estación).
  useEffect(() => {
    if (!station) return;
    const controller = new AbortController();
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const [rp, hist, idfData] = await Promise.all([
          apiJson<ReturnPeriodsResponse>('/api/analytics/return-periods', post(scopeFor(station.codigo), controller.signal), 'Sin períodos de retorno.'),
          apiJson<HistogramResponse>('/api/analytics/histogram', post(scopeFor(station.codigo), controller.signal), 'Sin histograma.'),
          apiJson<IdfResponse>('/api/analytics/idf', post(scopeFor(station.codigo), controller.signal), 'Sin IDF.'),
        ]);
        if (controller.signal.aborted) return;
        setReturnPeriods(rp);
        setHistogramData(hist);
        setIdf(idfData);
        const lastYear = rp.stationYears.at(-1)?.year;
        setHyetographYear((current) => current || (lastYear ? String(lastYear) : ''));
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No fue posible cargar el análisis.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [station?.codigo]);

  // SPI (estación + escala).
  useEffect(() => {
    if (!station) return;
    const controller = new AbortController();
    apiJson<SpiResponse>('/api/analytics/spi', post({ ...scopeFor(station.codigo), scale: spiScale }, controller.signal), 'Sin SPI.')
      .then((data) => {
        if (!controller.signal.aborted) setSpi(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSpi(null);
      });
    return () => controller.abort();
  }, [station?.codigo, spiScale]);

  // Hietograma mensual del año elegido.
  useEffect(() => {
    if (!station || !hyetographYear) return;
    const controller = new AbortController();
    apiJson<AnalyticsTimeseriesResponse>(
      '/api/analytics/timeseries',
      post(
        {
          ...scopeFor(station.codigo),
          interval: 'month',
          metric: 'sum',
          startDate: `${hyetographYear}-01-01`,
          endDate: `${hyetographYear}-12-31`,
        },
        controller.signal
      ),
      'Sin hietograma.'
    )
      .then((data) => {
        if (!controller.signal.aborted) setHyetograph(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setHyetograph(null);
      });
    return () => controller.abort();
  }, [station?.codigo, hyetographYear]);

  const returnCurve = useMemo(() => {
    if (!returnPeriods?.gumbel) return [];
    const fitted = returnPeriods.quantiles.map((q) => ({
      tr: q.returnPeriod,
      ajustado: q.value,
      banda: q.lower != null && q.upper != null ? [q.lower, q.upper] : undefined,
    }));
    const observed = returnPeriods.empirical
      .filter((e) => e.returnPeriod >= 1.05)
      .map((e) => ({ tr: e.returnPeriod, observado: e.value }));
    return [...fitted, ...observed].sort((a, b) => a.tr - b.tr);
  }, [returnPeriods]);

  const spiData = useMemo(
    // Los meses no calculables (spi=null) se omiten del gráfico de barras.
    () => (spi?.points || []).slice(-120).filter((p) => p.spi !== null).map((p) => ({ ...p, label: p.month })),
    [spi]
  );

  const hyetographData = useMemo(
    () =>
      (hyetograph?.points || []).map((p) => ({
        label: MONTH_NAMES[Number(p.bucket.slice(5, 7)) - 1] || p.bucket,
        total: p.value,
      })),
    [hyetograph]
  );

  const histogramBins = useMemo(
    () =>
      (histogramData?.bins || [])
        .filter((b) => b.count > 0 || b.from < (histogramData?.maxDaily || 0) * 0.75)
        .map((b) => ({ label: `${b.from}-${b.to}`, dias: b.count })),
    [histogramData]
  );

  const years = useMemo(() => (returnPeriods?.stationYears || []).map((y) => String(y.year)), [returnPeriods]);

  // Curvas IDF: fila por duración, una columna de intensidad por período de
  // retorno (formato que Recharts grafica como familia de líneas).
  const idfChartData = useMemo(() => {
    if (!idf?.available) return [];
    const byDur = new Map<number, Record<string, number>>();
    for (const curve of idf.curves) {
      for (const point of curve.points) {
        // El eje Y es logarítmico: una intensidad ≤0 daría log(0)=−∞ y rompería
        // TODA la familia de curvas sin error visible (auditoría #5 #10).
        if (!(point.intensityMmH > 0)) continue;
        const row = byDur.get(point.durMin) || { durMin: point.durMin };
        row[`tr${curve.returnPeriod}`] = point.intensityMmH;
        if (point.lowerMmH != null && point.upperMmH != null) {
          row[`tr${curve.returnPeriod}_lo`] = point.lowerMmH;
          row[`tr${curve.returnPeriod}_hi`] = point.upperMmH;
        }
        byDur.set(point.durMin, row);
      }
    }
    return Array.from(byDur.values()).sort((a, b) => a.durMin - b.durMin);
  }, [idf]);

  // Captura la gráfica IDF en alta resolución y arma el PDF de marca CUC.
  // Reutilizado por la descarga y por el envío por correo.
  const generarPdf = async () => {
    if (!idf?.available || !station) throw new Error('Sin curvas IDF');
    const node = idfChartRef.current;
    if (!node) throw new Error('Gráfica no disponible');
    // Fondo blanco siempre: el PDF es para imprimir.
    const chartDataUrl = await toPng(node, { pixelRatio: 3, cacheBust: true, backgroundColor: '#ffffff' });
    const [logoCuc, logoIdeam] = await Promise.all([
      loadImageDataUrl(logoCucUrl),
      loadImageDataUrl(logoIdeamUrl),
    ]);
    const model = buildIdfPdfModel(
      idf,
      { nombre: station.nombre, codigo: station.codigo, municipio: station.municipio, departamento: station.departamento },
      returnPeriods?.reliability?.level ?? station.fiabilidad?.level ?? null,
      new Date(),
    );
    return { doc: renderIdfPdf(model, { chartDataUrl, logoCuc, logoIdeam }), filename: model.filename };
  };

  const descargarPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const { doc, filename } = await generarPdf();
      doc.save(filename);
      toast.success('PDF descargado');
    } catch {
      toast.error('No se pudo generar el PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-card-foreground text-2xl font-bold">Hidrología de precipitación</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Períodos de retorno (Gumbel), monitor de sequía (SPI), hietograma e histograma por estación.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-[0_0_20px] shadow-accent/10">
        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold uppercase tracking-wide">Estaciones con análisis disponible</span>
              {!catalogLoading && (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                  {catalog.length} disponibles
                </span>
              )}
            </div>
            <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-accent">
              <Search className="h-4 w-4 shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={station ? `${station.nombre} · ${station.municipio}` : 'Filtra por nombre, código, municipio o departamento'}
                className="w-full bg-transparent text-sm text-card-foreground outline-none"
              />
            </div>

            {!catalogLoading && catalog.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                <FiltroSelect value={depFiltro} onChange={(v) => { setDepFiltro(v); setMunFiltro(''); }} aria="Filtrar por departamento" placeholder="Todos los departamentos" options={depsDisponibles} />
                <FiltroSelect value={munFiltro} onChange={setMunFiltro} disabled={!depFiltro} aria="Filtrar por municipio" placeholder={depFiltro ? 'Todos los municipios' : 'Elige departamento'} options={munOptions} />
                <select
                  value={aniosFiltro}
                  onChange={(event) => setAniosFiltro(Number(event.target.value))}
                  className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-sm text-card-foreground outline-none focus:border-accent"
                  aria-label="Filtrar por años de registro"
                >
                  <option value={0}>Años: todos</option>
                  <option value={5}>≥ 5 años</option>
                  <option value={10}>≥ 10 años</option>
                  <option value={15}>≥ 15 años</option>
                </select>
                <FiltroSelect value={zonaFiltro} onChange={(v) => { setZonaFiltro(v); setCorrienteFiltro(''); }} aria="Filtrar por zona hidrográfica" placeholder="Toda zona hidrográfica" options={zonasDisponibles} />
                <FiltroSelect value={corrienteFiltro} onChange={setCorrienteFiltro} aria="Filtrar por corriente" placeholder="Toda corriente" options={corrientesDisponibles} />
              </div>
            )}

            {hayFiltros && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="self-start rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent"
              >
                Limpiar filtros
              </button>
            )}

            {!catalogLoading && catalog.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <NivelChip activo={nivelFiltro === 'todos'} onClick={() => setNivelFiltro('todos')}>
                  Todas ({catalog.length})
                </NivelChip>
                {(['verde', 'amarillo', 'rojo'] as FiabilidadNivel[]).map((nv) => (
                  <NivelChip key={nv} activo={nivelFiltro === nv} onClick={() => setNivelFiltro(nv)} dot={NIVEL_COLOR[nv]}>
                    {NIVEL_LABEL[nv]} ({conteoNivel[nv]})
                  </NivelChip>
                ))}
              </div>
            )}

            {catalogLoading ? (
              <p className="px-1 py-3 text-sm">Cargando estaciones disponibles…</p>
            ) : catalog.length === 0 ? (
              <p className="px-1 py-3 text-sm">
                Aún no hay estaciones con curvas IDF precomputadas. El cálculo se ejecuta por estación y se irá poblando;
                vuelve más tarde.
              </p>
            ) : (
              <div className="mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-background">
                {filtered.length === 0 ? (
                  <p className="px-3 py-3 text-sm">
                    {munSinEstacion
                      ? `«${munFiltro}» no tiene estación propia (mira la sugerencia debajo).`
                      : 'Ninguna estación disponible coincide con los filtros aplicados.'}
                  </p>
                ) : (
                  filtered.slice(0, 200).map((s) => {
                    const active = station?.codigo === s.codigo;
                    return (
                      <button
                        key={s.codigo}
                        type="button"
                        onClick={() => {
                          setStation(s);
                          setHyetographYear('');
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/10 ${
                          active ? 'bg-accent/15 text-accent' : 'text-card-foreground'
                        }`}
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0 text-accent" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{s.nombre}</span>
                          <span className="block truncate text-xs text-muted-foreground">{s.codigo} · {s.municipio}, {s.departamento}</span>
                        </span>
                        {s.fiabilidad && (
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: NIVEL_COLOR[s.fiabilidad.level] }}
                            title={`${NIVEL_LABEL[s.fiabilidad.level]}${s.fiabilidad.reasons?.length ? ' · ' + s.fiabilidad.reasons.join(' ') : ''}`}
                          />
                        )}
                        {s.aniosValidos != null && (
                          <span className="shrink-0 text-[11px] text-muted-foreground">{s.aniosValidos} años</span>
                        )}
                      </button>
                    );
                  })
                )}
                {filtered.length > 200 && (
                  <p className="px-3 py-2 text-[11px] text-muted-foreground">
                    Mostrando 200 de {filtered.length}. Afina el filtro para ver el resto.
                  </p>
                )}
              </div>
            )}
            {munSinEstacion && (
              <div className="mt-1 flex flex-col gap-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
                <p className="text-xs text-card-foreground">
                  <span className="font-semibold">{munFiltro}</span> no tiene estación con análisis propia; te sugerimos la
                  <span className="font-semibold"> más cercana</span>:
                </p>
                {nearestLoading && <p className="py-1 text-sm">Buscando la estación más cercana…</p>}

                {nearest && !nearest.located && (
                  <p className="rounded-lg border border-border bg-background px-3 py-2 text-sm">{nearest.message}</p>
                )}

                {nearest && nearest.located && nearest.stations.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {(() => {
                      const best = nearest.stations[0];
                      return (
                        <div className="rounded-lg border border-accent/40 bg-accent/10 p-3">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                            <Navigation className="h-3.5 w-3.5" /> Estación más representativa para {munFiltro}
                          </div>
                      <p className="mt-1 text-sm font-bold text-card-foreground">{best.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {best.codigo} · {best.municipio}, {best.departamento}
                      </p>
                      <p className="mt-1 text-xs text-card-foreground">
                        a <span className="font-semibold">{best.distanceKm} km</span> del centro del municipio
                        {best.sameMunicipio && ' (dentro del municipio)'}
                        {best.altDiffM != null && <> · Δ altitud <span className="font-semibold">{fmtAltDiff(best.altDiffM)}</span></>}
                        {' '}· {best.aniosValidos} años de registro
                      </p>
                      {best.altDiffM != null && Math.abs(best.altDiffM) > ALT_WARN_M && (
                        <p className="mt-1 flex items-start gap-1 text-[11px] text-accent">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                          Diferencia de altitud considerable: verifica que el régimen de lluvia sea comparable.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setStation({ codigo: best.codigo, nombre: best.nombre, municipio: best.municipio, departamento: best.departamento, aniosValidos: best.aniosValidos });
                          setHyetographYear('');
                        }}
                        className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                          station?.codigo === best.codigo
                            ? 'bg-accent/20 text-accent'
                            : 'bg-gradient-to-br from-primary to-accent text-white hover:opacity-90'
                        }`}
                      >
                        <Plus className="h-3.5 w-3.5" /> {station?.codigo === best.codigo ? 'En uso' : 'Usar esta estación'}
                      </button>
                    </div>
                  );
                })()}

                {nearest.stations.length > 1 && (
                  <div className="rounded-lg border border-border bg-background">
                    <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide">Otras cercanas</p>
                    {nearest.stations.slice(1).map((s) => (
                      <button
                        key={s.codigo}
                        type="button"
                        onClick={() => {
                          setStation({ codigo: s.codigo, nombre: s.nombre, municipio: s.municipio, departamento: s.departamento, aniosValidos: s.aniosValidos });
                          setHyetographYear('');
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/10 ${
                          station?.codigo === s.codigo ? 'bg-accent/15 text-accent' : 'text-card-foreground'
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{s.nombre}</span>
                          <span className="block truncate text-xs text-muted-foreground">{s.municipio}, {s.departamento} · {s.aniosValidos} años</span>
                        </span>
                        <span className="shrink-0 text-right text-[11px] text-muted-foreground">
                          {s.distanceKm} km
                          {s.altDiffM != null && (
                            <span className={`block ${Math.abs(s.altDiffM) > ALT_WARN_M ? 'text-accent' : ''}`}>Δ {fmtAltDiff(s.altDiffM)}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <p className="text-[11px] leading-snug text-muted-foreground">
                  La distancia y la Δaltitud (respecto al centro del municipio) son guías de representatividad: en zonas de
                  montaña un desnivel grande pesa más que la distancia horizontal (otro piso térmico → otro régimen de
                  lluvia). El criterio final es del ingeniero; la curva IDF sigue siendo puntual (de esa estación).
                </p>
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {!station ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
          <Droplets className="mx-auto mb-3 h-8 w-8 text-accent" />
          <p className="font-semibold text-card-foreground">Elige una estación de la lista de arriba</p>
          <p className="mt-1 text-sm">Solo aparecen las que tienen análisis disponible; los cálculos corren sobre su registro completo en el espejo.</p>
        </div>
      ) : (
        <>
          {(returnPeriods?.warnings || []).length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{returnPeriods?.warnings.map((w) => <p key={w}>{w}</p>)}</div>
            </div>
          )}

          {/* CURVAS IDF — pieza estrella, ancho completo */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-glow">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-card-foreground">Curvas IDF · Intensidad–Duración–Frecuencia</h3>
                <p className="text-sm text-muted-foreground">
                  {idf?.available
                    ? `Intensidad (mm/h) vs duración, una curva por período de retorno · ${idf.nYears} años, datos de 10 min`
                    : 'Familia de curvas de diseño de drenaje'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <InfoGrafica id="idf" />
                {idf?.available && (
                  <>
                    <ChartDownloadButton
                      targetRef={idfChartRef}
                      title="Curva IDF"
                      subtitle={station?.nombre ?? station?.codigo}
                      filenameParts={['curva-idf', station?.nombre ?? station?.codigo ?? '']}
                    />
                    <button
                      type="button"
                      onClick={descargarPdf}
                      disabled={pdfBusy}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
                      title="Descargar informe PDF"
                    >
                      <FileDown className="h-4 w-4" />
                      {pdfBusy ? 'Generando…' : 'PDF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCorreoOpen(true)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent"
                      title="Enviar el PDF por correo"
                    >
                      <Mail className="h-4 w-4" />
                      Correo
                    </button>
                  </>
                )}
                <CloudRain className="h-5 w-5 shrink-0 text-accent" />
              </div>
            </div>
            {isLoading ? (
              <SkeletonLoader rows={5} />
            ) : !idf?.available ? (
              <p className="text-muted-foreground text-sm">
                {idf?.message || 'Esta estación no tiene curvas IDF disponibles todavía.'}
              </p>
            ) : (
              <div className="space-y-4">
                <div ref={idfChartRef} className="bg-card" style={{ width: '100%', height: '320px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={idfChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                      <XAxis
                        dataKey="durMin"
                        type="number"
                        scale="log"
                        domain={['dataMin', 'dataMax']}
                        ticks={[10, 20, 30, 60, 120, 180, 360, 720, 1440]}
                        stroke="currentColor"
                        className="text-muted-foreground"
                        style={{ fontSize: '11px' }}
                        label={{ value: 'Duración (min, escala log)', position: 'insideBottom', offset: -2, fontSize: 10 }}
                      />
                      <YAxis
                        scale="log"
                        domain={['auto', 'auto']}
                        stroke="currentColor"
                        className="text-muted-foreground"
                        style={{ fontSize: '11px' }}
                        width={52}
                        label={{ value: 'mm/h', angle: -90, position: 'insideLeft', fontSize: 10 }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number, name: string) => [`${fmt(value, 1)} mm/h`, name.replace('tr', 'Tr ') + ' años']}
                        labelFormatter={(v) => `Duración ${v} min`}
                      />
                      <Legend formatter={(value: string) => `Tr ${value.replace('tr', '')} años`} />
                      {(idf.returnPeriods || []).map((tr, index) => (
                        <Line
                          key={tr}
                          type="monotone"
                          dataKey={`tr${tr}`}
                          stroke={IDF_COLORS[index % IDF_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          connectNulls
                          isAnimationActive animationDuration={550}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {idf.equation && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
                    <span className="text-muted-foreground">Ecuación ajustada:</span>
                    <Formula className="text-base font-semibold text-card-foreground">
                      <V>I</V>&nbsp;=&nbsp;
                      <Frac
                        num={<>{fmt(idf.equation.K, 3)} · <V>T</V><Sup>{fmt(idf.equation.m, 3)}</Sup></>}
                        den={<><V>D</V><Sup>{fmt(idf.equation.n, 3)}</Sup></>}
                      />
                    </Formula>
                    <span className="text-xs text-muted-foreground">
                      (<V>I</V> en mm/h, <V>T</V> en años, <V>D</V> en min · <V>R</V><Sup>2</Sup><Sub>log</Sub> = {fmt(idf.equation.r2, 3)})
                    </span>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-3 font-semibold">Dur. (min)</th>
                        {(idf.returnPeriods || []).map((tr) => (
                          <th key={tr} className="py-2 pr-3 text-right font-semibold">Tr {tr}a</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {idfChartData.map((row) => (
                        <tr key={row.durMin} className="border-b border-border/60">
                          <td className="py-2 pr-3 font-mono text-card-foreground">{row.durMin}</td>
                          {(idf.returnPeriods || []).map((tr) => (
                            <td
                              key={tr}
                              title={row[`tr${tr}_lo`] != null ? `IC 90%: ${fmt(row[`tr${tr}_lo`], 1)}–${fmt(row[`tr${tr}_hi`], 1)} mm/h` : undefined}
                              className="py-2 pr-3 text-right font-mono text-card-foreground"
                            >
                              {row[`tr${tr}`] != null ? fmt(row[`tr${tr}`], 1) : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-1 text-xs text-muted-foreground">Intensidades en mm/h.</p>
                </div>

                {(idf.warnings || []).map((w) => (
                  <div key={w} className="flex items-start gap-2 text-xs text-accent">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {idf?.available && idf.equation && (
            <CalculadoraCaudal equation={idf.equation} durations={idf.durations} />
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6 shadow-glow">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-card-foreground">Períodos de retorno · lluvia máxima diaria</h3>
                  <p className="text-sm text-muted-foreground">{returnPeriods?.recommended ?? 'Ajuste de extremos'} sobre {returnPeriods?.n ?? 0} máximos anuales{returnPeriods?.recommended ? ' · recomendada por AIC' : ''}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <InfoGrafica id="periodos-retorno" />
                  {returnPeriods?.reliability && (() => {
                    const r = returnPeriods.reliability;
                    const cfg = {
                      verde: { cls: 'border-success/40 bg-success/10 text-success', label: 'Alta' },
                      amarillo: { cls: 'border-accent/40 bg-accent/10 text-accent', label: 'Media' },
                      rojo: { cls: 'border-red-500/40 bg-red-500/10 text-red-500', label: 'Baja' },
                    }[r.level];
                    return (
                      <span
                        title={r.reasons.length ? r.reasons.join(' · ') : 'Registro largo, completo y estacionario.'}
                        className={`cursor-help rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}
                      >
                        Fiabilidad: {cfg.label}
                      </span>
                    );
                  })()}
                  <Waves className="h-5 w-5 text-accent" />
                </div>
              </div>
              {isLoading ? (
                <SkeletonLoader rows={4} />
              ) : !returnPeriods?.gumbel ? (
                <p className="text-muted-foreground text-sm">Registro insuficiente para ajustar (mínimo 5 años válidos).</p>
              ) : (
                <>
                  {returnPeriods.goodnessOfFit && (
                    <div
                      className={`mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                        returnPeriods.goodnessOfFit.passes
                          ? 'border-success/40 bg-success/10 text-success'
                          : 'border-accent/40 bg-accent/10 text-accent'
                      }`}
                    >
                      {returnPeriods.goodnessOfFit.passes ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                      <span>
                        <strong>Bondad de ajuste (Kolmogorov-Smirnov):</strong>{' '}
                        {returnPeriods.goodnessOfFit.passes
                          ? `el ajuste ${returnPeriods.recommended ?? 'recomendado'} es aceptable`
                          : `el ajuste ${returnPeriods.recommended ?? 'recomendado'} NO pasa el test; usa los cuantiles con cautela`}:{' '}
        <V>D</V> = {fmt(returnPeriods.goodnessOfFit.statistic, 4)} {returnPeriods.goodnessOfFit.passes ? '<' : '≥'} {fmt(returnPeriods.goodnessOfFit.critical, 4)} (crítico, <V>α</V> = {fmt(returnPeriods.goodnessOfFit.alpha, 2)}). Exigido por el Manual de Drenaje INVÍAS.
                      </span>
                    </div>
                  )}
                  {returnPeriods.gumbel && (
                    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
                      <span className="text-muted-foreground">Cuantil de Gumbel (referencia, L-momentos):</span>
                      <Formula className="text-base font-semibold text-card-foreground">
                        <V>x</V><Sub>T</Sub>&nbsp;=&nbsp;<V>μ</V> − <V>β</V> · ln(−ln(1 − 1/<V>T</V>))
                      </Formula>
                      <span className="text-xs text-muted-foreground">
                        (<V>μ</V> = {fmt(returnPeriods.gumbel.mu, 2)}, <V>β</V> = {fmt(returnPeriods.gumbel.beta, 2)} mm/día · L-momentos; <V>T</V> en años)
                      </span>
                    </div>
                  )}
                  <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {returnPeriods.quantiles.map((q) => (
                      <div key={q.returnPeriod} className="rounded-lg border border-border bg-background p-2 text-center">
                        <p className="text-xs text-muted-foreground">Tr {q.returnPeriod} años</p>
                        <p className="font-mono text-sm font-bold text-card-foreground">{fmt(q.value, 1)}</p>
                        <p className="text-[10px] text-muted-foreground">mm/día</p>
                        {q.lower != null && q.upper != null && (
                          <p className="text-[10px] text-muted-foreground">IC 90%: {fmt(q.lower, 1)}–{fmt(q.upper, 1)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ width: '100%', height: '220px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={returnCurve}>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                        <XAxis
                          dataKey="tr"
                          type="number"
                          scale="log"
                          domain={[1, 120]}
                          ticks={[2, 5, 10, 25, 50, 100]}
                          stroke="currentColor"
                          className="text-muted-foreground"
                          style={{ fontSize: '11px' }}
                          label={{ value: 'Período de retorno (años, escala log)', position: 'insideBottom', offset: -2, fontSize: 10 }}
                        />
                        <YAxis stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '11px' }} width={48} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`${fmt(value, 1)} mm/día`, name]} labelFormatter={(v) => `Tr ≈ ${v} años`} />
                        <Area dataKey="banda" name="IC 90%" stroke="none" fill="#C9A227" fillOpacity={0.15} connectNulls isAnimationActive animationDuration={550} />
                        <Line type="monotone" dataKey="ajustado" name="Gumbel ajustado" stroke="#C9A227" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive animationDuration={550} />
                        <Scatter dataKey="observado" name="Observado (Weibull)" fill="#A3161A" isAnimationActive animationDuration={550} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-glow">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-card-foreground">Monitor de sequía · SPI-{spiScale}</h3>
                  <p className="text-sm text-muted-foreground">Índice de Precipitación Estandarizada (últimos 10 años)</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <InfoGrafica id="spi" />
                  <div className="flex gap-1">
                  {([3, 6, 12] as const).map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => setSpiScale(scale)}
                      aria-pressed={spiScale === scale}
                      className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                        spiScale === scale ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted-foreground'
                      }`}
                    >
                      {scale}m
                    </button>
                  ))}
                  </div>
                </div>
              </div>
              {!spi ? (
                <SkeletonLoader rows={4} />
              ) : !spi.points.length ? (
                <p className="text-muted-foreground text-sm">Registro mensual insuficiente para el SPI.</p>
              ) : (
                <>
                  {spi.latest && spi.latest.spi !== null && (
                    <div className="mb-3 flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
                      <span className="font-mono text-2xl font-bold" style={{ color: spiColor(spi.latest.spi) }}>
                        {spi.latest.spi > 0 ? `+${fmt(spi.latest.spi, 2)}` : fmt(spi.latest.spi, 2)}
                      </span>
                      <span className="text-sm">
                        <span className="block font-semibold text-card-foreground">{spi.latest.category}</span>
                        <span className="block text-xs text-muted-foreground">{spi.latest.month} · acumulado {spi.latest.precipitation.toLocaleString('es-CO')} mm/{spi.scale} meses</span>
                      </span>
                    </div>
                  )}
                  <div style={{ width: '100%', height: '190px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={spiData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                        <XAxis dataKey="label" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '10px' }} minTickGap={28} />
                        <YAxis domain={[-3, 3]} stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '11px' }} width={32} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name, item: { payload?: SpiPointLike }) => [`${fmt(value, 2)} (${item.payload?.category || ''})`, 'SPI']} />
                        <Bar dataKey="spi" isAnimationActive animationDuration={550}>
                          {spiData.map((p) => (
                            <Cell key={p.month} fill={spiColor(p.spi)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-glow">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-card-foreground">Hietograma mensual</h3>
                  <p className="text-sm text-muted-foreground">Lluvia acumulada por mes del año elegido</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <InfoGrafica id="hietograma" />
                  <select
                    value={hyetographYear}
                    onChange={(event) => setHyetographYear(event.target.value)}
                    className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-card-foreground outline-none focus:border-accent"
                    aria-label="Año del hietograma"
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
              {!hyetograph ? (
                <SkeletonLoader rows={4} />
              ) : (
                <div style={{ width: '100%', height: '210px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hyetographData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                      <XAxis dataKey="label" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '11px' }} />
                      <YAxis stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '11px' }} width={48} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${fmt(value, 0)} mm`, 'Acumulado']} />
                      <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={550} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-glow">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-card-foreground">Histograma de acumulados diarios</h3>
                  <p className="text-sm text-muted-foreground">
                    {histogramData
                      ? `${histogramData.dryDays.toLocaleString('es-CO')} días secos · ${histogramData.wetDays.toLocaleString('es-CO')} con lluvia · máx ${fmt(histogramData.maxDaily, 1)} mm`
                      : 'Distribución de frecuencias'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <InfoGrafica id="histograma" />
                  <BarChart4 className="h-5 w-5 shrink-0 text-accent" />
                </div>
              </div>
              {!histogramData ? (
                <SkeletonLoader rows={4} />
              ) : (
                <div style={{ width: '100%', height: '210px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={histogramBins}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                      <XAxis dataKey="label" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '10px' }} minTickGap={16} label={{ value: 'mm/día', position: 'insideBottom', offset: -2, fontSize: 10 }} />
                      <YAxis stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '11px' }} width={48} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value.toLocaleString('es-CO')} días`, 'Frecuencia']} labelFormatter={(v) => `${v} mm`} />
                      <Bar dataKey="dias" fill="var(--accent)" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={550} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            <CloudRain className="mr-1 inline h-3.5 w-3.5 text-accent" />
            Métodos: Gumbel/GEV/Log-Pearson III sobre máximos anuales, mejor por AIC (L-momentos; años con ≥300 días de datos; Chow, Maidment &amp; Mays) y SPI
            no-paramétrico por percentiles empíricos (variante de la guía OMM). Estos análisis son orientativos: para diseño
            definitivo valida con los datos crudos y la normativa aplicable.
          </p>

          {idf?.available && (
            <EnviarPorCorreo
              open={correoOpen}
              onOpenChange={setCorreoOpen}
              stationName={station.nombre}
              stationCode={station.codigo}
            />
          )}
        </>
      )}
    </div>
  );
}

interface SpiPointLike {
  category?: string;
}
