import { type Frac, add, fmt, fmtP, frac, mul, neg, ZERO } from '../math/fraction.ts'
import { equation, matrixLatex, systemLatex, systemText } from '../math/format.ts'
import {
  type Matrix, CLASS_LABEL, cramer, det2, det3, gaussJordan, minor, replaceColumn, sarrusProducts,
} from '../math/linear.ts'
import { createRng, type Rng } from '../math/rng.ts'
import { answerText, CRAMER_OPTIONS } from './answers.ts'
import type { Difficulty, Exercise, ExerciseCheck, ModuleId, SystemAsk } from './types.ts'

type Body = Omit<Exercise, 'id' | 'moduleId' | 'difficulty' | 'seed'>

const nz = (rng: Rng, min: number, max: number): number => {
  let v = 0
  while (v === 0) v = rng.int(min, max)
  return v
}
const P = (n: number): string => (n < 0 ? `(${n})` : String(n))
const sumOf = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)

// ───────────── Opciones de respuesta ─────────────

function pickOptions(rng: Rng, correct: string, pool: string[], filler: () => string): { options: string[]; correctIndex: number } {
  const set = new Set<string>([correct])
  for (const c of rng.shuffle(pool)) if (set.size < 4) set.add(c)
  let guard = 0
  while (set.size < 4 && guard++ < 200) set.add(filler())
  const options = rng.shuffle([...set])
  return { options, correctIndex: options.indexOf(correct) }
}

const tupleText = (vars: string[], sol: Frac[]): string => vars.map((v, i) => `${v} = ${fmt(sol[i])}`).join(', ')

function tupleOptions(rng: Rng, vars: string[], sol: Frac[]) {
  const pool: string[] = []
  sol.forEach((_, i) => {
    for (const d of [1, -1]) pool.push(tupleText(vars, sol.map((x, j) => (j === i ? add(x, frac(d)) : x))))
  })
  pool.push(tupleText(vars, sol.map((x) => neg(x))))
  if (sol.length > 1) pool.push(tupleText(vars, [...sol.slice(1), sol[0]]))
  const filler = () => {
    const i = rng.int(0, sol.length - 1)
    return tupleText(vars, sol.map((x, j) => (j === i ? add(x, frac(rng.int(2, 4) * (rng.next() < 0.5 ? -1 : 1))) : x)))
  }
  return pickOptions(rng, tupleText(vars, sol), pool, filler)
}

function scalarOptions(rng: Rng, value: Frac, extra: string[] = []) {
  const pool = [...extra]
  for (const d of [1, -1, 2, -2]) pool.push(fmt(add(value, frac(d))))
  pool.push(fmt(neg(value)), fmt(mul(value, frac(2))))
  const filler = () => fmt(add(value, frac(rng.int(3, 9) * (rng.next() < 0.5 ? -1 : 1))))
  return pickOptions(rng, fmt(value), pool, filler)
}

// ───────────── Generación de sistemas ─────────────

interface Sys {
  A: Matrix
  b: number[]
  sol: Frac[]
}

function genSystem2(rng: Rng, diff: Difficulty, a11One = false): Sys {
  const cr = [4, 6, 7][diff - 1]
  const sr = [5, 8, 8][diff - 1]
  for (;;) {
    const A = [[nz(rng, -cr, cr), nz(rng, -cr, cr)], [nz(rng, -cr, cr), nz(rng, -cr, cr)]]
    if (a11One) A[0][0] = 1
    if (det2(A) === 0) continue
    const fractional = diff === 3 && rng.next() < 0.6
    const [x, y] = [rng.int(-sr, sr), rng.int(-sr, sr)]
    const b = fractional
      ? [rng.int(-12, 12), rng.int(-12, 12)]
      : [A[0][0] * x + A[0][1] * y, A[1][0] * x + A[1][1] * y]
    const solution = cramer(A, b).solution
    if (solution) return { A, b, sol: solution }
  }
}

