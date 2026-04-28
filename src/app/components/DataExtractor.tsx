import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, CheckCircle, Database, Download, Layers, MapPin, Rocket, Search, Settings, ShieldCheck } from 'lucide-react';
import { EmptyState } from './EmptyState';

const HISTORY_KEY = 'ideam-history';

interface DatasetMeta {
  id: string;
  name: string;
  category: string;
  dateColumn?: string;
}

interface MetaResponse {
  datasets: DatasetMeta[];
  departments: string[];
  previewLimit: number;
  maxExportRows: number;
}

interface HistoryEntry {
  timestamp: string;
  variable: string;
  department: string;
  municipality: string;
  format: string;
  rowCount: number;
  fileName: string;
}

function getHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(entry: HistoryEntry) {
  const history = getHistory();
  history.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
}

export function DataExtractor() {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [datasetId, setDatasetId] = useState('');
  const [department, setDepartment] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [stationCode, setStationCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [logs, setLogs] = useState<Array<{ type: 'INFO' | 'SUCCESS' | 'ERROR'; message: string }>>([]);
  const [progress, setProgress] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [previewCount, setPreviewCount] = useState(0);
  const [coverageHtml, setCoverageHtml] = useState('Selecciona un departamento para validar cobertura territorial.');
  const [coverageLoading, setCoverageLoading] = useState(false);

  const selectedDataset = useMemo(
    () => meta?.datasets.find((dataset) => dataset.id === datasetId) || null,
    [meta, datasetId]
  );

  const appendLog = (type: 'INFO' | 'SUCCESS' | 'ERROR', message: string) => {
    setLogs((current) => [...current, { type, message }]);
  };

  const getPayload = () => ({
    datasetId,
    department,
    municipality,
    stationCode: stationCode.trim(),
    startDate,
    endDate,
    format,
  });

  const validatePayload = () => {
    if (!datasetId || !startDate || !endDate) {
      throw new Error('Selecciona variable, fecha de inicio y fecha final.');
    }
    if (startDate > endDate) {
      throw new Error('La fecha inicial no puede ser mayor que la fecha final.');
    }
  };

  useEffect(() => {
    const boot = async () => {
      appendLog('INFO', 'Cargando metadata operativa...');
      try {
        const response = await fetch('/api/meta');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'No fue posible cargar la metadata.');
        }
        setMeta(data);
        setDatasetId(data.datasets[0]?.id || '');
        const now = new Date();
        const from = new Date();
        from.setMonth(from.getMonth() - 1);
        setStartDate(from.toISOString().slice(0, 10));
        setEndDate(now.toISOString().slice(0, 10));
        appendLog('SUCCESS', 'Metadata cargada correctamente.');
      } catch (error) {
        appendLog('ERROR', error instanceof Error ? error.message : 'Error cargando metadata.');
      }
    };
    void boot();
  }, []);

  useEffect(() => {
    if (!department) {
      setMunicipalities([]);
      setMunicipality('');
      return;
    }

    const loadMunicipalities = async () => {
      appendLog('INFO', `Consultando municipios para ${department}...`);
      try {
        const response = await fetch(`/api/municipalities?department=${encodeURIComponent(department)}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'No fue posible cargar los municipios.');
        }
        setMunicipalities(data.municipalities || []);
        setMunicipality('');
        appendLog('SUCCESS', `Municipios cargados: ${data.municipalities?.length || 0}.`);
      } catch (error) {
        setMunicipalities([]);
        appendLog('ERROR', error instanceof Error ? error.message : 'Error cargando municipios.');
      }
    };

    void loadMunicipalities();
  }, [department]);

  const runCoverage = async () => {
    if (!datasetId || !department) {
      setCoverageHtml('Selecciona variable y departamento antes de validar cobertura.');
      return;
    }
    setCoverageLoading(true);
    appendLog('INFO', `Validando cobertura territorial para ${department}...`);
    try {
      const response = await fetch(
        `/api/coverage?datasetId=${encodeURIComponent(datasetId)}&department=${encodeURIComponent(department)}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No fue posible validar la cobertura.');
      }
      const html = [
        `<strong>Variantes configuradas:</strong> ${data.configured_variants.join(', ')}`,
        `<br /><strong>Filas cubiertas:</strong> ${Number(data.matched_rows || 0).toLocaleString('es-CO')}`,
        `<br /><strong>Filas no cubiertas:</strong> ${Number(data.unmatched_rows || 0).toLocaleString('es-CO')}`,
        data.unmatched_discovered?.length
          ? `<br /><strong>Variantes nuevas:</strong> ${data.unmatched_discovered.map((item: { departamento: string }) => item.departamento).join(', ')}`
          : '',
      ].join('');
      setCoverageHtml(html);
      appendLog('SUCCESS', 'Cobertura territorial validada.');
    } catch (error) {
      setCoverageHtml(error instanceof Error ? error.message : 'Error en la validación de cobertura.');
      appendLog('ERROR', error instanceof Error ? error.message : 'Error en la validación de cobertura.');
    } finally {
      setCoverageLoading(false);
    }
  };

  const runPreview = async () => {
    try {
      validatePayload();
      setIsBusy(true);
      setProgress(20);
      appendLog('INFO', 'Iniciando vista previa...');
      const response = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(getPayload()),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No fue posible generar la vista previa.');
      }
      setPreviewRows(data.rows || []);
      setPreviewCount(Number(data.rowCount || 0));
      setProgress(100);
      appendLog('SUCCESS', `Vista previa completada: ${Number(data.rowCount || 0).toLocaleString('es-CO')} filas.`);
    } catch (error) {
      setProgress(100);
      appendLog('ERROR', error instanceof Error ? error.message : 'Error en la vista previa.');
    } finally {
      setIsBusy(false);
    }
  };

  const runDownload = async () => {
    try {
      validatePayload();
      setIsBusy(true);
      setProgress(30);
      appendLog('INFO', `Iniciando descarga en ${format.toUpperCase()}...`);
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(getPayload()),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'No fue posible completar la descarga.');
      }

      const blob = await response.blob();
      const fileName = response.headers.get('x-export-name') || 'ideam-export.csv';
      const rowCount = Number(response.headers.get('x-row-count') || '0');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);

      saveHistory({
        timestamp: new Date().toLocaleString('es-CO'),
        variable: selectedDataset?.name || datasetId,
        department: department || 'Todos',
        municipality: municipality || 'Todos',
        format,
        rowCount,
        fileName,
      });

      setProgress(100);
      appendLog('SUCCESS', `Descarga completada: ${fileName}.`);
    } catch (error) {
      setProgress(100);
      appendLog('ERROR', error instanceof Error ? error.message : 'Error durante la descarga.');
    } finally {
      setIsBusy(false);
    }
  };

  const previewColumns = previewRows.length ? Object.keys(previewRows[0]).slice(0, 8) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-[calc(100vh-7rem)]">
      <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 overflow-y-auto shadow-[0_0_40px_rgba(201,162,39,0.1)]">
        <h2 className="text-card-foreground text-xl font-bold mb-6 flex items-center gap-2">
          <Settings className="w-6 h-6 text-accent" />
          Configuración de Consulta
        </h2>

        <div className="space-y-6">
          <Section title="Filtros Espaciales" icon={MapPin}>
            <SelectInput label="Departamento" value={department} onChange={setDepartment}>
              <option value="">Todos</option>
              {(meta?.departments || []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </SelectInput>
            <SelectInput label="Municipio" value={municipality} onChange={setMunicipality} disabled={!department}>
              <option value="">Todos</option>
              {municipalities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </SelectInput>
            <InputField label="Código de Estación" value={stationCode} onChange={setStationCode} placeholder="Ej: 21205790" />
          </Section>

          <Section title="Filtros Temáticos" icon={Layers}>
            <SelectInput label="Variable a Consultar" value={datasetId} onChange={setDatasetId}>
              {(meta?.datasets || []).map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.name} · {dataset.category}
                </option>
              ))}
            </SelectInput>
          </Section>

          <Section title="Rango Temporal" icon={Calendar}>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Fecha Inicio" type="date" value={startDate} onChange={setStartDate} />
              <InputField label="Fecha Fin" type="date" value={endDate} onChange={setEndDate} />
            </div>
            <div className="text-xs text-warning flex items-center gap-2 bg-warning/10 p-2 rounded border border-warning/20">
              <AlertCircle className="w-4 h-4" />
              <span className="font-semibold">
                Vista previa máxima: {meta?.previewLimit?.toLocaleString('es-CO') || 0} filas. Descarga máxima:{' '}
                {meta?.maxExportRows?.toLocaleString('es-CO') || 0} filas.
              </span>
            </div>
          </Section>

          <Section title="Formato de Salida" icon={Download}>
            <div className="flex gap-2">
              {(['csv', 'json'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFormat(item)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    format === item
                      ? 'bg-accent text-accent-foreground shadow-[0_0_20px] shadow-accent/40'
                      : 'bg-muted text-muted-foreground hover:text-card-foreground hover:bg-primary/20'
                  }`}
                >
                  {item.toUpperCase()}
                </button>
              ))}
            </div>
          </Section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={runPreview}
              disabled={isBusy || !meta}
              className="w-full bg-muted text-card-foreground py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-accent/20 hover:text-accent transition-all disabled:opacity-50"
            >
              <Search className="w-5 h-5" />
              Vista previa
            </button>
            <button
              type="button"
              onClick={runDownload}
              disabled={isBusy || !meta}
              className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:shadow-[0_0_30px] hover:shadow-accent/40 transition-all disabled:opacity-50"
            >
              <Rocket className={`w-5 h-5 ${isBusy ? 'animate-bounce' : ''}`} />
              Descargar
            </button>
          </div>

          <button
            type="button"
            onClick={runCoverage}
            disabled={coverageLoading || !department || !datasetId}
            className="w-full text-left text-sm text-accent hover:text-accent/80 flex items-center gap-2 font-semibold disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            {coverageLoading ? 'Validando cobertura...' : 'Validar cobertura territorial'}
          </button>

          <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground leading-6">
            <div dangerouslySetInnerHTML={{ __html: coverageHtml }} />
          </div>
        </div>
      </div>

      <div className="lg:col-span-3 space-y-6 overflow-y-auto">
        <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
          <h3 className="text-card-foreground font-bold mb-4">Estado de Ejecución</h3>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-muted-foreground text-xs font-mono font-semibold">Progreso</p>
              <p className="text-card-foreground text-sm font-mono font-bold">{progress}%</p>
            </div>
            <div className="relative overflow-hidden bg-muted rounded-full w-full h-4">
              <div
                className="bg-gradient-to-r from-primary to-accent h-full transition-all duration-300 shadow-[0_0_20px] shadow-accent/60"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 font-mono text-sm">
            <StatusCard title="Dataset" value={selectedDataset?.name || '—'} />
            <StatusCard title="Vista previa" value={previewCount ? previewCount.toLocaleString('es-CO') : '0'} />
            <StatusCard title="Formato" value={format.toUpperCase()} />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-[0_0_40px_rgba(201,162,39,0.1)]">
          <div className="flex border-b border-border">
            <div className="px-6 py-3 text-sm font-semibold text-accent border-b-2 border-accent">Terminal Log</div>
          </div>
          <div className="p-6">
            {logs.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="bg-black rounded-lg p-4 h-[240px] overflow-y-auto font-mono text-sm">
                {logs.map((log, index) => (
                  <div key={`${log.type}-${index}`} className="mb-1">
                    <span
                      className={`font-bold ${
                        log.type === 'SUCCESS'
                          ? 'text-success'
                          : log.type === 'ERROR'
                          ? 'text-destructive'
                          : 'text-accent'
                      }`}
                    >
                      [{log.type}]
                    </span>
                    <span className="text-gray-200 ml-2">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-[0_0_40px_rgba(201,162,39,0.1)]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h3 className="text-card-foreground font-bold">Vista Previa</h3>
            <span className="text-muted-foreground text-sm font-mono">
              {previewCount.toLocaleString('es-CO')} filas encontradas
            </span>
          </div>
          <div className="p-6">
            {previewRows.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground border-b border-border">
                    <tr>
                      {previewColumns.map((column) => (
                        <th key={column} className="text-left p-3 font-mono font-bold">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-card-foreground font-mono">
                    {previewRows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-border hover:bg-muted/50 transition-colors">
                        {previewColumns.map((column) => (
                          <td key={`${rowIndex}-${column}`} className="p-3">
                            {String(row[column] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-card-foreground text-sm font-bold flex items-center gap-2 border-b border-border pb-2">
        <Icon className="w-4 h-4 text-accent" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-muted-foreground text-sm mb-2 flex items-center gap-2 font-semibold">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-input text-card-foreground px-4 py-2 rounded-lg border border-border focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
      />
    </div>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  children,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-muted-foreground text-sm mb-2 flex items-center gap-2 font-semibold">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full bg-input text-card-foreground px-4 py-2 rounded-lg border border-border focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all disabled:opacity-60"
      >
        {children}
      </select>
    </div>
  );
}

function StatusCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-background p-3 rounded-lg border border-border">
      <p className="text-muted-foreground text-xs font-semibold">{title}</p>
      <p className="text-card-foreground font-bold break-words">{value}</p>
    </div>
  );
}
