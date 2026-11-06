import { generateExercise } from './generators.ts'
import type { Difficulty, Exercise, ModuleId } from './types.ts'

export const EXERCISES_PER_MODULE = 15
export const MODULE_IDS: ModuleId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

const difficultyFor = (i: number): Difficulty => (i < 5 ? 1 : i < 10 ? 2 : 3)

/** Banco fijo y reproducible: 15 ejercicios por módulo, con semillas constantes. */
export function buildBank(): Exercise[] {
  const bank: Exercise[] = []
  for (const moduleId of MODULE_IDS) {
    for (let i = 0; i < EXERCISES_PER_MODULE; i++) {
      const ex = generateExercise(moduleId, moduleId * 1000 + i + 1, difficultyFor(i), i)
      bank.push({ ...ex, id: `m${moduleId}-${String(i + 1).padStart(2, '0')}` })
    }
  }
  return bank
}

export const getModuleExercises = (bank: Exercise[], moduleId: ModuleId): Exercise[] => bank.filter((e) => e.moduleId === moduleId)
