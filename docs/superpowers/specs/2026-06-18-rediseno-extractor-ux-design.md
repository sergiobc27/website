# Rediseño UX del Extractor de Datos — Diseño

**Fecha:** 2026-06-18
**Componente:** `src/app/components/DataExtractor.tsx` (~2000 líneas) + nuevos `src/app/lib/curiosidades.ts` y utilidades.
**Decisiones del usuario:** rediseño **completo (A→B→C)** · tono **divulgativo con chispa** · recorte **equilibrado**.

## 1. Objetivo y principios

El Extractor es el pilar del sitio pero abruma a un usuario no experto y la espera de la descarga es pasiva/utilitaria. Metas:

1. **Menos es más:** dos capas — un **CORE** que el 80% completa sin pensar y **una sola** capa "avanzado" + un "detalle técnico" colapsado (NN/g: máx. 2 niveles de disclosure).
2. **Progreso honesto y tranquilo:** mostrar el progreso **real** que el backend ya emite, con cierre claro.
3. **Espera amena:** datos curiosos contextuales que rotan durante la descarga (Maister: la espera ocupada se siente más corta; Mozilla 2021: mejora la velocidad percibida sin tocar backend).

**Fundamentación:** NN/g (Progress Indicators; Response Times; Progressive Disclosure; Skeletons), Maister (*Psychology of Waiting Lines*), Buell & Norton (*Labor Illusion*, HBS 2011), Harrison et al. (*Faster Progress Bars*, CHI 2010), Hohenstein et al. (Mozilla 2021), WCAG 2.3.3.

## 2. Restricciones (NO romper)

- **Frontend puro.** No toca backend/box/datos ni los contratos de la API.
- **No romper** la lógica de jobs/polling/backoff/reconexión/persistencia (`ACTIVE_JOB_KEY`, `CONFIG_KEY`), los **deep-links** del Asistente (parser multi-depto), ni la validación inline.
- **Reusar** lo que existe (no inventar): tokens/keyframes de `src/styles/theme.css` (`fade-in-up`, `glow-pulse`, `glow-pulse-success`, `shimmer`, `bento-enter`), `Tooltip`, `SkeletonLoader`, `MetricCard`, `ProgressRing`, `PhaseStepper`, `lib/downloadHistory.ts`.
- **Sin firmas de Claude** en commits/PR. `sergiobc27/website`: main exige PR → merge → auto-deploy.
- **Accesibilidad** y `prefers-reduced-motion` obligatorios.

## 3. Diseño por parte

### A · Menos es más (recorte "equilibrado": reorganizar, no borrar)

Tres niveles de visibilidad. Mapeo de los elementos actuales (del inventario):

- **CORE (siempre visible):** selector de **Variable**, **Territorio** (chips/mapa + buscador + todos/ninguno), **Temporalidad**, **consentimiento**, botones **Vista previa** / **Descargar ZIP**, y un nuevo bloque **resumen-primero en prosa** justo antes del botón:
  > *"Descargarás **lluvia de Córdoba**, 2015–2024, ~12 estaciones · ~8 MB · 1–2 min aprox."*
  (frase natural, no pares `Etiqueta: valor`; fija expectativa de duración — Maister).
- **"Opciones avanzadas" (acordeón, cerrado por defecto):** Filtros avanzados (dropdowns por atributo), códigos de estación manuales, formato de salida (CSV/JSON/PARQUET).
- **"Ver detalle técnico" (colapsado):** el **Registro operativo** (log ~80 líneas), **velocidad (filas/s)**, **página X/Y**, **"Salida esperada"** (planes de consulta, pool de estaciones, etc.), las **8 métricas finales** y las **4 MetricCards** de la vista previa. La **tabla** de vista previa se queda en CORE.
- **Resumen configurado:** se fusiona con el nuevo resumen-primero (eliminar la duplicación).
- **Smart defaults** (para que "no tocar nada" produzca descarga válida): variable = Precipitación; temporalidad = histórico disponible; formato = CSV. (Respetar lo que venga por deep-link.)

### B · Progreso honesto

Máquina de **4 fases** con **un indicador primario por fase**, degradando con elegancia:

| Fase | Indicador primario | Microcopy (estado humano) |
|---|---|---|
| Clic | feedback <100 ms (botón disabled + spinner inline) | "Preparando tu descarga…" |
| Planear (`getFastExportPlan`, ~2.5s, total desconocido) | **spinner/skeleton** | "Consultando el servidor del IDEAM…" |
| Descargar (llega `totalPages`/`totalRows`) | **barra DETERMINADA** (`downloadedRows/totalRows` o `progressPercent`) | "Reuniendo datos · página 4 de 12" |
| Empacar (`parts`) | barra/stepper de partes | "Comprimiendo el ZIP…" |
| Listo | check verde + botón descarga | "Listo. Disponible 1 hora." |

- **Spinner solo en Planear.** En cuanto haya filas/páginas → barra determinada.
- **Animación:** relleno **ease-out**, **monótono creciente** (clamp, nunca baja), nunca clavarse en 99%. (Harrison CHI 2010: aceleración temprana reduce duración percibida ~11%.)
- **Fallback a "página N de M"** si el % se estanca (latencia variable de Socrata) — no congelar; mantener micro-actividad.
- **ETA en rango** ("~1 min restante" / "quedan ~N filas"), sesgada a sobreestimar levemente. Sustituye el countdown exacto.
- **Cierre:** estado de éxito inequívoco + **centro de descargas** persistente (`downloadHistory.ts`, ventana 1 h). Botón **Cancelar** visible en esperas largas. Doble-descarga prevenida por diseño (botón disabled).