function genSystem3(rng: Rng, diff: Difficulty): Sys {
  const cr = [2, 3, 4][diff - 1]
  const sr = [4, 5, 6][diff - 1]
  for (;;) {
    const A = [0, 1, 2].map(() => [0, 1, 2].map(() => rng.int(-cr, cr)))
    if (det3(A) === 0) continue
    const s = [rng.int(-sr, sr), rng.int(-sr, sr), rng.int(-sr, sr)]
    const b = A.map((row) => row[0] * s[0] + row[1] * s[1] + row[2] * s[2])
    const solution = cramer(A, b).solution
    if (solution) return { A, b, sol: solution }
  }
}

function genClassified(rng: Rng, n: 2 | 3, target: 'indeterminado' | 'incompatible'): { A: Matrix; b: number[] } {
  for (;;) {
    let A: Matrix
    let b: number[]
    const delta = target === 'incompatible' ? nz(rng, -5, 5) : 0
    if (n === 2) {
      const r = [nz(rng, -5, 5), nz(rng, -5, 5)]
      const k = rng.pick([2, 3, -1, -2])
      const c = rng.int(-9, 9)
      A = [r, [r[0] * k, r[1] * k]]
      b = [c, c * k + delta]
    } else {
      const r1 = [0, 1, 2].map(() => rng.int(-3, 3))
      const r2 = [0, 1, 2].map(() => rng.int(-3, 3))
      const k = rng.pick([1, -1])
      const c1 = rng.int(-8, 8)
      const c2 = rng.int(-8, 8)
      A = [r1, r2, r1.map((v, j) => v + k * r2[j])]
      b = [c1, c2, c1 + k * c2 + delta]
      const order = rng.shuffle([0, 1, 2])
      A = order.map((i) => A[i])
      b = order.map((i) => b[i])
    }
    if (gaussJordan(A, b).cls === target) return { A, b }
  }
}

const verifyLines = (A: Matrix, b: number[], sol: Frac[]): string[] =>
  A.map((row, i) => {
    const lhs = row.reduce((acc, a, j) => add(acc, mul(frac(a), sol[j])), ZERO)
    return `Ecuación ${i + 1}: ${row.map((a, j) => `${P(a)}·${fmtP(sol[j])}`).join(' + ')} = ${fmt(lhs)} = ${b[i]} ✓`
  })

interface SystemArgs {
  rng: Rng
  A: Matrix
  b: number[]
  vars: string[]
  ask: SystemAsk
  intro: string
  steps?: string[]
  statementOverride?: string
}

function systemBody(a: SystemArgs): Body {
  const { rng, A, b, vars, ask } = a
  const g = gaussJordan(A, b)
  const check: ExerciseCheck = { kind: 'system', A, b, vars, cls: g.cls, solution: g.solution, ask }
  const correct = answerText(check)
  let opts: { options: string[]; correctIndex: number }
  if (ask === 'class') {
    const all = [CLASS_LABEL.determinado, CLASS_LABEL.indeterminado, CLASS_LABEL.incompatible, 'Tiene exactamente dos soluciones']
    opts = { options: all, correctIndex: all.indexOf(correct) }
  } else if (ask === 'cramer') {
    opts = { options: CRAMER_OPTIONS, correctIndex: CRAMER_OPTIONS.indexOf(correct) }
  } else if (ask === 'all') {
    opts = tupleOptions(rng, vars, g.solution!)
  } else {
    opts = scalarOptions(rng, g.solution![ask])
  }
  const steps = [...(a.steps ?? g.steps)]
  let explanation: string
  if (g.solution && (ask === 'all' || typeof ask === 'number')) {
    steps.push('Verificación en las ecuaciones originales:', ...verifyLines(A, b, g.solution))
    explanation = `El sistema es compatible determinado. Solución: ${tupleText(vars, g.solution)}.`
  } else if (ask === 'cramer') {
    explanation = g.solution
      ? 'D ≠ 0, así que el sistema tiene solución única y Cramer se puede aplicar.'
      : `D = 0, así que no hay solución única y Cramer no se puede aplicar. (Estudiando el sistema por rangos resulta: ${CLASS_LABEL[g.cls].toLowerCase()}.)`
  } else {
    explanation = `Clasificación por rangos: ${CLASS_LABEL[g.cls]}.`
  }
  return {
    statement: a.statementOverride ?? `${a.intro}\n${systemText(A, b, vars)}`,
    latex: systemLatex(A, b, vars),
    options: opts.options,
    correctIndex: opts.correctIndex,
    steps,
    explanation,
    check,
  }
}

