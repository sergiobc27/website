# Reconciliación normativa de la calculadora (Plan 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alinear la lógica de la calculadora de caudal con las fuentes verificadas (RAS 0330 de 2017 e INVÍAS 2009), de modo que cada valor coincida literalmente con la norma que cita.

**Architecture:** Cambios en la librería de cálculo `src/app/lib/hydro/` (TDD con vitest, que ya tiene suites para `runoff`, `manning`, `tc`) y su reflejo en el componente de verificación hidráulica `SeccionManning.tsx`. Las 4 decisiones aprobadas: (1) `OBRAS_TR` literal a INVÍAS Tabla 2.8 + RAS Tabla 16; (2) llenado y/D rojo a 0,93 (RAS Art. 151); (3) autolimpieza por esfuerzo cortante τ = γ·R·S ≥ 2,0 Pa (RAS Art. 149) en vez de velocidad mínima fija; (4) velocidad máxima por velocidad (RAS Art. 150).

**Tech Stack:** TypeScript, React, vitest. Sin dependencias nuevas.

**Fuera de alcance (Planes 2 y 3):** tablas de norma visibles (`TablaNormaView`), "cálculo paso a paso", botón (i) por gráfica, registro de metodología y página `/metodologia`. Este plan NO toca esos archivos.

**Convenciones del repo:** las pruebas viven junto al módulo (`x.ts` + `x.test.ts`), framework vitest (`import { describe, it, expect } from 'vitest'`), aserciones numéricas con `toBeCloseTo`. Comandos desde `ideam-webapp/`.

---

### Task 1: `OBRAS_TR` literal a INVÍAS Tabla 2.8 + RAS Art. 135 Tabla 16

**Files:**
- Modify: `src/app/lib/hydro/runoff.ts:42-53` (bloque `OBRAS_TR`)
- Test: `src/app/lib/hydro/runoff.test.ts:32-41` (bloque `describe('OBRAS_TR'...)`)

- [ ] **Step 1: Reescribir la prueba de `OBRAS_TR` para exigir los valores literales de la norma**

Reemplazar el bloque `describe('OBRAS_TR'…)` de `runoff.test.ts` por:

