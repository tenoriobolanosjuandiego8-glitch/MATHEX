import { describe, expect, it } from 'vitest'
import { fmt } from '../math/fraction.ts'
import { classify, cramer, det2, det3, gaussJordan, satisfies } from '../math/linear.ts'
import { answerText } from '../questions/answers.ts'
import { buildBank, EXERCISES_PER_MODULE, MODULE_IDS } from '../questions/bank.ts'
import { generateExercise } from '../questions/generators.ts'
import { MODULES } from '../questions/modules.ts'

const bank = buildBank()

describe('banco de ejercicios', () => {
  it('tiene 12 módulos con metadatos y 15 ejercicios cada uno (180 en total)', () => {
    expect(MODULES).toHaveLength(12)
    expect(EXERCISES_PER_MODULE).toBeGreaterThanOrEqual(15)
    expect(bank).toHaveLength(180)
    for (const id of MODULE_IDS) expect(bank.filter((e) => e.moduleId === id)).toHaveLength(15)
  })
  it('ids únicos y enunciados distintos dentro de cada módulo', () => {
    expect(new Set(bank.map((e) => e.id)).size).toBe(180)
    for (const id of MODULE_IDS) {
      const s = bank.filter((e) => e.moduleId === id).map((e) => e.statement)
      expect(new Set(s).size).toBe(s.length)
    }
  })
  it('cada ejercicio tiene 4 opciones distintas, una correcta, pasos y explicación', () => {
    for (const e of bank) {
      expect(e.options).toHaveLength(4)
      expect(new Set(e.options).size).toBe(4)
      expect(e.correctIndex).toBeGreaterThanOrEqual(0)
      expect(e.options[e.correctIndex]).toBe(answerText(e.check))
      expect(e.steps.length).toBeGreaterThan(0)
      expect(e.explanation.length).toBeGreaterThan(5)
    }
  })
  it('la respuesta correcta se verifica de forma independiente (sustitución / recálculo)', () => {
    for (const e of bank) {
      const c = e.check
      if (c.kind === 'determinant') {
        const recomputed = c.matrix.length === 2 ? det2(c.matrix) : det3(c.matrix)
        expect(recomputed).toBe(c.value)
        continue
      }
      expect(classify(c.A, c.b)).toBe(c.cls)
      if (c.cls === 'determinado') {
        const sol = c.solution!
        expect(satisfies(c.A, c.b, sol)).toBeTruthy()
        expect(cramer(c.A, c.b).solution!.map(fmt)).toEqual(sol.map(fmt))
        expect(gaussJordan(c.A, c.b).solution!.map(fmt)).toEqual(sol.map(fmt))
      } else {
        expect(c.solution).toBeNull()
        expect(c.ask === 'class' || c.ask === 'cramer').toBeTruthy()
      }
    }
  })
  it('incluye casos especiales: incompatibles, indeterminados y D = 0', () => {
    const cls = bank.flatMap((e) => (e.check.kind === 'system' ? [e.check.cls] : []))
    expect(cls.includes('incompatible')).toBeTruthy()
    expect(cls.includes('indeterminado')).toBeTruthy()
    expect(bank.some((e) => e.check.kind === 'determinant' && e.check.value === 0)).toBeTruthy()
    expect(bank.some((e) => e.check.kind === 'system' && e.check.ask === 'cramer')).toBeTruthy()
    expect(bank.some((e) => e.check.kind === 'system' && e.check.solution?.some((s) => s.d !== 1))).toBeTruthy()
  })
  it('las soluciones de los problemas de aplicación tienen sentido (enteras)', () => {
    for (const e of bank.filter((x) => x.moduleId === 5 || x.moduleId === 12)) {
      if (e.check.kind === 'system' && e.check.solution) expect(e.check.solution.every((s) => s.d === 1)).toBeTruthy()
    }
  })
})

describe('generación procedural reproducible', () => {
  it('misma semilla ⇒ mismo ejercicio; semillas distintas ⇒ ejercicios distintos', () => {
    expect(generateExercise(8, 123, 2)).toEqual(generateExercise(8, 123, 2))
    expect(generateExercise(8, 123, 2).statement).not.toBe(generateExercise(8, 124, 2).statement)
  })
  it('2 000 ejercicios por módulo y dificultad son matemáticamente correctos', () => {
    for (const id of MODULE_IDS) {
      for (let seed = 1; seed <= 170; seed++) {
        for (const d of [1, 2, 3] as const) {
          const e = generateExercise(id, seed, d, seed % 15)
          expect(e.options[e.correctIndex]).toBe(answerText(e.check))
          expect(new Set(e.options).size).toBe(4)
          const c = e.check
          if (c.kind === 'system' && c.solution) expect(satisfies(c.A, c.b, c.solution)).toBeTruthy()
          if (c.kind === 'system') expect(classify(c.A, c.b)).toBe(c.cls)
        }
      }
    }
  })
})
