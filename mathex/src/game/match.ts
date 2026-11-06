import { createRng } from '../math/rng.ts'
import { generateExercise } from '../questions/generators.ts'
import type { Difficulty, Exercise, ModuleId } from '../questions/types.ts'
import { buildConfig, type GameConfig } from './config.ts'
import { activateAttack, activateCombo, activateHint, activateShield } from './powers.ts'
import { calculateTurnPoints, remainingMs, turnLimitMs } from './scoring.ts'
import type { MatchState, PlayerIndex, PlayerState, RoundRecord, TurnResult } from './types.ts'

export interface CreateMatchOptions {
  names: [string, string]
  moduleIds: ModuleId[]
  config?: Partial<GameConfig>
  seed: number
  /** Si se indica, todas las rondas usan esa dificultad; si no, sube con las rondas (1 → 2 → 3). */
  difficulty?: Difficulty
}

const newPlayer = (name: string, cfg: GameConfig): PlayerState => ({
  name, life: cfg.startingLife, score: 0, streak: 0,
  shieldUsesLeft: cfg.shieldUses, hintUsesLeft: cfg.hintUses, attackUsesLeft: cfg.attackUses,
  shieldActive: false, comboActive: false, hintUsedThisTurn: false, attackUsedThisTurn: false,
  hiddenOptions: [], underAttack: false,
})

const orderFor = (round: number): [PlayerIndex, PlayerIndex] => (round % 2 === 0 ? [0, 1] : [1, 0])

/**
 * Cada jugador recibe un ejercicio DISTINTO por ronda (mismo módulo y dificultad),
 * de modo que el segundo jugador no pueda aprovechar lo que vio el primero.
 */
export function createMatch(opts: CreateMatchOptions): MatchState {
  if (opts.moduleIds.length === 0) throw new RangeError('Selecciona al menos un módulo')
  const config = buildConfig(opts.config)
  const rng = createRng(opts.seed)
  const exercises: [Exercise, Exercise][] = []
  for (let r = 0; r < config.rounds; r++) {
    const moduleId = rng.pick(opts.moduleIds)
    const difficulty: Difficulty = opts.difficulty ?? (r < config.rounds * 0.3 ? 1 : r < config.rounds * 0.7 ? 2 : 3)
    const s1 = rng.int(1, 900000)
    let s2 = rng.int(1, 900000)
    const a = generateExercise(moduleId, s1, difficulty, r)
    let b = generateExercise(moduleId, s2, difficulty, r)
    while (b.statement === a.statement) b = generateExercise(moduleId, ++s2, difficulty, r)
    exercises.push([a, b])
  }
  return {
    config, moduleIds: [...opts.moduleIds], seed: opts.seed,
    players: [newPlayer(opts.names[0], config), newPlayer(opts.names[1], config)],
    exercises, round: 0, order: orderFor(0), turnPos: 0, phase: 'handoff', startedAt: null,
    currentLimitMs: config.secondsPerQuestion * 1000, pendingAttack: [false, false],
    turnResults: [null, null], history: [], winner: null,
  }
}

export const currentPlayerIndex = (s: MatchState): PlayerIndex => s.order[s.turnPos]
export const currentExercise = (s: MatchState): Exercise => s.exercises[s.round][currentPlayerIndex(s)]
export const timeLeftMs = (s: MatchState, now: number): number =>
  s.phase === 'turn' && s.startedAt !== null ? remainingMs(s.startedAt, s.currentLimitMs, now) : 0

/** El jugador que debe recibir el dispositivo cuando la fase es 'handoff'. */
export const handoffTarget = (s: MatchState): PlayerIndex => s.order[s.turnPos]

/** Comienza el turno del jugador actual (tras la pantalla de transición). */
export function acknowledgeHandoff(state: MatchState, now: number): MatchState {
  if (state.phase !== 'handoff') return state
  const s = structuredClone(state)
  const pi = currentPlayerIndex(s)
  const attacked = s.pendingAttack[pi]
  s.pendingAttack[pi] = false
  const p = s.players[pi]
  p.shieldActive = false
  p.comboActive = false
  p.hintUsedThisTurn = false
  p.attackUsedThisTurn = false
  p.hiddenOptions = []
  p.underAttack = attacked
  s.phase = 'turn'
  s.startedAt = now
  s.currentLimitMs = turnLimitMs(s.config, attacked)
  return s
}

type PowerName = 'shield' | 'hint' | 'combo' | 'attack'