```ts
describe('OBRAS_TR — selector obra → Tr (literal a la norma)', () => {
  const por = (label: string) => OBRAS_TR.find((o) => o.label === label);

  it('todas las opciones tienen Tr > 0 y cita textual', () => {
    expect(OBRAS_TR.length).toBeGreaterThan(0);
    for (const o of OBRAS_TR) {
      expect(o.tr).toBeGreaterThan(0);
      expect(typeof o.fuente).toBe('string');
      expect(o.fuente).toMatch(/INVÍAS \(2009\), Tabla 2\.8|RAS 0330 \(2017\), Art\. 135, Tabla 16/);
    }
  });

  it('valores viales literales de la Tabla 2.8 (INVÍAS)', () => {
    expect(por('Cuneta')?.tr).toBe(5);
    expect(por('Alcantarilla ≤ 0,90 m de diámetro')?.tr).toBe(10);
    expect(por('Alcantarilla > 0,90 m de diámetro')?.tr).toBe(20);
    expect(por('Puente menor (luz < 10 m)')?.tr).toBe(25);
    expect(por('Puente (luz ≥ 50 m)')?.tr).toBe(100);
  });

  it('valores urbanos literales de la Tabla 16 (RAS Art. 135)', () => {
    expect(por('Tramo inicial residencial (< 2 ha)')?.tr).toBe(3);
    expect(por('Alcantarillado pluvial (> 10 ha)')?.tr).toBe(10);
    expect(por('Canal abierto (> 1000 ha)')?.tr).toBe(100);
  });
});
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `npx vitest run src/app/lib/hydro/runoff.test.ts`
Expected: FALLA (los labels nuevos no existen aún en `OBRAS_TR`).

- [ ] **Step 3: Reemplazar `OBRAS_TR` por las entradas literales de la norma**

Sustituir el bloque actual (`runoff.ts:42-53`) por:

```ts
// Períodos de retorno de diseño, LITERALES de la norma citada. El Tr es
// sobrescribible; aquí solo se sugiere el de la fuente.
// Vial: Manual de Drenaje INVÍAS (2009), Tabla 2.8 (pág. 2-31).
// Urbano: RAS 0330 de 2017, Art. 135, Tabla 16 (por área tributaria).
export const OBRAS_TR: Array<{ label: string; tr: number; fuente: string }> = [
  // Drenaje vial — INVÍAS (2009), Tabla 2.8
  { label: 'Cuneta', tr: 5, fuente: 'INVÍAS (2009), Tabla 2.8' },
  { label: 'Zanja de coronación', tr: 10, fuente: 'INVÍAS (2009), Tabla 2.8' },
  { label: 'Estructura de caída', tr: 10, fuente: 'INVÍAS (2009), Tabla 2.8' },
  { label: 'Alcantarilla ≤ 0,90 m de diámetro', tr: 10, fuente: 'INVÍAS (2009), Tabla 2.8' },
  { label: 'Alcantarilla > 0,90 m de diámetro', tr: 20, fuente: 'INVÍAS (2009), Tabla 2.8' },
  { label: 'Puente menor (luz < 10 m)', tr: 25, fuente: 'INVÍAS (2009), Tabla 2.8' },
  { label: 'Puente (luz 10–50 m)', tr: 50, fuente: 'INVÍAS (2009), Tabla 2.8' },
  { label: 'Puente (luz ≥ 50 m)', tr: 100, fuente: 'INVÍAS (2009), Tabla 2.8' },
  { label: 'Drenaje subsuperficial', tr: 2, fuente: 'INVÍAS (2009), Tabla 2.8' },
  // Drenaje urbano — RAS 0330 (2017), Art. 135, Tabla 16
  { label: 'Tramo inicial residencial (< 2 ha)', tr: 3, fuente: 'RAS 0330 (2017), Art. 135, Tabla 16' },
  { label: 'Tramo inicial comercial/industrial (< 2 ha)', tr: 5, fuente: 'RAS 0330 (2017), Art. 135, Tabla 16' },
  { label: 'Alcantarillado pluvial (2–10 ha)', tr: 5, fuente: 'RAS 0330 (2017), Art. 135, Tabla 16' },
  { label: 'Alcantarillado pluvial (> 10 ha)', tr: 10, fuente: 'RAS 0330 (2017), Art. 135, Tabla 16' },
  { label: 'Canal abierto (< 1000 ha)', tr: 50, fuente: 'RAS 0330 (2017), Art. 135, Tabla 16' },
  { label: 'Canal abierto (> 1000 ha)', tr: 100, fuente: 'RAS 0330 (2017), Art. 135, Tabla 16' },
];
```

- [ ] **Step 4: Correr la prueba y verla pasar**

Run: `npx vitest run src/app/lib/hydro/runoff.test.ts`
Expected: PASA.

- [ ] **Step 5: Commit**

```bash
git add src/app/lib/hydro/runoff.ts src/app/lib/hydro/runoff.test.ts
git commit -m "fix(calc): Tr de diseño literal a INVÍAS Tabla 2.8 y RAS Art. 135 Tabla 16"
```

---

### Task 2: Esfuerzo cortante de autolimpieza (RAS Art. 149)

**Files:**
- Modify: `src/app/lib/hydro/manning.ts` (añadir al final, antes de los chequeos existentes)
- Test: `src/app/lib/hydro/manning.test.ts` (añadir bloque)

- [ ] **Step 1: Escribir la prueba del esfuerzo cortante y su chequeo**

Añadir a `manning.test.ts` (e incluir los nuevos símbolos en el `import` desde `./manning`: `esfuerzoCortante`, `chequeoCortante`, `TAU_MIN_AUTOLIMPIEZA`):

```ts
describe('esfuerzoCortante τ = γ·R·S (RAS 0330, Art. 149)', () => {
  it('τ = 9810·R·S; R=0,125 m, S=0,01 → 12,26 Pa', () => {
    expect(esfuerzoCortante(0.125, 0.01)).toBeCloseTo(12.2625, 3);
  });
  it('devuelve 0 con entradas no válidas', () => {
    expect(esfuerzoCortante(0, 0.01)).toBe(0);
    expect(esfuerzoCortante(0.1, 0)).toBe(0);
  });
});

