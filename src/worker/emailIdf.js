// Correo con el que se envían las curvas IDF: asunto, cuerpo HTML y su
// alternativa en texto plano. Vive aparte de index.js porque es presentación,
// no plomería, y porque el HTML de correo tiene reglas propias:
//
//  - Maquetación con <table> e inline styles. Nada de flex, grid ni <style>:
//    Outlook y Gmail los descartan.
//  - Los logos se cargan por URL absoluta del propio sitio, y el diseño se
//    sostiene si el cliente bloquea imágenes (texto alternativo + banda de color).
//  - Preheader oculto: es la línea que la bandeja muestra junto al asunto, así
//    que dice algo útil en vez de "Hola,".
//  - Siempre se manda también texto plano (Resend: campo `text`), que mejora la
//    entregabilidad y salva a los clientes que no pintan HTML.
//
// Regla editorial del proyecto: el texto visible NO lleva raya larga.

const SITIO = "https://ideam.sergiobc.com";

// Outlook y Gmail bloquean imágenes por defecto. Dando tipografía y color al
// propio <img>, el texto alternativo se pinta como una marca sobria en vez de
// como texto suelto junto a un icono de imagen rota.
const ALT_ESTILO = "font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#A3161A;text-align:center";

// Los nombres de estación vienen del catálogo, pero el correo sale desde un
// dominio verificado: se escapa igual para que nada pueda inyectar marcado.
function escHtml(v) {
  return String(v).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function fmt(v, decimals = 1) {
  if (typeof v !== "number" || !isFinite(v)) return "-";
  const [ent, dec] = Math.abs(v).toFixed(decimals).split(".");
  const int = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (v < 0 ? "-" : "") + (dec ? `${int},${dec}` : int);
}

// Elige de la lista disponible los valores más cercanos a los `preferidos`, sin
// repetir. Sirve para armar un extracto legible en el correo (una tabla de 9x6
// no cabe en la pantalla de un teléfono).
function elegirCercanos(disponibles, preferidos, cuantos) {
  const libres = [...disponibles].sort((a, b) => a - b);
  const salida = [];
  for (const objetivo of preferidos) {
    if (salida.length >= cuantos || !libres.length) break;
    let mejor = libres[0];
    for (const v of libres) {
      if (Math.abs(v - objetivo) < Math.abs(mejor - objetivo)) mejor = v;
    }
    salida.push(mejor);
    libres.splice(libres.indexOf(mejor), 1);
  }
  return salida.sort((a, b) => a - b);
}

// Extracto de la tabla: las duraciones y períodos de retorno más usados en
// diseño de drenaje, con la intensidad de cada cruce.
export function extractoTabla(idf) {
  const porDur = new Map();
  for (const curva of idf.curves || []) {
    for (const p of curva.points || []) {
      if (!(p.intensityMmH > 0)) continue;
      const fila = porDur.get(p.durMin) || {};
      fila[curva.returnPeriod] = p.intensityMmH;
      porDur.set(p.durMin, fila);
    }
  }
  const durs = elegirCercanos([...porDur.keys()], [10, 30, 60, 120], 4);
  const trs = elegirCercanos(idf.returnPeriods || [], [10, 25, 100], 3);
  return {
    trs,
    filas: durs.map((d) => ({ dur: d, vals: trs.map((tr) => porDur.get(d)?.[tr]) })),
  };
}

// Asunto sin raya larga (regla del proyecto) y con lo importante al principio,
// que es lo único que se ve en la bandeja de un teléfono.
export function asuntoIdf(station) {
  return `Curvas IDF de ${station.nombre}`;
}

// Primer aviso del cálculo, si lo hay: el correo no debe ocultar que una curva
// es de baja confianza.
function primerAviso(idf) {
  return (idf.warnings || []).find((w) => typeof w === "string" && w.trim()) || null;
}

function enlaceEstacion(station) {
  return `${SITIO}/hydro?est=${encodeURIComponent(station.codigo)}`;
}

export function emailIdfHtml(station, idf, filename) {
  const { trs, filas } = extractoTabla(idf);
  const eq = idf.equation || {};
  const aviso = primerAviso(idf);
  const nYears = idf.nYears;
  const anios = `${nYears} ${nYears === 1 ? "año" : "años"} de registro`;
  const preheader = `${station.municipio}: ${anios}, períodos de retorno de ${(idf.returnPeriods || [])[0]} a ${
    (idf.returnPeriods || [])[(idf.returnPeriods || []).length - 1]
  } años. El PDF va adjunto.`;

  const th = (t, alinea = "right") =>
    `<th align="${alinea}" style="padding:8px 10px;font-size:11px;color:#ffffff;font-weight:bold">${escHtml(t)}</th>`;
  const filasHtml = filas
    .map((f, i) => {
      const fondo = i % 2 === 1 ? ";background:#faf7ee" : "";
      const borde = i < filas.length - 1 ? ";border-bottom:1px solid #eeeeee" : "";
      const celdas = f.vals
        .map((v) => `<td align="right" style="padding:7px 10px;font-size:12px;color:#1a1a1a${borde}">${fmt(v, 1)}</td>`)
        .join("");
      return `<tr style="${fondo.slice(1)}"><td style="padding:7px 10px;font-size:12px;color:#1a1a1a;font-weight:bold${borde}">${f.dur} min</td>${celdas}</tr>`;
    })
    .join("");

  const sup = (v) => `<span style="font-size:10px;vertical-align:super">${escHtml(v)}</span>`;

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(asuntoIdf(station))}</title></head>
<body style="margin:0;padding:0;background:#eceaea;-webkit-font-smoothing:antialiased">
<div style="display:none;font-size:1px;color:#eceaea;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${escHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eceaea"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden">

  <tr><td style="background:#A3161A;padding:18px 24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="120" valign="middle">
        <table role="presentation" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:6px"><tr>
          <td style="padding:6px 8px"><img src="${SITIO}/email/logo-cuc.png" width="54" height="42" alt="CUC" style="display:block;border:0;${ALT_ESTILO}"></td>
          <td style="padding:6px 8px 6px 0"><img src="${SITIO}/email/logo-ideam.png" width="39" height="38" alt="IDEAM" style="display:block;border:0;${ALT_ESTILO}"></td>
        </tr></table>
      </td>
      <td valign="middle" align="right" style="font-family:Arial,Helvetica,sans-serif;color:#ffffff">
        <div style="font-size:19px;font-weight:bold">Curvas IDF</div>
        <div style="font-size:11px;color:#f3d7d8">Intensidad &middot; Duración &middot; Frecuencia</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="height:4px;background:#C9A227;font-size:0;line-height:0">&nbsp;</td></tr>

  <tr><td style="padding:26px 24px 6px;font-family:Arial,Helvetica,sans-serif">
    <div style="font-size:21px;font-weight:bold;color:#1a1a1a;line-height:1.25">Tus curvas IDF están listas</div>
    <div style="font-size:14px;color:#595959;line-height:1.55;padding-top:8px">Las calculamos con los datos abiertos del IDEAM para la estación que pediste. El informe completo va adjunto en PDF.</div>
  </td></tr>

  <tr><td style="padding:18px 24px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7ee;border:1px solid #eee6cf;border-radius:10px">
      <tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif">
        <div style="font-size:10px;font-weight:bold;color:#8a6d1b;letter-spacing:.8px">ESTACIÓN</div>
        <div style="font-size:16px;font-weight:bold;color:#1a1a1a;padding-top:3px">${escHtml(station.nombre)}</div>
        <div style="font-size:13px;color:#595959;padding-top:2px">${escHtml(station.municipio)}, ${escHtml(station.departamento)} &middot; código ${escHtml(station.codigo)}</div>
        <div style="font-size:12px;color:#7a7a7a;padding-top:8px">${escHtml(anios)} &middot; datos cada 10 minutos &middot; ${(idf.durations || []).length} duraciones &middot; ${(idf.returnPeriods || []).length} períodos de retorno</div>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:16px 24px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e6e6;border-radius:10px">
      <tr>
        <td width="42" align="center" valign="middle" style="padding:12px 0 12px 12px">
          <table role="presentation" cellpadding="0" cellspacing="0" style="background:#A3161A;border-radius:6px"><tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;padding:7px 6px">PDF</td></tr></table>
        </td>
        <td valign="middle" style="padding:12px 14px;font-family:Arial,Helvetica,sans-serif">
          <div style="font-size:13px;font-weight:bold;color:#1a1a1a">${escHtml(filename)}</div>
          <div style="font-size:11px;color:#7a7a7a;padding-top:2px">Gráfica, ecuación ajustada y tabla completa &middot; 1 página</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 24px 0;font-family:Arial,Helvetica,sans-serif">
    <div style="font-size:11px;font-weight:bold;color:#8a6d1b;letter-spacing:.8px">EXTRACTO DE LA TABLA</div>
    <div style="font-size:12px;color:#7a7a7a;padding:4px 0 10px">Intensidad de diseño en mm/h. En el PDF están las ${(idf.durations || []).length} duraciones y los ${(idf.returnPeriods || []).length} períodos de retorno.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif">
      <tr style="background:#A3161A">${th("Duración", "left")}${trs.map((tr) => th(`Tr ${tr} años`)).join("")}</tr>
      ${filasHtml}
    </table>
  </td></tr>

  <tr><td style="padding:22px 24px 0;font-family:Arial,Helvetica,sans-serif">
    <div style="font-size:11px;font-weight:bold;color:#8a6d1b;letter-spacing:.8px">ECUACIÓN AJUSTADA</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="padding-top:8px"><tr>
      <td valign="middle" style="font-family:Georgia,'Times New Roman',serif;font-size:17px;font-style:italic;color:#1a1a1a;padding-right:8px">I&nbsp;=</td>
      <td valign="middle" align="center" style="font-family:Georgia,'Times New Roman',serif;color:#1a1a1a">
        <div style="font-size:15px;font-style:italic;padding:0 8px 3px">${fmt(eq.K, 1)} &middot; T${sup(fmt(eq.m, 3))}</div>
        <div style="border-top:1.5px solid #1a1a1a;font-size:0;line-height:0">&nbsp;</div>
        <div style="font-size:15px;font-style:italic;padding:3px 8px 0">D${sup(fmt(eq.n, 3))}</div>
      </td>
      <td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#595959;padding-left:16px">R&sup2; = ${fmt(eq.r2, 3)}</td>
    </tr></table>
    <div style="font-size:12px;color:#7a7a7a;line-height:1.7;padding-top:10px">
      <strong style="color:#595959">I</strong>: intensidad de la lluvia (mm/h) &nbsp;&middot;&nbsp;
      <strong style="color:#595959">T</strong>: período de retorno (años) &nbsp;&middot;&nbsp;
      <strong style="color:#595959">D</strong>: duración de la lluvia (min)
    </div>
  </td></tr>
${
  aviso
    ? `
  <tr><td style="padding:20px 24px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffaec;border-left:3px solid #C9A227;border-radius:4px">
      <tr><td style="padding:12px 14px;font-family:Arial,Helvetica,sans-serif">
        <div style="font-size:10px;font-weight:bold;color:#8a6d1b;letter-spacing:.6px">LEER ANTES DE USAR</div>
        <div style="font-size:12px;color:#4d4433;line-height:1.55;padding-top:4px">${escHtml(aviso)}</div>
      </td></tr>
    </table>
  </td></tr>`
    : ""
}
  <tr><td align="center" style="padding:26px 24px 6px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="background:#A3161A;border-radius:8px">
      <a href="${enlaceEstacion(station)}" style="display:inline-block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none">Ver esta estación en la plataforma</a>
    </td></tr></table>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9a9a9a;padding-top:10px">Ahí puedes cambiar la estación, comparar y descargar los datos.</div>
  </td></tr>

  <tr><td style="padding:22px 24px 24px">
    <div style="border-top:1px solid #ececec;padding-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a8a8a;line-height:1.7">
      <strong style="color:#595959">Sergio Beltrán Coley</strong> &middot; Ingeniería Civil &middot; Universidad de la Costa (CUC)<br>
      <a href="${SITIO}" style="color:#A3161A;text-decoration:none;font-weight:bold">ideam.sergiobc.com</a><br>
      Datos abiertos del IDEAM (datos.gov.co). Uso académico e investigativo.<br>
      Recibiste este correo porque lo pediste en la plataforma. No respondas si no fuiste tú.
    </div>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

// Alternativa en texto plano. No es un adorno: sin ella, los filtros castigan el
// mensaje y los clientes en modo texto muestran una pared vacía.
export function emailIdfText(station, idf, filename) {
  const { trs, filas } = extractoTabla(idf);
  const eq = idf.equation || {};
  const aviso = primerAviso(idf);
  const nYears = idf.nYears;
  const lineas = [
    "CURVAS IDF · Intensidad, Duración y Frecuencia",
    "",
    "Tus curvas IDF están listas. Las calculamos con los datos abiertos del",
    "IDEAM para la estación que pediste. El informe completo va adjunto en PDF.",
    "",
    `Estación: ${station.nombre}`,
    `Ubicación: ${station.municipio}, ${station.departamento}`,
    `Código: ${station.codigo}`,
    `Registro: ${nYears} ${nYears === 1 ? "año" : "años"}, datos cada 10 minutos`,
    "",
    `Adjunto: ${filename}`,
    "",
    "EXTRACTO DE LA TABLA (intensidad de diseño en mm/h)",
    ["Duración".padEnd(10), ...trs.map((tr) => `Tr ${tr}a`.padStart(9))].join(""),
  ];
  for (const f of filas) {
    lineas.push([`${f.dur} min`.padEnd(10), ...f.vals.map((v) => fmt(v, 1).padStart(9))].join(""));
  }
  lineas.push(
    "",
    "ECUACIÓN AJUSTADA",
    `  I = (${fmt(eq.K, 1)} · T^${fmt(eq.m, 3)}) / D^${fmt(eq.n, 3)}     R2 = ${fmt(eq.r2, 3)}`,
    "  I: intensidad de la lluvia (mm/h)",
    "  T: período de retorno (años)",
    "  D: duración de la lluvia (min)",
    "  K, m, n: parámetros del ajuste",
  );
  if (aviso) lineas.push("", `LEER ANTES DE USAR: ${aviso}`);
  lineas.push(
    "",
    `Ver esta estación: ${enlaceEstacion(station)}`,
    "",
    "Sergio Beltrán Coley · Ingeniería Civil · Universidad de la Costa (CUC)",
    SITIO,
    "Datos abiertos del IDEAM (datos.gov.co). Uso académico e investigativo.",
    "Recibiste este correo porque lo pediste en la plataforma.",
  );
  return lineas.join("\n");
}