// ───────────── Módulos de sistemas 2×2 ─────────────

const V2 = ['x', 'y']
const V3 = ['x', 'y', 'z']

function mod1(rng: Rng, i: number, diff: Difficulty): Body {
  if (i % 5 === 4) {
    const target = i === 4 ? 'incompatible' : i === 9 ? 'indeterminado' : rng.pick(['incompatible', 'indeterminado'] as const)
    const { A, b } = genClassified(rng, 2, target)
    return systemBody({ rng, A, b, vars: V2, ask: 'class', intro: 'Clasifica el sistema 2×2:' })
  }
  const { A, b } = genSystem2(rng, diff)
  return systemBody({ rng, A, b, vars: V2, ask: 'all', intro: 'Resuelve el sistema 2×2:' })
}

function mod2(rng: Rng, _i: number, diff: Difficulty): Body {
  const { A, b, sol } = genSystem2(rng, diff)
  const [[a1, b1], [a2, b2]] = A
  const [c1, c2] = b
  const D = a1 * b2 - a2 * b1
  const rhs = a1 * c2 - a2 * c1
  const steps = [
    `Despejamos x en ambas ecuaciones: x = (${c1} − ${P(b1)}y) / ${P(a1)}  y  x = (${c2} − ${P(b2)}y) / ${P(a2)}.`,
    `Igualamos: (${c1} − ${P(b1)}y) / ${P(a1)} = (${c2} − ${P(b2)}y) / ${P(a2)}.`,
    `Multiplicamos en cruz: ${P(a2)}(${c1} − ${P(b1)}y) = ${P(a1)}(${c2} − ${P(b2)}y).`,
    `Agrupamos los términos en y: (${a1}·${P(b2)} − ${P(a2)}·${P(b1)}) y = ${a1}·${P(c2)} − ${P(a2)}·${P(c1)}, es decir ${P(D)}y = ${rhs}.`,
    `y = ${rhs}/${P(D)} = ${fmt(sol[1])}.`,
    `Sustituimos en x = (${c1} − ${P(b1)}y) / ${P(a1)}: x = ${fmt(sol[0])}.`,
  ]
  return systemBody({ rng, A, b, vars: V2, ask: 'all', intro: 'Resuelve por el método de IGUALACIÓN:', steps })
}

function mod3(rng: Rng, _i: number, diff: Difficulty): Body {
  const { A, b, sol } = genSystem2(rng, diff, true)
  const [[, b1], [a2, b2]] = A
  const [c1, c2] = b
  const D = b2 - a2 * b1
  const steps = [
    `De la ecuación 1 despejamos x: x = ${c1} − ${P(b1)}y.`,
    `Sustituimos en la ecuación 2: ${P(a2)}(${c1} − ${P(b1)}y) + ${P(b2)}y = ${c2}.`,
    `Desarrollamos y agrupamos: (${P(b2)} − ${P(a2)}·${P(b1)}) y = ${c2} − ${P(a2)}·${P(c1)}, es decir ${P(D)}y = ${c2 - a2 * c1}.`,
    `y = ${fmt(sol[1])}.`,
    `x = ${c1} − ${P(b1)}·${fmtP(sol[1])} = ${fmt(sol[0])}.`,
  ]
  return systemBody({ rng, A, b, vars: V2, ask: 'all', intro: 'Resuelve por el método de SUSTITUCIÓN:', steps })
}