describe('chequeoCortante (autolimpieza por cortante, RAS Art. 149)', () => {
  it('verde si τ ≥ 2,0 Pa con margen', () => {
    expect(chequeoCortante(12.26, TAU_MIN_AUTOLIMPIEZA).estado).toBe('verde');
  });
  it('rojo si τ < 2,0 Pa', () => {
    expect(chequeoCortante(1.5, TAU_MIN_AUTOLIMPIEZA).estado).toBe('rojo');
  });
  it('amarillo si está apenas por encima del mínimo', () => {
    expect(chequeoCortante(2.1, TAU_MIN_AUTOLIMPIEZA).estado).toBe('amarillo');
  });
});
```

- [ ] **Step 2: Correr y verla fallar**

Run: `npx vitest run src/app/lib/hydro/manning.test.ts`
Expected: FALLA (símbolos no exportados).

- [ ] **Step 3: Implementar τ, el mínimo y el chequeo en `manning.ts`**

Añadir en `manning.ts` (junto a las demás constantes/funciones; p. ej. tras `V_MIN_AUTOLIMPIEZA`):

```ts
// Peso específico del agua [N/m³] para el esfuerzo cortante de pared.
const GAMMA_AGUA = 9810;

// Esfuerzo cortante medio de pared τ = γ·R·S [Pa]. R = radio hidráulico, S en m/m.
export function esfuerzoCortante(r: number, s: number): number {
  if (!(r > 0) || !(s > 0)) return 0;
  return GAMMA_AGUA * r * s;
}

// RAS 0330 (2017), Art. 149: la velocidad mínima en alcantarillado pluvial/combinado
// es la que genera un esfuerzo cortante de pared ≥ 2,0 Pa (criterio de autolimpieza).
export const TAU_MIN_AUTOLIMPIEZA = 2.0; // Pa

// Chequeo de autolimpieza por esfuerzo cortante (sustituye al de velocidad mínima fija).
export function chequeoCortante(tau: number, tauMin: number): { estado: Estado; motivo: string } {
  if (tau < tauMin) return { estado: 'rojo', motivo: `τ = ${tau.toFixed(2)} Pa < ${tauMin} Pa: no autolimpiante (RAS 0330, Art. 149).` };
  if (tau < tauMin * 1.15) return { estado: 'amarillo', motivo: `τ = ${tau.toFixed(2)} Pa: apenas sobre el mínimo de autolimpieza (${tauMin} Pa, RAS Art. 149).` };
  return { estado: 'verde', motivo: `τ = ${tau.toFixed(2)} Pa ≥ ${tauMin} Pa: autolimpiante (RAS 0330, Art. 149).` };
}
```

- [ ] **Step 4: Correr y verla pasar**

Run: `npx vitest run src/app/lib/hydro/manning.test.ts`
Expected: PASA.

- [ ] **Step 5: Commit**

```bash
git add src/app/lib/hydro/manning.ts src/app/lib/hydro/manning.test.ts
git commit -m "feat(calc): chequeo de autolimpieza por esfuerzo cortante (RAS 0330 Art. 149)"
```

---

### Task 3: El solver devuelve el radio hidráulico R (para τ)

**Files:**
- Modify: `src/app/lib/hydro/manning.ts:35-44` (interface `SolverResultado`), `:48-71` (`profundidadNormalCircular`), `:75-104` (`profundidadNormalTrapecio`)
- Test: `src/app/lib/hydro/manning.test.ts` (ampliar los `describe` del solver)

- [ ] **Step 1: Ampliar las pruebas del solver para exigir `r`**

En `manning.test.ts`, dentro de `describe('profundidadNormalCircular'…)` añadir:

```ts
  it('reporta el radio hidráulico R ≈ 0,125 m a media sección', () => {
    const r = profundidadNormalCircular(0.1888, 0.5, 0.013, 0.01);
    expect(r.r).toBeCloseTo(0.125, 2);
  });
```

Y dentro de `describe('profundidadNormalTrapecio'…)` añadir:

```ts
  it('reporta el radio hidráulico R = A/P (b=1, y=0,5 → R ≈ 0,25)', () => {
    const r = profundidadNormalTrapecio(1.5263, 1, 0, 0.013, 0.01);
    // A=(1)·0,5=0,5; P=1+2·0,5=2 → R=0,25
    expect(r.r).toBeCloseTo(0.25, 2);
  });
