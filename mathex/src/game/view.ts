import { currentExercise, currentPlayerIndex, handoffTarget, timeLeftMs } from './match.ts'
import type { MatchState, Phase, RoundRecord } from './types.ts'

export interface PublicView {
  phase: Phase
  round: number
  totalRounds: number
  players: { name: string; life: number; score: number }[]
  /** Solo en 'handoff': a quién se entrega el dispositivo. */
  handoffTo?: string
  handoffMessage?: string
  /** Solo en 'turn': pregunta actual SIN respuesta correcta ni explicación. */
  question?: { statement: string; latex?: string; options: { text: string; index: number; hidden: boolean }[] }
  activePlayer?: string
  timeLeftMs?: number
  /** Solo en 'roundResult' y 'finished': ahora sí se revela todo. */
  reveal?: { record: RoundRecord; correctAnswers: [string, string]; explanations: [string, string]; steps: [string[], string[]] }
}

/**
 * Única fuente de datos para la interfaz. En 'handoff' no incluye NADA de la pregunta anterior
 * (ni enunciado, opciones, respuesta, pasos o explicación). Durante el turno no incluye la respuesta correcta.
 */
export function getPublicView(s: MatchState, now: number): PublicView {
  const base: PublicView = {
    phase: s.phase, round: s.round + 1, totalRounds: s.config.rounds,
    players: s.players.map((p) => ({ name: p.name, life: p.life, score: p.score })),
  }
  if (s.phase === 'handoff') {
    const name = s.players[handoffTarget(s)].name
    return { ...base, handoffTo: name, handoffMessage: `Turno finalizado. Entrega el dispositivo a ${name}.` }
  }
  if (s.phase === 'turn') {
    const ex = currentExercise(s)
    const hidden = s.players[currentPlayerIndex(s)].hiddenOptions
    return {
      ...base,
      activePlayer: s.players[currentPlayerIndex(s)].name,
      timeLeftMs: timeLeftMs(s, now),
      question: { statement: ex.statement, latex: ex.latex, options: ex.options.map((text, index) => ({ text, index, hidden: hidden.includes(index) })) },
    }
  }
  const record = s.history[s.history.length - 1]
  const [e0, e1] = s.exercises[record.round]
  return {
    ...base,
    reveal: {
      record,
      correctAnswers: [e0.options[e0.correctIndex], e1.options[e1.correctIndex]],
      explanations: [e0.explanation, e1.explanation],
      steps: [e0.steps, e1.steps],
    },
  }
}
