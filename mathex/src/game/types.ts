import type { Exercise, ModuleId } from '../questions/types.ts'
import type { GameConfig } from './config.ts'

export type PlayerIndex = 0 | 1
export type Phase = 'handoff' | 'turn' | 'roundResult' | 'finished'

export interface PlayerState {
  name: string
  life: number
  score: number
  streak: number
  shieldUsesLeft: number
  hintUsesLeft: number
  attackUsesLeft: number
  /** Estado del turno en curso. */
  shieldActive: boolean
  comboActive: boolean
  hintUsedThisTurn: boolean
  attackUsedThisTurn: boolean
  hiddenOptions: number[]
  underAttack: boolean
}

export interface TurnResult {
  playerIndex: PlayerIndex
  exerciseId: string
  selected: number | null
  correct: boolean
  timedOut: boolean
  elapsedMs: number
  points: number
  speedBonus: number
  comboBonus: number
  usedHint: boolean
  shielded: boolean
}

export interface RoundRecord {
  round: number
  turns: [TurnResult, TurnResult]
  winner: PlayerIndex | null
  lifeLost: [number, number]
}

export interface MatchState {
  config: GameConfig
  moduleIds: ModuleId[]
  seed: number
  players: [PlayerState, PlayerState]
  exercises: [Exercise, Exercise][]
  round: number
  order: [PlayerIndex, PlayerIndex]
  turnPos: 0 | 1
  phase: Phase
  startedAt: number | null
  currentLimitMs: number
  pendingAttack: [boolean, boolean]
  turnResults: [TurnResult | null, TurnResult | null]
  history: RoundRecord[]
  winner: PlayerIndex | 'draw' | null
}
