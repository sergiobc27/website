import {
  textos, cvPerfil, certificados, certCats, certUrl, roles,
  metaDescripcion, titulos, type Lang, type CertCat, type Cert, type Rol,
} from './i18n'

const punteroFino = matchMedia('(pointer: fine)').matches
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/* ===================== i18n ===================== */
let lang: Lang =
  (localStorage.getItem('lang') as Lang | null) ??
  (navigator.language.startsWith('es') ? 'es' : 'en')

function aplicarIdioma(l: Lang): void {
  lang = l
  document.documentElement.lang = l
  localStorage.setItem('lang', l)
  document.title = titulos[l]
  document.querySelector('meta[name="description"]')?.setAttribute('content', metaDescripcion[l])
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
    const clave = el.dataset.i18n!
    if (clave === 'tray1.btn') return // texto controlado por el toggle de cuentas
    const t = textos[clave]
    if (t) el.innerHTML = t[l]
  })
  document.querySelectorAll<HTMLElement>('.flag').forEach(f =>
    f.classList.toggle('active', f.dataset.lang === l),
  )
  pintarChips()
  actualizarPdf()
  if (!modal.hidden) { cvLang = l; pintarCV() }
}

let sweepTimer1 = 0, sweepTimer2 = 0
function cambiarIdioma(l: Lang): void {
  if (l === lang) return
  if (reduceMotion()) { aplicarIdioma(l); return }
  const sweep = document.getElementById('sweep')!
  const app = document.getElementById('app')!
  clearTimeout(sweepTimer1); clearTimeout(sweepTimer2)
  sweep.classList.remove('on'); app.classList.remove('lang-fade')
  void sweep.offsetWidth
  sweep.classList.add('on')
  app.classList.add('lang-fade')
  sweepTimer1 = window.setTimeout(() => aplicarIdioma(l), 620)
  sweepTimer2 = window.setTimeout(() => {
    sweep.classList.remove('on')
    app.classList.remove('lang-fade')
  }, 1400)
}

document.querySelectorAll<HTMLElement>('.flag').forEach(f =>
  f.addEventListener('click', () => cambiarIdioma(f.dataset.lang as Lang)),
)

/* ===================== cursor personalizado ===================== */
if (punteroFino && !reduceMotion()) {
  const dot = document.querySelector<HTMLElement>('.cursor-dot')!
  const ring = document.querySelector<HTMLElement>('.cursor-ring')!
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my

  addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY
    dot.style.left = `${mx}px`; dot.style.top = `${my}px`
    document.querySelectorAll<SVGGElement>('.scene .layer').forEach(l => {
      const d = Number(l.dataset.depth) || 10
      l.style.transform = `translate(${(mx - innerWidth / 2) / -d}px, ${(my - innerHeight / 2) / -d}px)`
    })
  })

  const seguir = (): void => {
    rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16
    ring.style.left = `${rx}px`; ring.style.top = `${ry}px`
    requestAnimationFrame(seguir)
  }
  seguir()

  addEventListener('mouseover', e => {
    const objetivo = (e.target as HTMLElement).closest('a, button, .hover-target')
    ring.classList.toggle('big', Boolean(objetivo))
  })
}

