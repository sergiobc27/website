import { useMemo } from 'react';
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line,
  ReferenceDot, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Droplets } from 'lucide-react';
import { Formula, V, Sup, Frac } from '../Formula';
import { fmt } from '../../lib/format';
import { intensidadDeCurva, type HistoriaIdfData } from '../../lib/historia';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';

// Misma paleta de curvas IDF que Hidrología (consistencia visual).
const IDF_COLORS = ['#60a5fa', '#34d399', '#C9A227', '#f59e0b', '#A3161A', '#7f1d1d'];

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--foreground)',
  fontSize: 12,
} as const;

const ejeProps = {
  stroke: 'currentColor' as const,
  className: 'text-muted-foreground',
  style: { fontSize: '11px' },
};

/**
 * La visualización de cada lámina del scrollytelling: recibe la escena (1-8) y
 * rinde su gráfica. YA NO se controla con key={escena}: cada Lámina monta su
 * GraficaViva una vez (continuidad), y la animación de recharts se desactiva
 * con prefers-reduced-motion. Decorativa para lectores de pantalla (aria-hidden):
 * la narrativa textual de cada capítulo ES el contenido accesible (toda cifra
 * nueva de las anotaciones también vive en el copy).
 */
export function GraficaViva({ escena, data }: { escena: number; data: HistoriaIdfData }) {
  const animar = !usePrefersReducedMotion();
  const tormenta = data.tormenta;
  // Foco progresivo: las barras del pico (>=90% del máximo) se resaltan; el resto se atenúa.
  const picoUmbral = useMemo(() => 0.9 * Math.max(...tormenta.puntos.map((p) => p.mm), 0), [tormenta]);
  const cuantiles = useMemo(
    () => data.cuantiles.map((q) => ({
      ...q,
      banda: q.lower !== undefined && q.upper !== undefined ? [q.lower, q.upper] : null,
    })),
    [data],
  );
  const curva25 = useMemo(() => {
    const c = data.curvas.reduce((m, x) => (Math.abs(x.tr - 25) < Math.abs(m.tr - 25) ? x : m));
    return {
      tr: c.tr,
      puntos: c.puntos.map((p) => ({
        ...p,
        banda: p.lowerMmH !== undefined && p.upperMmH !== undefined ? [p.lowerMmH, p.upperMmH] : null,
      })),
    };
  }, [data]);
  const ejemploQ = useMemo(() => {
    const dur = data.curvas[0]?.puntos.some((p) => p.durMin === 15) ? 15 : data.curvas[0]?.puntos[0]?.durMin || 10;
    return intensidadDeCurva(data.curvas, 25, dur);
  }, [data]);

  return (
    <div aria-hidden="true" className="flex h-full w-full flex-col">
      {escena === 1 && (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
          <Droplets className="anim-float h-12 w-12 text-accent" />
          <p className="text-3xl font-bold text-card-foreground">{data.estacion.nombre}</p>
          <p className="text-muted-foreground">
            {data.estacion.municipio}, {data.estacion.departamento}
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Dato titulo="Años de registro" valor={`${data.estacion.aniosValidos}`} />
            <Dato titulo="Resolución" valor="10 minutos" />
            <Dato titulo="Código IDEAM" valor={data.estacion.codigo} />
            <Dato titulo="Fiabilidad" valor={data.estacion.fiabilidad === 'rojo' ? '🔴 serie corta' : data.estacion.fiabilidad} />
          </div>
        </div>
      )}

      {escena === 2 && (
        <ChartCon titulo={`Tormenta real del ${tormenta.fecha} — pulsos de 10 minutos`}>
          <BarChart data={tormenta.puntos}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
            <XAxis dataKey="hora" {...ejeProps} minTickGap={40} />
            <YAxis {...ejeProps} width={40} label={{ value: 'mm/10min', angle: -90, position: 'insideLeft', fontSize: 10 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${fmt(Number(v), 2)} mm`, 'lluvia']} />
            <ReferenceLine
              y={Math.max(...tormenta.puntos.map((p) => p.mm), 0)}
              stroke="#A3161A"
              strokeDasharray="4 3"
              label={{ value: 'pico', position: 'right', fontSize: 10, fill: '#A3161A' }}
            />
            <Bar dataKey="mm" isAnimationActive={animar} animationDuration={550}>
              {tormenta.puntos.map((p, i) => (
                <Cell key={i} fill={p.mm >= picoUmbral ? '#A3161A' : '#2563eb'} fillOpacity={p.mm >= picoUmbral ? 1 : 0.4} />
              ))}
            </Bar>
          </BarChart>
        </ChartCon>
      )}

      {escena === 3 && (
        <div className="flex h-full flex-col gap-2">
          <ChartCon titulo="Lo que vemos con datos de 10 minutos" altura="flex-[3]">
            <BarChart data={tormenta.puntos}>
              <XAxis dataKey="hora" {...ejeProps} minTickGap={40} />
              <YAxis {...ejeProps} width={40} />
              <Bar dataKey="mm" isAnimationActive={animar} animationDuration={550}>
                {tormenta.puntos.map((p, i) => (
                  <Cell key={i} fill={p.mm >= picoUmbral ? '#A3161A' : '#2563eb'} fillOpacity={p.mm >= picoUmbral ? 1 : 0.45} />
                ))}
              </Bar>
            </BarChart>
          </ChartCon>
          <ChartCon titulo="Lo que vería la práctica común: un solo dato diario" altura="flex-[2]">
            <BarChart data={[{ nombre: tormenta.fecha, mm: tormenta.totalMm }]} layout="vertical">
              <XAxis type="number" {...ejeProps} />
              <YAxis type="category" dataKey="nombre" {...ejeProps} width={84} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${fmt(Number(v))} mm`, 'total del día']} />
              <Bar dataKey="mm" fill="var(--accent)" radius={[0, 4, 4, 0]} isAnimationActive={animar} animationDuration={550} />
            </BarChart>
          </ChartCon>
        </div>
      )}

      {escena === 4 && (
        <ChartCon titulo={`La peor tormenta de 24 h de cada año (${data.maximosAnuales.length} años)`}>
          <ComposedChart data={data.maximosAnuales}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
            <XAxis dataKey="anio" {...ejeProps} />
            <YAxis {...ejeProps} width={40} label={{ value: 'mm/día', angle: -90, position: 'insideLeft', fontSize: 10 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${fmt(Number(v))} mm`, 'máximo anual']} />
            <Scatter dataKey="mm" fill="#A3161A" fillOpacity={0.7} isAnimationActive={animar} animationDuration={550} />
            <ReferenceDot
              x={Number(tormenta.fecha.slice(0, 4))}
              y={tormenta.totalMm}
              r={8}
              fill="none"
              stroke="#C9A227"
              strokeWidth={2}
            />
          </ComposedChart>
        </ChartCon>
      )}

      {escena === 5 && (
        <ChartCon titulo="Del azar a la probabilidad: ajuste de Gumbel">
          <ComposedChart data={cuantiles}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
            <XAxis
              dataKey="tr"
              type="number"
              scale="log"
              domain={[1.5, 120]}
              ticks={[2, 5, 10, 25, 50, 100]}
              {...ejeProps}
              label={{ value: 'Período de retorno (años)', position: 'insideBottom', offset: -4, fontSize: 10 }}
            />
            <YAxis {...ejeProps} width={40} label={{ value: 'mm/día', angle: -90, position: 'insideLeft', fontSize: 10 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [Array.isArray(v) ? `${fmt(Number(v[0]))}–${fmt(Number(v[1]))} mm` : `${fmt(Number(v))} mm`, n]} />
            <Area dataKey="banda" name="IC 90%" stroke="none" fill="#C9A227" fillOpacity={0.18} connectNulls isAnimationActive={animar} animationDuration={550} />
            <Line type="monotone" dataKey="mm" name="Gumbel ajustado" stroke="#C9A227" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={animar} animationDuration={550} />
            <Scatter data={data.empiricos} dataKey="mm" name="Observado" fill="#A3161A" isAnimationActive={animar} animationDuration={550} />
            <ReferenceLine x={25} stroke="#A3161A" strokeDasharray="4 3" label={{ value: 'Tr 25 · 4% anual', position: 'top', fontSize: 10, fill: '#A3161A' }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </ComposedChart>
        </ChartCon>
      )}

      {escena === 6 && (
        <ChartCon titulo={`Curvas IDF reales de ${data.estacion.nombre}`}>
          <ComposedChart>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
            <XAxis
              dataKey="durMin"
              type="number"
              scale="log"
              domain={[8, 1600]}
              ticks={[10, 30, 60, 180, 360, 1440]}
              {...ejeProps}
              label={{ value: 'Duración (min)', position: 'insideBottom', offset: -4, fontSize: 10 }}
            />
            <YAxis {...ejeProps} width={44} label={{ value: 'mm/h', angle: -90, position: 'insideLeft', fontSize: 10 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [Array.isArray(v) ? `${fmt(Number(v[0]))}–${fmt(Number(v[1]))}` : `${fmt(Number(v))} mm/h`, n]} />
            <Area data={curva25.puntos} dataKey="banda" name={`IC 90% (Tr ${curva25.tr})`} stroke="none" fill="#C9A227" fillOpacity={0.18} connectNulls isAnimationActive={animar} animationDuration={550} />
            {data.curvas.map((c, i) => {
              const esTr25 = c.tr === curva25.tr;
              return (
                <Line
                  key={c.tr}
                  data={c.puntos}
                  dataKey="mmH"
                  name={`Tr ${c.tr}`}
                  type="monotone"
                  stroke={IDF_COLORS[i % IDF_COLORS.length]}
                  strokeWidth={esTr25 ? 2.8 : 1.5}
                  strokeOpacity={esTr25 ? 1 : 0.4}
                  dot={false}
                  isAnimationActive={animar}
                  animationDuration={550}
                />
              );
            })}
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </ComposedChart>
        </ChartCon>
      )}

      {escena === 7 && data.ecuacion && (
        <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">La ecuación de esta estación</p>
          <Formula className="text-3xl text-card-foreground">
            <V>I</V>
            <span className="mx-1">=</span>
            <Frac
              num={<><V>{fmt(data.ecuacion.K)}</V> · <V>T</V><Sup>{fmt(data.ecuacion.m, 3)}</Sup></>}
              den={<><V>D</V><Sup>{fmt(data.ecuacion.n, 3)}</Sup></>}
            />
          </Formula>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Dato titulo="K (escala)" valor={fmt(data.ecuacion.K)} />
            <Dato titulo="m (efecto del Tr)" valor={fmt(data.ecuacion.m, 3)} />
            <Dato titulo="n (decaimiento)" valor={fmt(data.ecuacion.n, 3)} />
          </div>
          <p className="text-sm text-muted-foreground">
            Bondad del ajuste: <strong className="text-card-foreground">R² = {fmt(data.ecuacion.r2, 3)}</strong>
          </p>
        </div>
      )}

      {escena === 8 && ejemploQ && (
        <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Del dato al diseño (método racional)</p>
          <Formula className="text-2xl text-card-foreground">
            <V>Q</V>
            <span className="mx-1">=</span>
            <Frac num={<><V>C</V> · <V>I</V> · <V>A</V></>} den={<V>360</V>} />
          </Formula>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Dato titulo="C (zona urbana)" valor="0,80" />
            <Dato titulo={`I (Tr ${ejemploQ.tr}, ${ejemploQ.durMin} min)`} valor={`${fmt(ejemploQ.mmH)} mm/h`} />
            <Dato titulo="A (una manzana)" valor="1 ha" />
          </div>
          <p className="text-2xl font-bold text-accent">
            Q ≈ {fmt((0.8 * ejemploQ.mmH * 1) / 360 * 1000, 0)} L/s
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            El caudal que ese alcantarillado debería evacuar. Estimación orientativa: el diseño real lo rige la
            norma (RAS 0330 / INVÍAS) y el criterio de un ingeniero.
          </p>
        </div>
      )}
    </div>
  );
}

function ChartCon({ titulo, children, altura = 'flex-1' }: { titulo: string; children: React.ReactElement; altura?: string }) {
  return (
    <div className={`flex min-h-0 flex-col ${altura}`}>
      <p className="mb-2 text-center text-xs font-semibold text-muted-foreground">{titulo}</p>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{titulo}</p>
      <p className="font-bold text-card-foreground">{valor}</p>
    </div>
  );
}
