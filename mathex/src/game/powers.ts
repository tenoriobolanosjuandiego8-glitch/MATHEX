import { createRng } from '../math/rng.ts'
import type { Exercise } from '../questions/types.ts'
import type { GameConfig } from './config.ts'
import type { PlayerState } from './types.ts'

/** ESCUDO: se activa antes de responder; si el jugador falla, no pierde vida. Se gasta al activarlo. */
export function activateShield(p: PlayerState): PlayerState | null {
  if (p.shieldActive || p.shieldUsesLeft <= 0) return null
  return { ...p, shieldActive: true, shieldUsesLeft: p.shieldUsesLeft - 1 }
}

/** PISTA: oculta 2 opciones incorrectas. Quien la usa pierde el bono de rapidez de ese turno. */
export function activateHint(p: PlayerState, ex: Exercise): PlayerState | null {
  if (p.hintUsedThisTurn || p.hintUsesLeft <= 0) return null
  const wrong = ex.options.map((_, i) => i).filter((i) => i !== ex.correctIndex)
  const hidden = createRng(ex.seed + 17).shuffle(wrong).slice(0, 2).sort((a, b) => a - b)
  return { ...p, hintUsedThisTurn: true, hintUsesLeft: p.hintUsesLeft - 1, hiddenOptions: hidden }
}

/** COMBO: requiere una racha mínima de aciertos; si el jugador acierta recibe una bonificación y la racha se consume. */
export function activateCombo(p: PlayerState, cfg: GameConfig): PlayerState | null {
  if (p.comboActive || p.streak < cfg.comboStreakRequired) return null
  return { ...p, comboActive: true }
}

/** ATAQUE VISUAL: efecto sobre el rival y, además, le resta segundos en su próximo turno. */
export function activateAttack(attacker: PlayerState): PlayerState | null {
  if (attacker.attackUsedThisTurn || attacker.attackUsesLeft <= 0) return null
  return { ...attacker, attackUsedThisTurn: true, attackUsesLeft: attacker.attackUsesLeft - 1 }
}
