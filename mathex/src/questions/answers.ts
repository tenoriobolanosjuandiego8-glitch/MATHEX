import { fmt } from '../math/fraction.ts'
import type { ExerciseCheck } from './types.ts'
import { CLASS_LABEL } from '../math/linear.ts'

export const CRAMER_OPTIONS = [
  'Solución única (D ≠ 0)',
  'No hay solución única (D = 0)',
  'Siempre incompatible',
  'Siempre indeterminado',
]

/** Texto de la respuesta correcta, calculado desde los datos verificables. */
export function answerText(check: ExerciseCheck): string {
  if (check.kind === 'determinant') return String(check.value)
  if (check.ask === 'class') return CLASS_LABEL[check.cls]
  if (check.ask === 'cramer') return check.solution ? CRAMER_OPTIONS[0] : CRAMER_OPTIONS[1]
  const sol = check.solution
  if (!sol) throw new Error('El ejercicio no tiene solución única')
  if (check.ask === 'all') return check.vars.map((v, i) => `${v} = ${fmt(sol[i])}`).join(', ')
  return fmt(sol[check.ask])
}
