// Detección de plataforma para el tratamiento del chrome (Liquid Glass por
// plataforma). Pura e inyectable para tests; App la fija en
// <html data-plataforma="..."> al montar.

export type Plataforma = 'ios' | 'android' | 'desktop';

export function detectarPlataforma(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  maxTouchPoints: number = typeof navigator !== 'undefined' ? navigator.maxTouchPoints ?? 0 : 0,
): Plataforma {
  if (/iPhone|iPod/i.test(ua)) return 'ios';
  // iPadOS se camufla como Macintosh; el delator es el multitouch.
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}