### C · Datos curiosos durante la espera

- **Fuente de contenido:** nuevo `src/app/lib/curiosidades.ts`, **pool precargado estático** (cero latencia; funciona aunque la API tarde o falle). Dos colecciones:
  - `analogiasPrecipitacion: Curiosidad[]` (universales, verificadas).
  - `curiosidadesPorDepartamento: Record<string, Curiosidad[]>` (por DIVIPOLA/nombre; reusa claves de `lib/departamentos.ts`).
  - Tipo: `Curiosidad = { texto: string; fuente?: string; aplicaA?: VariableId[] }`.
- **Selección contextual:** según la **variable** elegida + los **departamentos** seleccionados (el estado ya existe; el parser ya es multi-depto → rotar entre ellos). Fallback a analogías genéricas.
- **Rotación:** cada **~6-8 s**, shuffle sin repetir el último; índice/seed en `useRef`, `setInterval` con cleanup en `useEffect` (NO reiniciar el ciclo en cada re-render). Solo en esperas largas.
- **Jerarquía:** **secundario** al progreso (acompaña, no reemplaza la barra). Reusa el estilo de la cajita "💡 Dato curioso" del Asistente (`bg-accent/10 border-accent/30`) + `fade-in-up`.
- **Accesibilidad:** el **estado real** va en `role="status"` `aria-live="polite"` `aria-busy`; los **tips rotatorios van `aria-hidden`** (no spamear al lector); spinner decorativo `aria-hidden`. **Anti-flash:** montar el panel solo tras ~300-500 ms y si la espera supera ~800 ms-1 s. Todo dentro de `@media (prefers-reduced-motion: reduce)` → sin crossfade, cambio directo.
- **Tono:** *divulgativo con chispa* — verificable + un guiño cultural ocasional.
- **Extra de cierre "semi-en-vivo"** (reusa números que el backend ya devuelve, sin llamadas nuevas): *"Tu descarga: X mm en el periodo ≈ Y litros por m²."* Vía util pura testeable (`mmALitros(mm, areaM2)`, `clasifIntensidad(mmPorHora)`).

**Contenido inicial verificado (semilla del pool):**
1. "1 mm de lluvia equivale a 1 litro de agua sobre cada metro cuadrado de suelo."
2. "Con 1 mm de lluvia, una cancha de fútbol recoge más de 7.000 litros de agua." (7.140 m²)
3. "Las estaciones del IDEAM miden la lluvia cada 10 minutos — por eso se pueden construir curvas IDF reales."
4. "Un aguacero fuerte (más de 7,5 mm/h, según la OMM) deja sobre cada m² un vaso de agua cada dos minutos."
5. "En Quibdó (Chocó) caen más de 8.000 mm al año, casi 10 veces lo de Bogotá." (Chocó)
6. "En Uribia (La Guajira) caen apenas ~250 mm al año, el rincón más seco de Colombia." (La Guajira)
7. "En Barranquilla pocos minutos de aguacero bastan para que los arroyos corran por las calles." (Atlántico)
8. "Bogotá tiene dos temporadas de lluvia al año (régimen bimodal): abril-mayo y octubre-noviembre." (Andina)

**Reglas de rigor (tesis):** ✔ "1 mm = 1 L/m²". ✘ "1 mm llena una piscina" (falso). ✘ no citar Lloró ~13.000 mm (no oficial, en disputa). ✘ no mezclar acumulado (mm/año) con intensidad (mm/h). Cada cifra atribuible (tooltip "fuente: IDEAM/OMM").

## 4. Anti-patrones a evitar

Spinner indeterminado en esperas >10 s cuando hay progreso real · barra que retrocede/se congela · volcar logs técnicos · countdown exacto que incumple · tips genéricos/no verificables · easing que pausa cerca del 100% · saturar el héroe con todos los indicadores a la vez · >2 niveles de disclosure · `aria-live="assertive"` · rotar tips <2-3 s.

## 5. Plan por fases (un PR, commits por fase)

- **Fase A (quick wins):** reorganizar CORE + "Opciones avanzadas" + "Ver detalle técnico"; resumen-primero en prosa; smart defaults; ETA en rango.
- **Fase B (progreso honesto):** máquina de 4 fases + barra determinada sobre datos reales; easing/clamp; fallback "página N de M"; cierre + Cancelar; feedback de clic <100 ms.
- **Fase C (datos curiosos + pulido):** `lib/curiosidades.ts` + rotador contextual accesible; util pura de equivalencias + cierre semi-en-vivo; accesibilidad completa.

## 6. Verificación

- `npm run typecheck` + `npm run build` verdes.
- Tests: util pura de equivalencias (`mmALitros`, `clasifIntensidad`); que el panel de tips **no** se monte en cargas <1 s y respete `reduced-motion`; sumar a los 89+50 tests existentes sin romperlos.
- En vivo (Chrome, no Opera): capturas claro/oscuro del flujo; estado de descarga con dato curioso rotando; verificar que deep-links y persistencia siguen intactos.
- Deploy: rama → PR → merge → auto-deploy → verificación en producción.