```

- [ ] **Step 2: Correr y verla fallar**

Run: `npx vitest run src/app/lib/hydro/manning.test.ts`
Expected: FALLA (`r` no existe en el resultado).

- [ ] **Step 3: Añadir `r` a la interfaz y a ambos solvers**

En la interfaz `SolverResultado` (manning.ts:35-44) añadir el campo:

```ts
  /** Radio hidráulico R = A/P a la profundidad de diseño [m]. */
  r: number;
```

En `profundidadNormalCircular`, en cada `return` calcular y devolver `r`:

```ts
  if (!(Qd > 0)) return { llenado: 0, y: 0, v: 0, r: 0, excedeCapacidad: false };
  if (Qd >= qMax) {
    const { area, perim } = geomCircular(D, F_MAX);
    return { llenado: F_MAX, y: F_MAX * D, v: area > 0 ? qMax / area : 0, r: perim > 0 ? area / perim : 0, excedeCapacidad: true };
  }
  // …tras la bisección:
  const f = (lo + hi) / 2;
  const { area, perim } = geomCircular(D, f);
  return { llenado: f, y: f * D, v: area > 0 ? Qd / area : 0, r: perim > 0 ? area / perim : 0, excedeCapacidad: false };
```

(Nota: cambiar la desestructuración final de `geomCircular(D, f)` para tomar también `perim`.)

En `profundidadNormalTrapecio`, cambiar el tipo de retorno a incluir `r: number` y devolverlo:

```ts
): { y: number; v: number; r: number; excedeCapacidad: boolean } {
  // …
  if (!(Qd > 0)) return { y: 0, v: 0, r: 0, excedeCapacidad: false };
  // …guardia de capacidad:
  if (qAt(hi) < Qd) return { y: hi, v: 0, r: 0, excedeCapacidad: true };
  // …tras la bisección:
  const y = (lo + hi) / 2;
  const area = (b + z * y) * y;
  const perim = b + 2 * y * Math.sqrt(1 + z * z);
  return { y, v: area > 0 ? Qd / area : 0, r: perim > 0 ? area / perim : 0, excedeCapacidad: false };
}
```

- [ ] **Step 4: Correr y verla pasar**

Run: `npx vitest run src/app/lib/hydro/manning.test.ts`
Expected: PASA.

- [ ] **Step 5: Commit**

```bash
git add src/app/lib/hydro/manning.ts src/app/lib/hydro/manning.test.ts
git commit -m "feat(calc): el solver de Manning reporta el radio hidráulico R"
```

---

### Task 4: Llenado y/D rojo a 0,93 (RAS Art. 151)

**Files:**
- Modify: `src/app/lib/hydro/manning.ts:135-140` (`chequeoLlenado`)
- Test: `src/app/lib/hydro/manning.test.ts` (añadir bloque)

- [ ] **Step 1: Escribir la prueba del nuevo umbral**

Añadir a `manning.test.ts` (incluir `chequeoLlenado` en el `import`):

```ts
describe('chequeoLlenado (RAS 0330, Art. 151: máx 93% en pluvial)', () => {
  it('rojo si y/D > 0,93', () => {
    expect(chequeoLlenado(0.95).estado).toBe('rojo');
  });
  it('amarillo entre 0,85 y 0,93', () => {
    expect(chequeoLlenado(0.90).estado).toBe('amarillo');
  });
  it('verde por debajo de 0,85', () => {
    expect(chequeoLlenado(0.70).estado).toBe('verde');
  });
});
```

- [ ] **Step 2: Correr y verla fallar**

Run: `npx vitest run src/app/lib/hydro/manning.test.ts`
Expected: FALLA (hoy el rojo es a 0,85, así que `chequeoLlenado(0.90)` da rojo, no amarillo).

- [ ] **Step 3: Cambiar los umbrales y la cita en `chequeoLlenado`**

Reemplazar el cuerpo de `chequeoLlenado` (manning.ts:135-140) por:

```ts
// Chequeo de llenado (sección circular): RAS 0330 (2017), Art. 151, limita la
// profundidad de flujo al 93% del diámetro en alcantarillado pluvial/combinado.
export function chequeoLlenado(llenado: number): { estado: Estado; motivo: string } {
  if (llenado > 0.93) return { estado: 'rojo', motivo: `Llenado y/D = ${(llenado * 100).toFixed(0)}% > 93% (RAS 0330, Art. 151): revisar diámetro.` };
  if (llenado > 0.85) return { estado: 'amarillo', motivo: `Llenado y/D = ${(llenado * 100).toFixed(0)}%: acercándose al máximo del 93% (RAS Art. 151).` };
  return { estado: 'verde', motivo: `Llenado y/D = ${(llenado * 100).toFixed(0)}% (≤ 93%, RAS 0330 Art. 151).` };
}
```

- [ ] **Step 4: Correr y verla pasar**

Run: `npx vitest run src/app/lib/hydro/manning.test.ts`
Expected: PASA.

- [ ] **Step 5: Commit**

```bash
git add src/app/lib/hydro/manning.ts src/app/lib/hydro/manning.test.ts
git commit -m "fix(calc): llenado máximo y/D = 93% (RAS 0330 Art. 151) y arregla inconsistencia con el solver (F_MAX=0,93)"
```

---

### Task 5: Chequeo de velocidad máxima por erosión (RAS Art. 150)

**Files:**
- Modify: `src/app/lib/hydro/manning.ts:121-126` (añadir `chequeoVelocidadMax` junto a `chequeoVelocidad`)
- Test: `src/app/lib/hydro/manning.test.ts` (añadir bloque)

- [ ] **Step 1: Escribir la prueba de la velocidad máxima (solo erosión)**

Añadir a `manning.test.ts` (incluir `chequeoVelocidadMax` en el `import`):

```ts
describe('chequeoVelocidadMax (erosión, RAS 0330 Art. 150)', () => {
  it('verde por debajo de la máxima', () => {
    expect(chequeoVelocidadMax(3, 5).estado).toBe('verde');
  });
  it('amarillo al acercarse a la máxima (>90%)', () => {
    expect(chequeoVelocidadMax(4.8, 5).estado).toBe('amarillo');
  });
  it('rojo sobre la máxima del material', () => {
    expect(chequeoVelocidadMax(6, 5).estado).toBe('rojo');
  });
});
```

- [ ] **Step 2: Correr y verla fallar**

Run: `npx vitest run src/app/lib/hydro/manning.test.ts`
Expected: FALLA (`chequeoVelocidadMax` no existe).

- [ ] **Step 3: Implementar `chequeoVelocidadMax`**

Añadir en `manning.ts` (junto a `chequeoVelocidad`):

```ts
// Chequeo de erosión: solo el techo de velocidad (la autolimpieza va por cortante).
// RAS 0330 (2017), Art. 150: velocidad máxima 5,0 m/s (10 m/s con revestimiento).
export function chequeoVelocidadMax(v: number, vMax: number): { estado: Estado; motivo: string } {
  if (v > vMax) return { estado: 'rojo', motivo: `v = ${v.toFixed(2)} m/s > ${vMax} m/s: riesgo de erosión del material (RAS 0330, Art. 150).` };
  if (v > vMax * 0.9) return { estado: 'amarillo', motivo: `v = ${v.toFixed(2)} m/s: cerca del máximo (${vMax} m/s, RAS Art. 150).` };
  return { estado: 'verde', motivo: `v = ${v.toFixed(2)} m/s ≤ ${vMax} m/s (RAS 0330, Art. 150).` };
}
```

- [ ] **Step 4: Correr y verla pasar**

Run: `npx vitest run src/app/lib/hydro/manning.test.ts`
Expected: PASA.

- [ ] **Step 5: Commit**

```bash
git add src/app/lib/hydro/manning.ts src/app/lib/hydro/manning.test.ts
git commit -m "feat(calc): chequeo de velocidad máxima por erosión (RAS 0330 Art. 150)"
```

---

### Task 6: Reconectar `SeccionManning` (cortante + llenado 93% + velocidad máx)

**Files:**
- Modify: `src/app/components/calculadora/SeccionManning.tsx` (imports, estado, `res`, render)

- [ ] **Step 1: Cambiar imports y el estado del mínimo**

En `SeccionManning.tsx`, en el import desde `'../../lib/hydro/manning'` quitar `V_MIN_AUTOLIMPIEZA`, `chequeoVelocidad` y añadir `esfuerzoCortante`, `chequeoCortante`, `chequeoVelocidadMax`, `TAU_MIN_AUTOLIMPIEZA`. Queda:

```tsx
import {
  MATERIALES,
  TAU_MIN_AUTOLIMPIEZA,
  capacidadCircular,
  profundidadNormalCircular,
  profundidadNormalTrapecio,
  esfuerzoCortante,
  chequeoCortante,
  chequeoVelocidadMax,
  chequeoSuficiencia,
  chequeoLlenado,
} from '../../lib/hydro/manning';
```

Reemplazar el estado `vMin` por `tauMin`:

```tsx
  const [tauMin, setTauMin] = useState(String(TAU_MIN_AUTOLIMPIEZA));
