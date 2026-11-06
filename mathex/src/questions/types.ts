import type { Frac } from '../math/fraction.ts'
import type { Classification, Matrix } from '../math/linear.ts'

export type Difficulty = 1 | 2 | 3
export type ModuleId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

/** Qué se pregunta en un sistema: todas las incógnitas, una sola, su clasificación o si aplica Cramer. */
export type SystemAsk = 'all' | 'class' | 'cramer' | number

/** Datos con los que se puede volver a verificar el ejercicio de forma independiente. */
export type ExerciseCheck =
  | {
      kind: 'system'
      A: Matrix
      b: number[]
      vars: string[]
      cls: Classification
      solution: Frac[] | null
      ask: SystemAsk
    }
  | { kind: 'determinant'; matrix: Matrix; value: number }

export interface Exercise {
  id: string
  moduleId: ModuleId
  difficulty: Difficulty
  seed: number
  statement: string
  latex?: string
  options: string[]
  correctIndex: number
  steps: string[]
  explanation: string
  check: ExerciseCheck
}

export interface ModuleInfo {
  id: ModuleId
  level: 1 | 2
  name: string
  description: string
  difficulty: Difficulty
  theory: string
}