/** Usa un poder durante el turno. Devuelve el mismo estado si no es posible. */
export function usePower(state: MatchState, power: PowerName, now: number): MatchState {
  if (state.phase !== 'turn' || state.turnResults[currentPlayerIndex(state)] || timeLeftMs(state, now) <= 0) return state
  const pi = currentPlayerIndex(state)
  const me = state.players[pi]
  let updated: PlayerState | null
  if (power === 'shield') updated = activateShield(me)
  else if (power === 'hint') updated = activateHint(me, currentExercise(state))
  else if (power === 'combo') updated = activateCombo(me, state.config)
  else updated = activateAttack(me)
  if (!updated) return state
  const s = structuredClone(state)
  s.players[pi] = updated
  if (power === 'attack') s.pendingAttack[pi === 0 ? 1 : 0] = true
  return s
}

function finishTurn(s: MatchState, pi: PlayerIndex, selected: number | null, correct: boolean, timedOut: boolean, elapsedMs: number): MatchState {
  const p = s.players[pi]
  const score = calculateTurnPoints({ correct, elapsedMs, limitMs: s.currentLimitMs, usedHint: p.hintUsedThisTurn, comboActive: p.comboActive }, s.config)
  const result: TurnResult = {
    playerIndex: pi, exerciseId: s.exercises[s.round][pi].id, selected, correct, timedOut, elapsedMs,
    points: score.total, speedBonus: score.speed, comboBonus: score.combo,
    usedHint: p.hintUsedThisTurn, shielded: p.shieldActive && !correct,
  }
  p.score += score.total
  p.streak = p.comboActive ? 0 : correct ? p.streak + 1 : 0
  p.comboActive = false
  p.shieldActive = false
  p.hiddenOptions = []
  s.turnResults[pi] = result
  s.startedAt = null
  if (s.turnPos === 0) {
    s.turnPos = 1
    s.phase = 'handoff'
    return s
  }
  return resolveRound(s)
}

function resolveRound(s: MatchState): MatchState {
  const [t0, t1] = s.turnResults as [TurnResult, TurnResult]
  const lifeLost: [number, number] = [0, 0]
  ;([t0, t1] as TurnResult[]).forEach((t, i) => {
    if (!t.correct && !t.shielded) lifeLost[i] = s.config.lifeLoss
  })
  let winner: PlayerIndex | null = null
  if (t0.correct && !t1.correct) winner = 0
  else if (t1.correct && !t0.correct) winner = 1
  else if (t0.correct && t1.correct && t0.elapsedMs !== t1.elapsedMs) winner = t0.elapsedMs < t1.elapsedMs ? 0 : 1
  s.players[0].life = Math.max(0, s.players[0].life - lifeLost[0])
  s.players[1].life = Math.max(0, s.players[1].life - lifeLost[1])
  const record: RoundRecord = { round: s.round, turns: [t0, t1], winner, lifeLost }
  s.history.push(record)
  s.phase = 'roundResult'
  return s
}

/** Responde con el índice de la opción. Ignora respuestas repetidas, fuera de turno o a opciones ocultas por la pista. */
export function submitAnswer(state: MatchState, optionIndex: number, now: number): MatchState {
  if (state.phase !== 'turn' || state.startedAt === null) return state
  const pi = currentPlayerIndex(state)
  if (state.turnResults[pi]) return state
  const ex = currentExercise(state)
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= ex.options.length) return state
  if (state.players[pi].hiddenOptions.includes(optionIndex)) return state
  const s = structuredClone(state)
  const elapsed = now - state.startedAt
  if (elapsed > s.currentLimitMs) return finishTurn(s, pi, null, false, true, s.currentLimitMs)
  return finishTurn(s, pi, optionIndex, optionIndex === ex.correctIndex, false, Math.max(0, elapsed))
}

/** Cierra el turno por tiempo agotado. No hace nada si todavía queda tiempo. */
export function timeoutTurn(state: MatchState, now: number): MatchState {
  if (state.phase !== 'turn' || state.startedAt === null) return state
  const pi = currentPlayerIndex(state)
  if (state.turnResults[pi] || timeLeftMs(state, now) > 0) return state
  return finishTurn(structuredClone(state), pi, null, false, true, state.currentLimitMs)
}

export function winnerOf(s: MatchState): PlayerIndex | 'draw' {
  const [a, b] = s.players
  if (a.life === 0 && b.life > 0) return 1
  if (b.life === 0 && a.life > 0) return 0
  if (a.score !== b.score) return a.score > b.score ? 0 : 1
  if (a.life !== b.life) return a.life > b.life ? 0 : 1
  return 'draw'
}

/** Pasa de los resultados de la ronda a la siguiente ronda o al final de la partida. */
export function advanceRound(state: MatchState): MatchState {
  if (state.phase !== 'roundResult') return state
  const s = structuredClone(state)
  const over = s.round + 1 >= s.config.rounds || s.players.some((p) => p.life <= 0)
  if (over) {
    s.phase = 'finished'
    s.winner = winnerOf(s)
    return s
  }
  s.round += 1
  s.order = orderFor(s.round)
  s.turnPos = 0
  s.turnResults = [null, null]
  s.phase = 'handoff'
  return s
}