```

(eliminar la línea `const [vMin, setVMin] = useState(String(V_MIN_AUTOLIMPIEZA));`)

- [ ] **Step 2: Actualizar el cálculo `res` para usar cortante y velocidad máx**

Reemplazar el `useMemo` de `res` por:

```tsx
  const res = useMemo(() => {
    const n = parseFloat(nMann);
    const s = parseFloat(sCond) / 100; // % → m/m
    const tmin = parseFloat(tauMin);
    const vmax = parseFloat(vMax);
    if (!(q > 0) || !(n > 0) || !(s > 0)) return null;

    if (seccion === 'circular') {
      const D = parseFloat(diametro);
      if (!(D > 0)) return null;
      const cap = capacidadCircular(D, n, s);
      const sol = profundidadNormalCircular(q, D, n, s);
      const tau = esfuerzoCortante(sol.r, s);
      return {
        tipo: 'circular' as const,
        cap,
        sol,
        tau,
        chequeos: [
          chequeoSuficiencia(q, cap.q),
          chequeoLlenado(sol.llenado),
          chequeoCortante(tau, tmin),
          chequeoVelocidadMax(sol.v, vmax),
        ],
      };
    }
    const b = parseFloat(base);
    const z = parseFloat(talud);
    if (!(b > 0) || !(z >= 0)) return null;
    const sol = profundidadNormalTrapecio(q, b, z, n, s);
    const tau = esfuerzoCortante(sol.r, s);
    return {
      tipo: 'trapezoidal' as const,
      sol,
      tau,
      chequeos: [chequeoCortante(tau, tmin), chequeoVelocidadMax(sol.v, vmax)],
    };
  }, [q, seccion, diametro, base, talud, nMann, sCond, tauMin, vMax]);