function mod4(rng: Rng, _i: number, diff: Difficulty): Body {
  const { A, b, sol } = genSystem2(rng, diff)
  const [[a1, b1], [a2, b2]] = A
  const [c1, c2] = b
  const D = a1 * b2 - a2 * b1
  const steps = [
    `Para eliminar x, multiplicamos la ecuación 1 por ${P(a2)} y la ecuación 2 por ${P(a1)}.`,
    `Ec. 1 × ${P(a2)}: ${P(a1 * a2)}x + ${P(a2 * b1)}y = ${a2 * c1}.`,
    `Ec. 2 × ${P(a1)}: ${P(a1 * a2)}x + ${P(a1 * b2)}y = ${a1 * c2}.`,
    `Restamos (Ec. 2 − Ec. 1): (${P(a1 * b2)} − ${P(a2 * b1)}) y = ${a1 * c2} − ${P(a2 * c1)}, es decir ${P(D)}y = ${a1 * c2 - a2 * c1}.`,
    `y = ${fmt(sol[1])}.`,
    `Sustituimos en la ecuación 1: ${P(a1)}x + ${P(b1)}·${fmtP(sol[1])} = ${c1}, de donde x = ${fmt(sol[0])}.`,
  ]
  return systemBody({ rng, A, b, vars: V2, ask: 'all', intro: 'Resuelve por REDUCCIÓN (eliminación):', steps })
}

function mod5(rng: Rng, i: number, diff: Difficulty): Body {
  const t = i % 3
  let A: Matrix, b: number[], defs: string[], text: string, target: number, vars: string[]
  if (t === 0) {
    const [x, y] = [rng.int(20, 60) + diff * 5, rng.int(10, 50)]
    const pa = rng.int(6, 12)
    const pc = rng.int(2, pa - 1)
    A = [[1, 1], [pa, pc]]
    b = [x + y, pa * x + pc * y]
    vars = ['x', 'y']
    defs = ['x = entradas de adulto vendidas', 'y = entradas de niño vendidas']
    target = rng.int(0, 1)
    text = `En una función se vendieron ${b[0]} entradas. Cada entrada de adulto cuesta $${pa} y cada una de niño $${pc}. La recaudación fue de $${b[1]}. ¿Cuántas entradas de ${target === 0 ? 'adulto' : 'niño'} se vendieron?`
  } else if (t === 1) {
    const y = rng.int(1, 20)
    const x = y + rng.int(1, 15) + diff
    A = [[1, 1], [1, -1]]
    b = [x + y, x - y]
    vars = ['x', 'y']
    defs = ['x = número mayor', 'y = número menor']
    target = rng.int(0, 1)
    text = `La suma de dos números es ${b[0]} y su diferencia (mayor − menor) es ${b[1]}. ¿Cuál es el número ${target === 0 ? 'mayor' : 'menor'}?`
  } else {
    const [x, y] = [rng.int(2, 9), rng.int(2, 9)]
    const [m, n] = [rng.int(1, 5), rng.int(1, 5)]
    const [u, v] = [rng.int(1, 5), rng.int(1, 5)]
    A = [[m, n], [u, v]]
    if (det2(A) === 0) A = [[m, n + 1], [u, v]]
    b = [A[0][0] * x + A[0][1] * y, A[1][0] * x + A[1][1] * y]
    vars = ['x', 'y']
    defs = ['x = precio de un cuaderno', 'y = precio de un lápiz']
    target = rng.int(0, 1)
    text = `Ana compra ${A[0][0]} cuadernos y ${A[0][1]} lápices por $${b[0]}. Luis compra ${A[1][0]} cuadernos y ${A[1][1]} lápices por $${b[1]}. ¿Cuánto cuesta un ${target === 0 ? 'cuaderno' : 'lápiz'}?`
  }
  const cr = cramer(A, b)
  const steps = [
    `Definimos las incógnitas: ${defs.join('; ')}.`,
    'Planteamos el sistema:',
    ...A.map((row, k) => equation(row, vars, b[k])),
    `Resolvemos con Cramer: D = ${cr.D}, Dx = ${cr.dets[0]}, Dy = ${cr.dets[1]}.`,
    `x = ${cr.dets[0]}/${P(cr.D)} = ${fmt(cr.solution![0])},  y = ${cr.dets[1]}/${P(cr.D)} = ${fmt(cr.solution![1])}.`,
  ]
  const body = systemBody({ rng, A, b, vars, ask: target, intro: '', steps, statementOverride: text })
  return { ...body, latex: systemLatex(A, b, vars) }
}