/* ===================== onda y chispas por clic ===================== */
const coloresChispa = ['#b0483b', '#d98e42', '#46695c', '#2e6f8e']
addEventListener('click', e => {
  if (reduceMotion()) return
  const r = document.createElement('div')
  r.className = 'ripple'
  r.style.left = `${e.clientX}px`; r.style.top = `${e.clientY}px`
  document.body.appendChild(r)
  setTimeout(() => r.remove(), 700)
  for (let i = 0; i < 9; i++) {
    const s = document.createElement('div')
    s.className = 'spark'
    const a = Math.random() * Math.PI * 2
    const d = 34 + Math.random() * 46
    s.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;background:${coloresChispa[i % 4]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`
    document.body.appendChild(s)
    setTimeout(() => s.remove(), 650)
  }
})

/* ===================== scroll: progreso, zonas, timeline ===================== */
const barraProgreso = document.querySelector<HTMLElement>('.progress')!
const tfill = document.getElementById('tfill')
const zonas = document.querySelectorAll<HTMLElement>('[data-zone]')
const rioPath = document.getElementById('rioPath') as unknown as SVGPathElement | null
const rioGota = document.getElementById('rioGota') as unknown as SVGCircleElement | null
const rioLargo = rioPath ? rioPath.getTotalLength() : 0
if (rioPath) {
  rioPath.style.strokeDasharray = String(rioLargo)
  rioPath.style.strokeDashoffset = String(rioLargo)
}

addEventListener('scroll', () => {
  const p = scrollY / (document.body.scrollHeight - innerHeight)
  barraProgreso.style.width = `${p * 100}%`
  if (rioPath && rioGota) {
    rioPath.style.strokeDashoffset = String(rioLargo * (1 - p))
    const punta = rioPath.getPointAtLength(rioLargo * p)
    rioGota.setAttribute('cx', String(punta.x))
    rioGota.setAttribute('cy', String(punta.y))
  }
  if (tfill) {
    const caja = tfill.parentElement!.parentElement!.getBoundingClientRect()
    const visible = Math.min(Math.max((innerHeight * 0.8 - caja.top) / caja.height, 0), 1)
    tfill.style.height = `${visible * 100}%`
  }
  let cls = ''
  zonas.forEach(z => {
    const b = z.getBoundingClientRect()
    if (b.top < innerHeight * 0.5 && b.bottom > innerHeight * 0.5) cls = z.dataset.zone!
  })
  document.body.className = cls
}, { passive: true })

/* ===================== reveals, títulos y contadores ===================== */
const io = new IntersectionObserver(
  entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
  { threshold: 0.2 },
)
document.querySelectorAll('.reveal, .clip-title').forEach(el => io.observe(el))

const cio = new IntersectionObserver(
  entries => entries.forEach(e => {
    const el = e.target as HTMLElement
    if (!e.isIntersecting || el.dataset.done) return
    el.dataset.done = '1'
    const fin = Number(el.dataset.count)
    const dec = Number(el.dataset.decimals ?? 0)
    if (reduceMotion()) { el.textContent = fin.toFixed(dec); return }
    const t0 = performance.now()
    const tick = (ahora: number): void => {
      const p = Math.min((ahora - t0) / 1600, 1)
      el.textContent = (fin * (1 - Math.pow(1 - p, 3))).toFixed(dec)
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }),
  { threshold: 0.6 },
)
document.querySelectorAll('[data-count]').forEach(el => cio.observe(el))

/* ===================== tilt 3D en proyectos ===================== */
if (punteroFino && !reduceMotion()) {
  document.querySelectorAll<HTMLElement>('.tilt').forEach(card => {
    card.addEventListener('mousemove', e => {
      const b = card.getBoundingClientRect()
      const px = (e.clientX - b.left) / b.width - 0.5
      const py = (e.clientY - b.top) / b.height - 0.5
      card.style.transform = `rotateY(${px * 10}deg) rotateX(${py * -10}deg) translateY(-4px)`
    })
    card.addEventListener('mouseleave', () => { card.style.transform = '' })
  })
}

/* ===================== chips de cuentas y modal de detalle ===================== */
const detModal = document.getElementById('detModal')!
const detLogo = document.getElementById('detLogo') as HTMLImageElement
const detTitulo = document.getElementById('detTitulo')!
const detMeta = document.getElementById('detMeta')!
const detBody = document.getElementById('detBody')!
let detFocoPrevio: HTMLElement | null = null

function abrirDetalle(logo: string | null, titulo: string, meta: string, cuerpo: string): void {
  detFocoPrevio = document.activeElement as HTMLElement
  if (logo) { detLogo.src = logo; detLogo.hidden = false } else { detLogo.hidden = true }
  detTitulo.textContent = titulo
  detMeta.textContent = meta
  detBody.innerHTML = cuerpo
  detModal.hidden = false
  document.body.style.overflow = 'hidden'
  ;(detModal.querySelector('#detClose') as HTMLElement).focus()
}

function cerrarDetalle(): void {
  detModal.hidden = true
  detBody.innerHTML = ''
  document.body.style.overflow = ''
  detFocoPrevio?.focus()
}

document.getElementById('detClose')!.addEventListener('click', cerrarDetalle)
detModal.addEventListener('click', e => { if (e.target === detModal) cerrarDetalle() })
detModal.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarDetalle() })

function abrirRol(rol: Rol): void {
  abrirDetalle(
    `/logos/${rol.logoCuenta}`,
    rol.titulo[lang],
    `${rol.empresa} · ${rol.fechas[lang]} · ${rol.lugar[lang]}`,
    `<div class="det-texto">${rol.cuerpo[lang]}</div>`,
  )
}

function pintarChips(): void {
  const cont = document.getElementById('cuentasChips')!
  cont.innerHTML = ''
  roles.filter(r => r.empresa === 'Foundever').forEach(rol => {
    const b = document.createElement('button')
    b.className = 'chipcuenta hover-target'
    b.innerHTML = `<img src="/logos/${rol.logoCuenta}" alt=""><span>${rol.cuenta}</span><small>${rol.fechas[lang]}</small>`
    b.addEventListener('click', () => abrirRol(rol))
    cont.appendChild(b)
  })
}

const eduDetalles: Record<string, { logo: string; t: string; meta: string; body: string }> = {}
function abrirEdu(clave: string): void {
  if (clave === 'walmart') {
    const rol = roles.find(r => r.id === 'walmart')!
    abrirRol(rol)
    return
  }
  const mapa: Record<string, { logo: string; t: string; meta: string; body: string }> = {
    cuc: { logo: 'cuc.edu.co.png', t: textos['tray2.t'][lang], meta: textos['tray2.meta'][lang], body: textos['edu.cuc.body'][lang] },
    verano: { logo: 'autonoma.edu.co.png', t: textos['tray3.t'][lang], meta: textos['tray3.meta'][lang], body: textos['edu.verano.body'][lang] },
    uninorte: { logo: 'uninorte.edu.co.png', t: textos['tray4.t'][lang], meta: textos['tray4.meta'][lang], body: textos['edu.uninorte.body'][lang] },
  }
  const d = mapa[clave]
  if (d) abrirDetalle(`/logos/${d.logo}`, d.t, d.meta, `<div class="det-texto">${d.body}</div>`)
}
void eduDetalles

document.querySelectorAll<HTMLElement>('.tdet').forEach(b =>
  b.addEventListener('click', () => abrirEdu(b.dataset.det!)),
)

function abrirCert(c: Cert): void {
  const url = certUrl(c)
  const partes: string[] = []
  if (c.id) partes.push(`<p class="det-cred">${textos['det.credencial'][lang]}: <code>${c.id}</code>${url ? ` · <a class="cver hover-target" href="${url}" target="_blank" rel="noopener">${textos['cvv.ver'][lang]}</a>` : ''}</p>`)
  if (c.media) {
    partes.push(`<object class="pdf-frame" data="${c.media}" type="application/pdf"><p>${textos['det.pdfalt'][lang]}</p></object>`)
    partes.push(`<p style="margin-top:10px"><a class="cver hover-target" href="${c.media}" target="_blank" rel="noopener">${textos['det.pdfalt'][lang]}</a></p>`)
  }
  abrirDetalle(c.logo ? `/logos/${c.logo}` : null, c.nombre, `${c.emisor} · ${c.fecha}`, partes.join(''))
}

/* ===================== visor de hoja de vida ===================== */
const modal = document.getElementById('cvModal')!
const cvBody = document.getElementById('cvBody')!
let cvLang: Lang = lang
let certFiltro: CertCat | 'todas' = 'todas'
let focoPrevio: HTMLElement | null = null

function actualizarPdf(): void {
  const pdf = document.getElementById('cvPdf') as HTMLAnchorElement | null
  if (pdf) pdf.href = `/cv/sergio-beltran-coley-${modal.hidden ? lang : cvLang}.pdf`
}

function htmlCerts(): string {
  const cats: (CertCat | 'todas')[] = ['todas', 'ia', 'datos', 'civil', 'gestion']
  const chips = cats.map(c => {
    const etiqueta = c === 'todas' ? textos['cvv.todas'][cvLang] : certCats[c][cvLang]
    return `<button class="chip hover-target${c === certFiltro ? ' active' : ''}" data-cat="${c}">${etiqueta}</button>`
  }).join('')
  const visibles = certificados.filter(c => certFiltro === 'todas' || c.cat === certFiltro)
  const items = visibles.map((c, i) => {
    const idx = certificados.indexOf(c)
    const logo = c.logo ? `<img class="clogo" src="/logos/${c.logo}" alt="">` : ''
    const doc = c.media ? ' <span class="cdoc">PDF</span>' : ''
    return `<button class="cert-item hover-target" data-idx="${idx}" style="animation-delay:${Math.min(i * 40, 500)}ms">
      <span class="ccat">${certCats[c.cat][cvLang]}</span>
      ${logo}<b>${c.nombre}${doc}</b>
      <span class="cmeta">${c.emisor} · ${c.fecha}</span>
    </button>`
  }).join('')
  return `<div class="cv-sec"><h4>${textos['cvv.certs.h'][cvLang]}</h4>
    <p class="cmeta" style="margin-bottom:10px">${textos['cvv.clic'][cvLang]}</p>
    <div class="cert-filtros">${chips}</div>
    <div class="certs-lista">${items}</div>
  </div>`
}

function pintarCV(): void {
  cvBody.innerHTML = cvPerfil[cvLang] + htmlCerts()
  document.querySelectorAll<HTMLElement>('.cv-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.cvlang === cvLang),
  )
  cvBody.querySelectorAll<HTMLElement>('.chip').forEach(chip =>
    chip.addEventListener('click', () => {
      certFiltro = chip.dataset.cat as CertCat | 'todas'
      pintarCV()
    }),
  )
  cvBody.querySelectorAll<HTMLElement>('.cert-item').forEach(item =>
    item.addEventListener('click', () => abrirCert(certificados[Number(item.dataset.idx)])),
  )
  actualizarPdf()
}

function abrirCV(): void {
  focoPrevio = document.activeElement as HTMLElement
  cvLang = lang
  certFiltro = 'todas'
  modal.hidden = false
  pintarCV()
  document.body.style.overflow = 'hidden'
  ;(modal.querySelector('.cv-tab') as HTMLElement).focus()
}

function cerrarCV(): void {
  modal.hidden = true
  document.body.style.overflow = ''
  actualizarPdf()
  focoPrevio?.focus()
}

document.getElementById('cvBook')!.addEventListener('click', abrirCV)
document.getElementById('cvOpenBtn')!.addEventListener('click', abrirCV)
document.getElementById('cvClose')!.addEventListener('click', cerrarCV)
modal.addEventListener('click', e => { if (e.target === modal) cerrarCV() })

document.querySelectorAll<HTMLElement>('.cv-tab').forEach(t =>
  t.addEventListener('click', () => { cvLang = t.dataset.cvlang as Lang; pintarCV() }),
)

modal.addEventListener('keydown', e => {
  if (e.key === 'Escape') { cerrarCV(); return }
  if (e.key !== 'Tab') return
  const focusables = modal.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')
  const primero = focusables[0]
  const ultimo = focusables[focusables.length - 1]
  if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus() }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus() }
})

/* ===================== arranque ===================== */
aplicarIdioma(lang)