```

- [ ] **Step 3: Cambiar el input de "Vel. mín. autolimpieza" por "Esfuerzo cortante mín."**

Reemplazar el `<Field label="Vel. mín. autolimpieza (m/s)" …>` por:

```tsx
        <Field label="Esfuerzo cortante mín. τ (Pa)" help="Criterio de autolimpieza del RAS 0330 (2017), Art. 149: la velocidad mínima en alcantarillado pluvial es la que genera un esfuerzo cortante de pared ≥ 2,0 Pa. τ = γ·R·S.">
          <NumberInput value={tauMin} onChange={setTauMin} step="0.5" />
        </Field>
```

Y en el `<Field label="Vel. máx. material (m/s)" …>` actualizar el `help` para citar el Art. 150:

```tsx
        <Field label="Vel. máx. material (m/s)" help="Velocidad máxima para no erosionar el material. RAS 0330 (2017), Art. 150: 5,0 m/s (hasta 10 m/s con revestimiento especial).">
          <NumberInput value={vMax} onChange={setVMax} step="0.5" />
        </Field>
```

- [ ] **Step 4: Mostrar τ en las tarjetas de resultado**

En el bloque `res.tipo === 'circular'` añadir una tarjeta de τ tras la velocidad:

```tsx
                <Resultado titulo="Velocidad (a Q diseño)" valor={fmt(res.sol.v, 2)} unidad="m/s" />
                <Resultado titulo="Esfuerzo cortante τ" valor={fmt(res.tau, 2)} unidad="Pa" />