function detBody(rng: Rng, M: Matrix, steps: string[], latexExtra: string[], typical: number[]): Body {
  const value = M.length === 2 ? det2(M) : det3(M)
  const check: ExerciseCheck = { kind: 'determinant', matrix: M, value }
  const pool = [...typical, value + 1, value - 1, value + 2, value - 2, -value].map(String)
  const filler = () => String(value + rng.int(3, 12) * (rng.next() < 0.5 ? -1 : 1))
  const { options, correctIndex } = pickOptions(rng, String(value), pool, filler)
  return {
    statement: `Calcula el determinante:\n${M.map((r) => `| ${r.join('   ')} |`).join('\n')}`,
    latex: matrixLatex(M),
    options,
    correctIndex,
    steps: [...steps, ...latexExtra],
    explanation: `El determinante vale ${value}.${value === 0 ? ' Como es 0, la matriz es singular (no invertible).' : ''}`,
    check,
  }
}

function mod6(rng: Rng, i: number, diff: Difficulty): Body {
  const r = [4, 7, 10][diff - 1]
  let M: Matrix
  if (i % 7 === 6) {
    const [a, b] = [nz(rng, -r, r), nz(rng, -r, r)]
    const k = rng.pick([2, -1, 3])
    M = [[a, b], [a * k, b * k]]
  } else {
    M = [[rng.int(-r, r), rng.int(-r, r)], [rng.int(-r, r), rng.int(-r, r)]]
  }
  const [[a, b], [c, d]] = M
  const steps = [
    'Fórmula: |a b; c d| = a·d − b·c.',
    `= ${P(a)}·${P(d)} − ${P(b)}·${P(c)}`,
    `= ${a * d} − ${P(b * c)} = ${det2(M)}.`,
  ]
  return detBody(rng, M, steps, [], [a * d + b * c, b * c - a * d, a * d])
}

function mod7(rng: Rng, i: number, diff: Difficulty): Body {
  if (i === 14) {
    const [a, b] = [nz(rng, -5, 5), nz(rng, -5, 5)]
    const k = rng.pick([2, 3, -2])
    const A = [[a, b], [a * k, b * k]]
    const bb = [rng.int(-8, 8), rng.int(-8, 8)]
    const steps = [`D = ${P(A[0][0])}·${P(A[1][1])} − ${P(A[0][1])}·${P(A[1][0])} = ${det2(A)}.`, 'Como D = 0, la regla de Cramer no puede dar una solución única.']
    return systemBody({ rng, A, b: bb, vars: V2, ask: 'cramer', intro: '¿Qué indica la regla de Cramer en este sistema?', steps })
  }
  const { A, b } = genSystem2(rng, diff)
  const cr = cramer(A, b)
  const steps = [
    `D = |${A[0][0]} ${A[0][1]}; ${A[1][0]} ${A[1][1]}| = ${cr.D}.`,
    `Dx (columna x ← términos independientes) = |${b[0]} ${A[0][1]}; ${b[1]} ${A[1][1]}| = ${cr.dets[0]}.`,
    `Dy (columna y ← términos independientes) = |${A[0][0]} ${b[0]}; ${A[1][0]} ${b[1]}| = ${cr.dets[1]}.`,
    `x = Dx/D = ${cr.dets[0]}/${P(cr.D)} = ${fmt(cr.solution![0])};  y = Dy/D = ${cr.dets[1]}/${P(cr.D)} = ${fmt(cr.solution![1])}.`,
  ]
  return systemBody({ rng, A, b, vars: V2, ask: 'all', intro: 'Resuelve con la REGLA DE CRAMER:', steps })
}

