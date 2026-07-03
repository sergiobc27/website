import {
  textos, cvPerfil, certificados, certCats, certUrl,
  metaDescripcion, titulos, type Lang, type CertCat,
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
  pintarCuentasBtn()
  actualizarPdf()
  if (!modal.hidden) { cvLang = l; pintarCV() }
}

let irisTimer1 = 0, irisTimer2 = 0
function cambiarIdioma(l: Lang): void {
  if (l === lang) return
  if (reduceMotion()) { aplicarIdioma(l); return }
  const iris = document.getElementById('iris')!
  const app = document.getElementById('app')!
  clearTimeout(irisTimer1); clearTimeout(irisTimer2)
  iris.classList.remove('on'); app.classList.remove('lang-fade')
  void iris.offsetWidth
  iris.classList.add('on')
  app.classList.add('lang-fade')
  irisTimer1 = window.setTimeout(() => aplicarIdioma(l), 600)
  irisTimer2 = window.setTimeout(() => {
    iris.classList.remove('on')
    app.classList.remove('lang-fade')
  }, 1350)
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

addEventListener('scroll', () => {
  const p = scrollY / (document.body.scrollHeight - innerHeight)
  barraProgreso.style.width = `${p * 100}%`
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

/* ===================== cuentas de Foundever (expandible) ===================== */
const cuentasBtn = document.getElementById('cuentasBtn')!
const cuentasSub = document.getElementById('cuentasSub') as HTMLElement
let cuentasAbiertas = false

function pintarCuentasBtn(): void {
  cuentasBtn.innerHTML = textos[cuentasAbiertas ? 'tray1.btn.close' : 'tray1.btn'][lang]
  cuentasBtn.setAttribute('aria-expanded', String(cuentasAbiertas))
  if (cuentasAbiertas) cuentasSub.innerHTML = textos['tray1.sub'][lang]
}

cuentasBtn.addEventListener('click', () => {
  cuentasAbiertas = !cuentasAbiertas
  cuentasSub.hidden = !cuentasAbiertas
  pintarCuentasBtn()
})

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
    const url = certUrl(c)
    const ver = url ? ` · <a class="cver hover-target" href="${url}" target="_blank" rel="noopener">${textos['cvv.ver'][cvLang]}</a>` : ''
    return `<div class="cert-item" style="animation-delay:${Math.min(i * 40, 500)}ms">
      <span class="ccat">${certCats[c.cat][cvLang]}</span>
      <b>${c.nombre}</b>
      <span class="cmeta">${c.emisor} · ${c.fecha}${ver}</span>
    </div>`
  }).join('')
  return `<div class="cv-sec"><h4>${textos['cvv.certs.h'][cvLang]}</h4>
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