```

Y en el bloque `res.tipo === 'trapezoidal'` igualmente tras la velocidad:

```tsx
                <Resultado titulo="Velocidad (a Q diseño)" valor={fmt(res.sol.v, 2)} unidad="m/s" />
                <Resultado titulo="Esfuerzo cortante τ" valor={fmt(res.tau, 2)} unidad="Pa" />
```

- [ ] **Step 5: Actualizar la nota al pie de la fórmula de Manning**

Reemplazar el `<p>` que hoy dice "Manning (1891) · R = A/P … RAS 0330 (2017); valores de n y velocidad máxima editables…" por:

```tsx
      <p className="text-xs text-muted-foreground">
        Manning (1891) · R = A/P (radio hidráulico). Autolimpieza por esfuerzo cortante τ = γ·R·S ≥ 2,0 Pa
        (RAS 0330, Art. 149); velocidad máxima 5,0 m/s (Art. 150); llenado máximo y/D = 93% (Art. 151). Valores
        de n, τ mínimo y velocidad máxima editables; confírmalos con la norma vigente.
      </p>
```

- [ ] **Step 6: Verificar tipos y build**

Run: `npx tsc --noEmit`
Expected: sin errores (ya no se referencia `vMin`/`V_MIN_AUTOLIMPIEZA`/`chequeoVelocidad`).

- [ ] **Step 7: Commit**

```bash
git add src/app/components/calculadora/SeccionManning.tsx
git commit -m "feat(calc): verificación hidráulica por esfuerzo cortante (Art. 149), llenado 93% (Art. 151) y velocidad máx (Art. 150)"
```

---

### Task 7: Actualizar la cita del piso de Tc y de la sección "Método y referencias"

**Files:**
- Modify: `src/app/lib/hydro/tc.ts:6` (comentario del piso) y `src/app/components/calculadora/SeccionTc.tsx:88` (texto del aviso de piso)
- Modify: `src/app/components/CalculadoraCaudal.tsx:169` (línea de validez del racional)

- [ ] **Step 1: Precisar la cita del piso de Tc (RAS Art. 135, num. 4: 3–10 min)**

En `SeccionTc.tsx`, en el aviso de `pisoAplicado`, cambiar el texto a:

```tsx
          <span>La mediana cae por debajo de 10 min; se aplica el piso de diseño de 10 min (extremo del rango de 3 a 10 min del RAS 0330, Art. 135, num. 4) para evitar intensidades irreales.</span>
```

Y en `tc.ts:6` ajustar el comentario:

```ts
const MIN_DISENO = 10; // Piso de diseño: extremo del rango 3–10 min del RAS 0330 (Art. 135, num. 4).
```

- [ ] **Step 2: Precisar la línea de validez del método racional**

En `CalculadoraCaudal.tsx`, la línea de validez del racional, cambiar la cita a artículo:

```tsx
            <p>· Validez del método racional: área &lt; 80 ha (RAS 0330/2017, Art. 135) y A ≤ 2,5 km² (Manual de Drenaje INVÍAS 2009, sección 2.5.5.1). C según la cobertura real del área aportante.</p>
```

- [ ] **Step 3: Verificar build y correr toda la suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: typecheck OK; todas las pruebas PASAN (las ~110 previas + las nuevas de `manning`/`runoff`).

- [ ] **Step 4: Commit**

```bash
git add src/app/lib/hydro/tc.ts src/app/components/calculadora/SeccionTc.tsx src/app/components/CalculadoraCaudal.tsx
git commit -m "docs(calc): citar el piso de Tc (RAS Art. 135 num. 4) y la validez del racional (RAS Art. 135 / INVÍAS 2.5.5.1)"
```

---

## Verificación final

- [ ] `npx vitest run` — toda la suite en verde.
- [ ] `npx tsc --noEmit` — sin errores de tipo.
- [ ] `npm run build` — compila.
- [ ] Revisar a ojo en `SeccionManning`: el selector ya no muestra "Vel. mín."; aparece "Esfuerzo cortante mín. τ (Pa)" y la tarjeta de τ; el llenado marca rojo solo por encima de 93%.