// ───────────── Módulos 3×3 ─────────────

function mod8(rng: Rng, i: number, diff: Difficulty): Body {
  if (i % 5 === 4) {
    const target = i === 4 ? 'incompatible' : i === 9 ? 'indeterminado' : rng.pick(['incompatible', 'indeterminado'] as const)
    const { A, b } = genClassified(rng, 3, target)
    return systemBody({ rng, A, b, vars: V3, ask: 'class', intro: 'Clasifica el sistema 3×3:' })
  }
  const { A, b } = genSystem3(rng, diff)
  return systemBody({ rng, A, b, vars: V3, ask: 'all', intro: 'Resuelve el sistema 3×3 (Gauss-Jordan):' })
}

function genMatrix3(rng: Rng, diff: Difficulty, singular: boolean): Matrix {
  const r = [3, 5, 7][diff - 1]
  const M = [0, 1, 2].map(() => [0, 1, 2].map(() => rng.int(-r, r)))
  if (singular) M[2] = M[0].map((v, j) => v + M[1][j])
  return M
}

function mod9(rng: Rng, i: number, diff: Difficulty): Body {
  const M = genMatrix3(rng, diff, i % 7 === 6)
  const [m1, m2, m3] = [0, 1, 2].map((j) => det2(minor(M, 0, j)))
  const steps = [
    'Desarrollo por cofactores de la fila 1: det = a11·M11 − a12·M12 + a13·M13.',
    `M11 = ${det2(minor(M, 0, 0))}, M12 = ${det2(minor(M, 0, 1))}, M13 = ${det2(minor(M, 0, 2))}.`,
    `det = ${P(M[0][0])}·${P(m1)} − ${P(M[0][1])}·${P(m2)} + ${P(M[0][2])}·${P(m3)} = ${det3(M)}.`,
  ]
  const { plus, minus } = sarrusProducts(M)
  return detBody(rng, M, steps, [], [sumOf(plus) + sumOf(minus), M[0][0] * m1 + M[0][1] * m2 + M[0][2] * m3])
}

function mod10(rng: Rng, i: number, diff: Difficulty): Body {
  const M = genMatrix3(rng, diff, i % 7 === 6)
  const { plus, minus } = sarrusProducts(M)
  const steps = [
    'Sarrus: se suman los productos de las diagonales descendentes y se restan los de las ascendentes.',
    `Descendentes: ${plus.map(P).join(' + ')} = ${sumOf(plus)}.`,
    `Ascendentes: ${minus.map(P).join(' + ')} = ${sumOf(minus)}.`,
    `det = ${sumOf(plus)} − ${P(sumOf(minus))} = ${det3(M)}.`,
  ]
  return {
    ...detBody(rng, M, steps, [], [sumOf(plus) + sumOf(minus), sumOf(minus) - sumOf(plus)]),
    statement: `Calcula con el método de SARRUS:\n${M.map((r) => `| ${r.join('   ')} |`).join('\n')}`,
  }
}

function mod11(rng: Rng, i: number, diff: Difficulty): Body {
  if (i === 14) {
    const { A, b } = genClassified(rng, 3, rng.pick(['incompatible', 'indeterminado'] as const))
    const steps = [`D = ${det3(A)}.`, 'Como D = 0, no hay solución única y Cramer no se puede aplicar.']
    return systemBody({ rng, A, b, vars: V3, ask: 'cramer', intro: '¿Qué indica la regla de Cramer en este sistema?', steps })
  }
  const { A, b } = genSystem3(rng, diff)
  const cr = cramer(A, b)
  const names = ['Dx', 'Dy', 'Dz']
  const steps = [
    `D = ${cr.D} (determinante de los coeficientes, por Sarrus).`,
    ...cr.dets.map((d, j) => `${names[j]} = ${d} (columna ${j + 1} ← términos independientes: ${JSON.stringify(replaceColumn(A, j, b))}).`),
    `x = ${cr.dets[0]}/${P(cr.D)} = ${fmt(cr.solution![0])};  y = ${cr.dets[1]}/${P(cr.D)} = ${fmt(cr.solution![1])};  z = ${cr.dets[2]}/${P(cr.D)} = ${fmt(cr.solution![2])}.`,
  ]
  return systemBody({ rng, A, b, vars: V3, ask: 'all', intro: 'Resuelve con la REGLA DE CRAMER 3×3:', steps })
}

