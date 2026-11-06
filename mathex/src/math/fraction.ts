/** Fracciones exactas con enteros. Evita errores de punto flotante en las soluciones. */
export interface Frac {
  readonly n: number
  readonly d: number
}

function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b !== 0) {
    const t = b
    b = a % b
    a = t
  }
  return a
}

export function frac(n: number, d = 1): Frac {
  if (!Number.isInteger(n) || !Number.isInteger(d)) throw new RangeError('La fracción requiere enteros')
  if (d === 0) throw new RangeError('División por cero')
  const sign = d < 0 ? -1 : 1
  const g = gcd(n, d) || 1
  return { n: (sign * n) / g + 0, d: Math.abs(d) / g }
}

export const ZERO: Frac = frac(0)
export const ONE: Frac = frac(1)

export const add = (a: Frac, b: Frac): Frac => frac(a.n * b.d + b.n * a.d, a.d * b.d)
export const sub = (a: Frac, b: Frac): Frac => frac(a.n * b.d - b.n * a.d, a.d * b.d)
export const mul = (a: Frac, b: Frac): Frac => frac(a.n * b.n, a.d * b.d)
export const neg = (a: Frac): Frac => frac(-a.n, a.d)
export function div(a: Frac, b: Frac): Frac {
  if (b.n === 0) throw new RangeError('División por cero')
  return frac(a.n * b.d, a.d * b.n)
}
export const isZero = (a: Frac): boolean => a.n === 0
export const eq = (a: Frac, b: Frac): boolean => a.n === b.n && a.d === b.d

/** Texto: "3", "-2", "7/3". */
export function fmt(a: Frac): string {
  return a.d === 1 ? String(a.n) : `${a.n}/${a.d}`
}

/** Igual que fmt, pero entre paréntesis si es negativo. */
export function fmtP(a: Frac | number): string {
  const f = typeof a === 'number' ? frac(a) : a
  return f.n < 0 ? `(${fmt(f)})` : fmt(f)
}
