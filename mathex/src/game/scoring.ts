import type { GameConfig } from './config.ts'

export interface TurnScoreInput {
  correct: boolean
  elapsedMs: number
  limitMs: number
  usedHint: boolean
  comboActive: boolean
}

export interface TurnScore {
  base: number
  speed: number
  combo: number
  total: number
}

/** Puntos de un turno: solo suman las respuestas correctas. */
export function calculateTurnPoints(input: TurnScoreInput, cfg: GameConfig): TurnScore {
  if (!input.correct) return { base: 0, speed: 0, combo: 0, total: 0 }
  const base = cfg.pointsPerCorrect
  const fast = !input.usedHint && input.elapsedMs <= input.limitMs * cfg.speedBonusFraction
  const speed = fast ? cfg.speedBonus : 0
  const combo = input.comboActive ? cfg.comboBonus : 0
  return { base, speed, combo, total: base + speed + combo }
}

/** Tiempo límite del turno; nunca baja del mínimo configurado. */
export function turnLimitMs(cfg: GameConfig, attacked: boolean): number {
  const seconds = cfg.secondsPerQuestion - (attacked ? cfg.attackTimePenaltySeconds : 0)
  return Math.max(seconds, cfg.minSecondsPerQuestion) * 1000
}

export const remainingMs = (startedAt: number, limitMs: number, now: number): number => Math.max(0, limitMs - (now - startedAt))