function mod12(rng: Rng, i: number, diff: Difficulty): Body {
  let A: Matrix, b: number[], defs: string[], text: string, target: number
  if (i % 2 === 0) {
    const sets = [['café', 'jugo', 'sándwich'], ['cuaderno', 'lápiz', 'borrador'], ['manzana', 'pera', 'banana']]
    const items = rng.pick(sets)
    for (;;) {
      A = [0, 1, 2].map(() => [0, 1, 2].map(() => rng.int(1, 3 + diff)))
      if (det3(A) !== 0) break
    }
    const prices = [rng.int(2, 9 + diff), rng.int(2, 9 + diff), rng.int(2, 9 + diff)]
    b = A.map((r) => r[0] * prices[0] + r[1] * prices[1] + r[2] * prices[2])
    target = rng.int(0, 2)
    defs = items.map((it, k) => `${V3[k]} = precio de un ${it}`)
    const order = (r: number[]) => `${r[0]} ${items[0]}(s), ${r[1]} ${items[1]}(s) y ${r[2]} ${items[2]}(s)`
    text = `Tres pedidos: el pedido 1 (${order(A[0])}) cuesta $${b[0]}; el pedido 2 (${order(A[1])}) cuesta $${b[1]}; el pedido 3 (${order(A[2])}) cuesta $${b[2]}. ¿Cuánto cuesta un ${items[target]}?`
  } else {
    const s = [rng.int(1, 12 + diff * 3), rng.int(1, 12 + diff * 3), rng.int(1, 12 + diff * 3)]
    A = [[1, 1, 1], [1, -1, 0], [0, 1, -1]]
    b = [s[0] + s[1] + s[2], s[0] - s[1], s[1] - s[2]]
    target = rng.int(0, 2)
    const ord = ['primero', 'segundo', 'tercero']
    defs = ['x = primer número', 'y = segundo número', 'z = tercer número']
    text = `Tres números suman ${b[0]}. El primero menos el segundo es ${b[1]} y el segundo menos el tercero es ${b[2]}. ¿Cuál es el ${ord[target]}?`
  }
  const cr = cramer(A, b)
  const steps = [
    `Definimos las incógnitas: ${defs.join('; ')}.`,
    'Planteamos el sistema:',
    ...A.map((row, k) => equation(row, V3, b[k])),
    `Cramer: D = ${cr.D}, Dx = ${cr.dets[0]}, Dy = ${cr.dets[1]}, Dz = ${cr.dets[2]}.`,
    `x = ${fmt(cr.solution![0])}, y = ${fmt(cr.solution![1])}, z = ${fmt(cr.solution![2])}.`,
  ]
  const body = systemBody({ rng, A, b, vars: V3, ask: target, intro: '', steps, statementOverride: text })
  return { ...body, latex: systemLatex(A, b, V3) }
}

const GENERATORS: Record<ModuleId, (rng: Rng, i: number, d: Difficulty) => Body> = {
  1: mod1, 2: mod2, 3: mod3, 4: mod4, 5: mod5, 6: mod6, 7: mod7, 8: mod8, 9: mod9, 10: mod10, 11: mod11, 12: mod12,
}

/** Genera un ejercicio reproducible: misma semilla ⇒ mismo ejercicio. `index` solo varía casos especiales. */
export function generateExercise(moduleId: ModuleId, seed: number, difficulty: Difficulty = 1, index = 0): Exercise {
  const rng = createRng(seed * 7919 + moduleId * 104729)
  const body = GENERATORS[moduleId](rng, index, difficulty)
  return { id: `m${moduleId}-s${seed}`, moduleId, difficulty, seed, ...body }
}

