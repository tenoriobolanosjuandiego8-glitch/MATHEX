import type { Matrix } from './linear.ts'

export function linearExpr(coefs: number[], vars: string[]): string {
  let out = ''
  coefs.forEach((c, i) => {
    if (c === 0) return
    const body = (Math.abs(c) === 1 ? '' : String(Math.abs(c))) + vars[i]
    out += out === '' ? (c < 0 ? '-' : '') + body : (c < 0 ? ' - ' : ' + ') + body
  })
  return out === '' ? '0' : out
}

export const equation = (coefs: number[], vars: string[], rhs: number): string => `${linearExpr(coefs, vars)} = ${rhs}`

export function systemText(a: Matrix, b: number[], vars: string[]): string {
  return a.map((row, i) => equation(row, vars, b[i])).join('\n')
}

export function systemLatex(a: Matrix, b: number[], vars: string[]): string {
  return `\\begin{cases} ${a.map((row, i) => equation(row, vars, b[i])).join(' \\\\ ')} \\end{cases}`
}

export function matrixLatex(m: Matrix): string {
  return `\\begin{vmatrix} ${m.map((r) => r.join(' & ')).join(' \\\\ ')} \\end{vmatrix}`
}
