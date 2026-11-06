import { type Frac, ONE, add, div, eq, fmt, fmtP, frac, isZero, mul, sub, ZERO } from './fraction.ts'

export type Matrix = number[][]
export type Classification = 'determinado' | 'indeterminado' | 'incompatible'

export const CLASS_LABEL: Record<Classification, string> = {
  determinado: 'Compatible determinado',
  indeterminado: 'Compatible indeterminado',
  incompatible: 'Incompatible',
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)

export const det2 = (m: Matrix): number => m[0][0] * m[1][1] - m[0][1] * m[1][0]

/** Productos de las diagonales del método de Sarrus. */
export function sarrusProducts(m: Matrix): { plus: number[]; minus: number[] } {
  const [r0, r1, r2] = m
  // "+ 0" normaliza -0 a 0 (un producto con un factor 0 y otro negativo da -0 en JavaScript).
  return {
    plus: [r0[0] * r1[1] * r2[2] + 0, r0[1] * r1[2] * r2[0] + 0, r0[2] * r1[0] * r2[1] + 0],
    minus: [r0[2] * r1[1] * r2[0] + 0, r0[0] * r1[2] * r2[1] + 0, r0[1] * r1[0] * r2[2] + 0],
  }
}

export function det3(m: Matrix): number {
  const { plus, minus } = sarrusProducts(m)
  return sum(plus) - sum(minus)
}

/** Menor 2×2 que resulta de eliminar la fila y columna indicadas. */
export function minor(m: Matrix, row: number, col: number): Matrix {
  return m.filter((_, i) => i !== row).map((r) => r.filter((_, j) => j !== col))
}

/** Determinante 3×3 por cofactores de la primera fila (cálculo independiente de Sarrus). */
export function det3Cofactor(m: Matrix): number {
  return m[0][0] * det2(minor(m, 0, 0)) - m[0][1] * det2(minor(m, 0, 1)) + m[0][2] * det2(minor(m, 0, 2))
}

export function detN(m: Matrix): number {
  if (m.length === 2) return det2(m)
  if (m.length === 3) return det3(m)
  throw new RangeError('Solo se admiten matrices 2×2 y 3×3')
}

export function replaceColumn(a: Matrix, col: number, b: number[]): Matrix {
  return a.map((row, i) => row.map((v, j) => (j === col ? b[i] : v)))
}

export interface CramerResult {
  D: number
  dets: number[]
  solution: Frac[] | null
}

export function cramer(a: Matrix, b: number[]): CramerResult {
  const D = detN(a)
  if (D === 0) return { D, dets: [], solution: null }
  const dets = a.map((_, j) => detN(replaceColumn(a, j, b)))
  return { D, dets, solution: dets.map((d) => frac(d, D)) }
}

export interface GaussResult {
  cls: Classification
  solution: Frac[] | null
  steps: string[]
}

const showMatrix = (m: Frac[][]): string => m.map((r) => `[${r.slice(0, -1).map(fmt).join(' ')} | ${fmt(r[r.length - 1])}]`).join(' ')

/** Gauss-Jordan exacto con registro de pasos. Clasifica el sistema por rangos. */
export function gaussJordan(a: Matrix, b: number[]): GaussResult {
  const rows = a.length
  const n = a[0].length
  const M: Frac[][] = a.map((row, i) => [...row.map((x) => frac(x)), frac(b[i])])
  const steps: string[] = [`Matriz ampliada: ${showMatrix(M)}`]
  let r = 0
  for (let c = 0; c < n && r < rows; c++) {
    let p = -1
    for (let i = r; i < rows; i++) {
      if (!isZero(M[i][c])) {
        p = i
        break
      }
    }
    if (p === -1) continue
    if (p !== r) {
      const t = M[p]
      M[p] = M[r]
      M[r] = t
      steps.push(`F${r + 1} ↔ F${p + 1} ⇒ ${showMatrix(M)}`)
    }
    const pv = M[r][c]
    if (!eq(pv, ONE)) {
      M[r] = M[r].map((x) => div(x, pv))
      steps.push(`F${r + 1} → F${r + 1} ÷ ${fmtP(pv)} ⇒ ${showMatrix(M)}`)
    }
    for (let i = 0; i < rows; i++) {
      if (i === r) continue
      const f = M[i][c]
      if (isZero(f)) continue
      M[i] = M[i].map((x, k) => sub(x, mul(f, M[r][k])))
      steps.push(`F${i + 1} → F${i + 1} − ${fmtP(f)}·F${r + 1} ⇒ ${showMatrix(M)}`)
    }
    r++
  }
  const inconsistent = M.some((row) => row.slice(0, n).every(isZero) && !isZero(row[n]))
  if (inconsistent) {
    steps.push('Aparece una fila 0 = k con k ≠ 0: el sistema no tiene solución.')
    return { cls: 'incompatible', solution: null, steps }
  }
  if (r < n) {
    steps.push('El rango es menor que el número de incógnitas: hay infinitas soluciones.')
    return { cls: 'indeterminado', solution: null, steps }
  }
  return { cls: 'determinado', solution: M.slice(0, n).map((row) => row[n]), steps }
}

export const classify = (a: Matrix, b: number[]): Classification => gaussJordan(a, b).cls

/** Comprueba exactamente que la solución satisface todas las ecuaciones. */
export function satisfies(a: Matrix, b: number[], sol: Frac[]): boolean {
  return a.every((row, i) => {
    const lhs = row.reduce((acc, coef, j) => add(acc, mul(frac(coef), sol[j])), ZERO)
    return eq(lhs, frac(b[i]))
  })
}
