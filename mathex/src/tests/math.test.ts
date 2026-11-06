import { describe, expect, it } from 'vitest'
import { add, div, eq, fmt, frac, mul, sub } from '../math/fraction.ts'
import { classify, cramer, det2, det3, det3Cofactor, gaussJordan, replaceColumn, sarrusProducts, satisfies } from '../math/linear.ts'
import { createRng } from '../math/rng.ts'

describe('fracciones', () => {
  it('normaliza y opera con exactitud', () => {
    expect(fmt(frac(6, -4))).toBe('-3/2')
    expect(fmt(add(frac(1, 3), frac(1, 6)))).toBe('1/2')
    expect(fmt(sub(frac(1, 2), frac(1, 2)))).toBe('0')
    expect(fmt(mul(frac(2, 3), frac(3, 4)))).toBe('1/2')
    expect(eq(div(frac(1), frac(2)), frac(1, 2))).toBeTruthy()
  })
  it('lanza error al dividir por cero', () => {
    expect(() => frac(1, 0)).toThrow()
    expect(() => div(frac(1), frac(0))).toThrow()
  })
})

describe('determinantes', () => {
  it('2×2', () => {
    expect(det2([[3, 2], [1, 4]])).toBe(10)
    expect(det2([[2, 4], [1, 2]])).toBe(0)
  })
  it('3×3 por Sarrus (caso conocido)', () => {
    expect(det3([[2, 0, 1], [1, 3, 2], [1, 1, 1]])).toBe(-0 + 2 * (3 - 2) - 0 + 1 * (1 - 3))
    expect(det3([[1, 2, 3], [4, 5, 6], [7, 8, 9]])).toBe(0)
    expect(det3([[2, -1, 0], [1, 3, 4], [0, 5, -2]])).toBe(-54)
  })
  it('Sarrus coincide con cofactores en muchas matrices aleatorias', () => {
    const rng = createRng(42)
    for (let k = 0; k < 500; k++) {
      const m = [0, 1, 2].map(() => [0, 1, 2].map(() => rng.int(-9, 9)))
      expect(det3(m)).toBe(det3Cofactor(m))
    }
  })
  it('productos de Sarrus', () => {
    const { plus, minus } = sarrusProducts([[2, -1, 0], [1, 3, 4], [0, 5, -2]])
    expect(plus).toEqual([-12, 0, 0])
    expect(minus).toEqual([0, 40, 2])
  })
})

describe('regla de Cramer y Gauss-Jordan', () => {
  it('2×2 con solución entera', () => {
    const r = cramer([[2, 1], [1, -1]], [5, 1])
    expect(r.D).toBe(-3)
    expect(r.solution!.map(fmt)).toEqual(['2', '1'])
  })
  it('2×2 con solución fraccionaria', () => {
    const r = cramer([[2, 3], [4, -1]], [1, 2])
    expect(r.solution!.map(fmt)).toEqual(['1/2', '0'])
    expect(satisfies([[2, 3], [4, -1]], [1, 2], r.solution!)).toBeTruthy()
  })
  it('D = 0 no devuelve solución', () => {
    expect(cramer([[1, 2], [2, 4]], [3, 6]).solution).toBeNull()
  })
  it('3×3 coincide con Gauss-Jordan', () => {
    const A = [[2, 1, -1], [-3, -1, 2], [-2, 1, 2]]
    const b = [8, -11, -3]
    const c = cramer(A, b).solution!.map(fmt)
    const g = gaussJordan(A, b).solution!.map(fmt)
    expect(c).toEqual(['2', '3', '-1'])
    expect(g).toEqual(c)
  })
  it('reemplaza columnas correctamente', () => {
    expect(replaceColumn([[1, 2], [3, 4]], 1, [9, 8])).toEqual([[1, 9], [3, 8]])
  })
  it('clasifica casos especiales', () => {
    expect(classify([[1, 1], [1, 1]], [2, 3])).toBe('incompatible')
    expect(classify([[1, 1], [2, 2]], [2, 4])).toBe('indeterminado')
    expect(classify([[1, 1], [1, -1]], [2, 0])).toBe('determinado')
    expect(classify([[1, 1, 1], [1, 2, 3], [2, 3, 4]], [1, 2, 4])).toBe('incompatible')
    expect(classify([[1, 1, 1], [1, 2, 3], [2, 3, 4]], [1, 2, 3])).toBe('indeterminado')
  })
})
