# Diseño: "cómo se consigue" cada variable de una fórmula

Fecha: 2026-07-01
Repo: `ideam-webapp` (frontend, despliega el Worker `ideam`)
Estado: aprobado por el autor (brainstorming). Interacción = desplegable por variable; alcance = registro + calculadora.

## 1. Problema

Hoy cada fórmula lleva su lista "Dónde: símbolo = qué es" (`VariablesLista`, campo `variables` del
registro `metodologia/contenido.tsx`). Pero saber QUÉ es una variable no dice CÓMO se consigue su valor:
de dónde se toma, dónde se mide, de qué depende, o si la calcula la propia app. Objetivo: que cualquier
persona, además de entender cada letra, sepa cómo obtener su valor.

## 2. Decisiones (aprobadas)

1. **Interacción:** desplegable por variable. Cada variable con "cómo se consigue" es una fila clicable
   (con chevrón); al hacer click se despliega el texto justo debajo (acordeón animado, accesible,
   respeta reduce-motion). Sin popovers anidados, así funciona igual inline (Metodología, calculadora)
   y dentro del popup (i). Las variables sin ese dato se ven como hoy, sin chevrón.
2. **Alcance:** registro + calculadora. El contenido se escribe UNA vez en el registro; se muestra en
   Metodología y en los (i) de todas las gráficas (ya usan `VariablesLista`) y, además, en las
   secciones de la calculadora que muestran fórmula/variables.

## 3. Modelo de datos

Campo opcional en `Variable` (`metodologia/contenido.tsx`):

```ts
export interface Variable {
  simbolo: ReactNode;
  definicion: string;
  comoSeObtiene?: string; // de dónde se toma / dónde se mide / de qué depende / si la calcula la app
}
```

Solo lo llevan las variables cuyo valor de verdad "se consigue". Constantes/operadores (360, ln) no.

Helper nuevo `variablesDe(id): Variable[]` para que la calculadora reutilice las variables del registro
sin duplicar contenido.

## 4. UI: `VariablesLista`

Se reestructura a filas (div/span, no `dl/dt/dd`, para poder envolver la fila clicable en un `<button>`
válido). Cada fila:
- Sin `comoSeObtiene`: igual que hoy (símbolo = definición).
- Con `comoSeObtiene`: `<button aria-expanded>` con símbolo = definición + chevrón; debajo, panel
  animado (`motion`, height/opacity, `usePrefersReducedMotion` → sin animación si aplica) con
  "Cómo se consigue: …".

## 5. Cobertura concreta

- **Metodología + (i) de gráficas:** automático (ya renderizan `VariablesLista`).
- **Calculadora:** `SeccionManning` (variables de `manning`), `SeccionTc` (de `tiempo-concentracion`),
  `SeccionCoefC` (de `factor-cf`: C, Cf, C de diseño) renderizan `VariablesLista` bajo su fórmula/nota.

## 6. Contenido (resumen del "cómo se consigue")

- **Se miden/consultan:** A (delimitar la cuenca en plano/SIG/IGAC, en ha), L (medir sobre el cauce
  principal), S (Δcotas ÷ longitud, de curvas de nivel o DEM), C (tabla INVÍAS 2.9/2.10 por superficie;
  en la calculadora se elige por superficie), n (tabla por material del conducto, valores de Chow).
- **Se leen de gráfica/norma:** I (de la IDF para Tr y duración = Tc), T/Tr (por tipo de obra según la
  tabla de la norma), D (duración = Tc para diseño).
- **Las calcula la app:** Tc (Kirpich/Témez/Giandotti desde L y S), μ y β (L-momentos de la serie de
  máximos anuales), K/m/n IDF (regresión/regionalización), C de diseño (C·Cf con tope 1), Cf (según Tr),
  R y A de Manning (geometría), P̄ (promedio de la serie).
- **Constantes/operadores:** 360, ln → sin "cómo se consigue".

## 7. Verificación

typecheck + pruebas existentes + revisión en el dev server (desplegar/plegar, reduce-motion, que
aparezca en Metodología, (i) y calculadora). Sin cambios de fórmula ni de cálculo.

## 8. No-objetivos (YAGNI)

- No ayudas (i) por cada campo de entrada de la calculadora (más disperso; la lista de variables de la
  fórmula es el sitio consistente). Posible mejora futura.
- No tocar la matemática ni las fuentes.
