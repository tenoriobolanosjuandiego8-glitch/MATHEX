import { describe, expect, it } from 'vitest'
import { buildConfig, DEFAULT_CONFIG } from '../game/config.ts'
import {
  acknowledgeHandoff, advanceRound, createMatch, currentExercise, currentPlayerIndex, submitAnswer, timeoutTurn, timeLeftMs, usePower,
} from '../game/match.ts'
import { calculateTurnPoints, turnLimitMs } from '../game/scoring.ts'
import type { MatchState } from '../game/types.ts'
import { getPublicView } from '../game/view.ts'
import { computeRecords, HISTORY_KEY, loadHistory, saveMatch, summarizeMatch, type KeyValueStorage } from '../services/storage.ts'

type Kind = 'ok' | 'bad' | 'timeout'
const T0 = 100_000

const newMatch = (config = {}, seed = 7) => createMatch({ names: ['Ana', 'Luis'], moduleIds: [1, 6, 7], seed, config })
const wrongIndex = (s: MatchState): number => {
  const ex = currentExercise(s)
  return ex.options.findIndex((_, i) => i !== ex.correctIndex)
}

/** Juega un turno completo: transición, espera `elapsedMs` y responde. */
function playTurn(s: MatchState, kind: Kind, elapsedMs: number): MatchState {
  let st = acknowledgeHandoff(s, T0)
  if (kind === 'timeout') return timeoutTurn(st, T0 + st.currentLimitMs + 1)
  const idx = kind === 'ok' ? currentExercise(st).correctIndex : wrongIndex(st)
  st = submitAnswer(st, idx, T0 + elapsedMs)
  return st
}

/** Juega una ronda: kinds[i] es lo que hace el jugador i. */
function playRound(s: MatchState, kinds: [Kind, Kind], elapsed: [number, number] = [1000, 2000]): MatchState {
  let st = s
  for (let k = 0; k < 2; k++) {
    const pi = currentPlayerIndex(st)
    st = playTurn(st, kinds[pi], elapsed[pi])
  }
  return st
}

describe('configuración y puntuación', () => {
  it('la partida estándar coincide con las reglas pedidas', () => {
    expect(DEFAULT_CONFIG.rounds).toBe(10)
    expect(DEFAULT_CONFIG.secondsPerQuestion).toBe(30)
    expect(DEFAULT_CONFIG.pointsPerCorrect).toBe(100)
    expect(DEFAULT_CONFIG.speedBonus).toBe(25)
    expect(DEFAULT_CONFIG.startingLife).toBe(100)
    expect(DEFAULT_CONFIG.lifeLoss).toBe(10)
  })
  it('valida configuraciones inválidas', () => {
    expect(() => buildConfig({ rounds: 0 })).toThrow()
    expect(() => buildConfig({ secondsPerQuestion: 3 })).toThrow()
    expect(buildConfig({ secondsPerQuestion: 45 }).secondsPerQuestion).toBe(45)
  })
  it('puntos: acierto rápido, acierto lento, error, pista y combo', () => {
    const c = DEFAULT_CONFIG
    const base = { elapsedMs: 5000, limitMs: 30000, usedHint: false, comboActive: false }
    expect(calculateTurnPoints({ ...base, correct: true }, c).total).toBe(125)
    expect(calculateTurnPoints({ ...base, correct: true, elapsedMs: 20000 }, c).total).toBe(100)
    expect(calculateTurnPoints({ ...base, correct: false }, c).total).toBe(0)
    expect(calculateTurnPoints({ ...base, correct: true, usedHint: true }, c).total).toBe(100)
    expect(calculateTurnPoints({ ...base, correct: true, comboActive: true }, c).total).toBe(175)
  })
  it('temporizador: límite normal, con ataque y mínimo', () => {
    expect(turnLimitMs(DEFAULT_CONFIG, false)).toBe(30000)
    expect(turnLimitMs(DEFAULT_CONFIG, true)).toBe(25000)
    expect(turnLimitMs({ ...DEFAULT_CONFIG, secondsPerQuestion: 10 }, true)).toBe(5000)
  })
})

describe('flujo de la partida', () => {
  it('empieza en transición y el turno arranca al confirmar', () => {
    const s = newMatch()
    expect(s.phase).toBe('handoff')
    const t = acknowledgeHandoff(s, T0)
    expect(t.phase).toBe('turn')
    expect(timeLeftMs(t, T0 + 10_000)).toBe(20_000)
    expect(timeLeftMs(t, T0 + 99_000)).toBe(0)
  })
  it('acierto rápido suma 125, cambia de turno y no permite responder dos veces', () => {
    let s = acknowledgeHandoff(newMatch(), T0)
    const first = currentPlayerIndex(s)
    s = submitAnswer(s, currentExercise(s).correctIndex, T0 + 1000)
    expect(s.players[first].score).toBe(125)
    expect(s.phase).toBe('handoff')
    expect(currentPlayerIndex(s)).not.toBe(first)
    const again = submitAnswer(s, 0, T0 + 1500)
    expect(again).toEqual(s)
    expect(s.players[first].score).toBe(125)
  })
  it('no admite respuestas fuera de rango ni respuestas con la fase equivocada', () => {
    const s = acknowledgeHandoff(newMatch(), T0)
    expect(submitAnswer(s, 9, T0 + 100)).toEqual(s)
    expect(submitAnswer(s, -1, T0 + 100)).toEqual(s)
    expect(submitAnswer(newMatch(), 0, T0)).toEqual(newMatch())
  })
  it('un jugador acierta y el otro falla: gana el que acierta y el otro pierde 10 de vida', () => {
    const s = playRound(newMatch(), ['ok', 'bad'])
    expect(s.phase).toBe('roundResult')
    const r = s.history[0]
    expect(r.winner).toBe(0)
    expect(r.lifeLost).toEqual([0, 10])
    expect(s.players[1].life).toBe(90)
    expect(s.players[0].life).toBe(100)
  })
  it('ambos aciertan: gana el más rápido y nadie pierde vida', () => {
    const s = playRound(newMatch(), ['ok', 'ok'], [4000, 2000])
    expect(s.history[0].winner).toBe(1)
    expect(s.history[0].lifeLost).toEqual([0, 0])
  })
  it('ambos fallan: ambos pierden vida y no hay ganador de ronda', () => {
    const s = playRound(newMatch(), ['bad', 'timeout'])
    expect(s.history[0].winner).toBeNull()
    expect(s.players.map((p) => p.life)).toEqual([90, 90])
  })
  it('el tiempo agotado cuenta como fallo, sin puntos; responder tarde también', () => {
    let s = acknowledgeHandoff(newMatch(), T0)
    expect(timeoutTurn(s, T0 + 1000)).toEqual(s)
    const late = submitAnswer(s, currentExercise(s).correctIndex, T0 + 31_000)
    const pi = currentPlayerIndex(s)
    expect(late.turnResults[pi]!.timedOut).toBeTruthy()
    expect(late.players[pi].score).toBe(0)
    s = timeoutTurn(s, T0 + 30_001)
    expect(s.turnResults[pi]!.correct).toBeFalsy()
  })
  it('alterna quién empieza cada ronda y avanza de ronda', () => {
    let s = newMatch()
    expect(s.order).toEqual([0, 1])
    s = advanceRound(playRound(s, ['ok', 'ok']))
    expect(s.round).toBe(1)
    expect(s.order).toEqual([1, 0])
    expect(s.phase).toBe('handoff')
    expect(s.turnResults).toEqual([null, null])
  })
  it('cada jugador recibe un ejercicio distinto en cada ronda', () => {
    const s = newMatch()
    for (const [a, b] of s.exercises) expect(a.statement).not.toBe(b.statement)
  })
  it('partida completa de 10 rondas: termina y decide ganador por puntaje', () => {
    let s = newMatch()
    for (let r = 0; r < 10; r++) {
      expect(s.phase).toBe('handoff')
      s = advanceRound(playRound(s, ['ok', r % 2 === 0 ? 'bad' : 'ok'], [1000, 3000]))
    }
    expect(s.phase).toBe('finished')
    expect(s.history).toHaveLength(10)
    expect(s.winner).toBe(0)
    expect(s.players[0].score).toBeGreaterThan(s.players[1].score)
  })
  it('termina antes si la vida de un jugador llega a 0', () => {
    let s = createMatch({ names: ['Ana', 'Luis'], moduleIds: [6], seed: 3, config: { startingLife: 10 } })
    s = advanceRound(playRound(s, ['ok', 'bad']))
    expect(s.phase).toBe('finished')
    expect(s.winner).toBe(0)
    expect(s.players[1].life).toBe(0)
  })
  it('es reproducible: misma semilla ⇒ mismos ejercicios', () => {
    expect(newMatch({}, 5).exercises).toEqual(newMatch({}, 5).exercises)
  })
})

describe('poderes', () => {
  it('ESCUDO evita la pérdida de vida al fallar y tiene un solo uso', () => {
    let s = acknowledgeHandoff(newMatch(), T0)
    const pi = currentPlayerIndex(s)
    s = usePower(s, 'shield', T0 + 100)
    expect(s.players[pi].shieldActive).toBeTruthy()
    expect(s.players[pi].shieldUsesLeft).toBe(0)
    expect(usePower(s, 'shield', T0 + 200)).toEqual(s)
    s = submitAnswer(s, wrongIndex(s), T0 + 500)
    s = playTurn(s, 'ok', 1000)
    expect(s.history[0].lifeLost[pi]).toBe(0)
    expect(s.players[pi].life).toBe(100)
    // ronda 2 (empieza el jugador 1): el jugador 0 ya gastó su único escudo
    s = advanceRound(s)
    s = playTurn(s, 'ok', 1000)
    s = acknowledgeHandoff(s, T0)
    expect(currentPlayerIndex(s)).toBe(pi)
    expect(usePower(s, 'shield', T0 + 50)).toEqual(s)
  })
  it('PISTA oculta 2 opciones incorrectas, no se pueden elegir y quita el bono de rapidez', () => {
    let s = acknowledgeHandoff(newMatch(), T0)
    const pi = currentPlayerIndex(s)
    const ex = currentExercise(s)
    s = usePower(s, 'hint', T0 + 100)
    const hidden = s.players[pi].hiddenOptions
    expect(hidden).toHaveLength(2)
    expect(hidden.includes(ex.correctIndex)).toBeFalsy()
    const blocked = submitAnswer(s, hidden[0], T0 + 200)
    expect(blocked).toEqual(s)
    expect(usePower(s, 'hint', T0 + 300)).toEqual(s)
    expect(getPublicView(s, T0 + 300).question!.options.filter((o) => o.hidden)).toHaveLength(2)
    s = submitAnswer(s, ex.correctIndex, T0 + 400)
    expect(s.players[pi].score).toBe(100)
  })
  it('PISTA tiene un máximo de 2 usos por jugador y por partida', () => {
    let s = createMatch({ names: ['A', 'B'], moduleIds: [6], seed: 9, config: { rounds: 4 } })
    const used = [0, 0]
    for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 2; k++) {
        s = acknowledgeHandoff(s, T0)
        const pi = currentPlayerIndex(s)
        const before = s.players[pi].hintUsesLeft
        s = usePower(s, 'hint', T0 + 10)
        if (s.players[pi].hintUsesLeft < before) used[pi]++
        s = submitAnswer(s, currentExercise(s).correctIndex, T0 + 900)
      }
      s = advanceRound(s)
    }
    expect(used).toEqual([2, 2])
    expect(s.players[0].hintUsesLeft).toBe(0)
    expect(s.players[1].hintUsesLeft).toBe(0)
  })
  it('COMBO no está disponible sin racha, y con racha de 3 da +50 y consume la racha', () => {
    let s = newMatch()
    s = acknowledgeHandoff(s, T0)
    expect(usePower(s, 'combo', T0 + 10)).toEqual(s)
    s = newMatch()
    for (let r = 0; r < 3; r++) s = advanceRound(playRound(s, ['ok', 'ok'], [20_000, 21_000]))
    expect(s.players[0].streak).toBe(3)
    const before = s.players[0].score
    // en la ronda 4 empieza el jugador 1 (orden alterno): juega su turno y luego el 0 usa combo
    s = playTurn(s, 'ok', 20_000)
    s = acknowledgeHandoff(s, T0)
    s = usePower(s, 'combo', T0 + 10)
    expect(s.players[0].comboActive).toBeTruthy()
    s = submitAnswer(s, currentExercise(s).correctIndex, T0 + 20_000)
    expect(s.players[0].score - before).toBe(150)
    expect(s.players[0].streak).toBe(0)
  })
  it('ATAQUE resta 5 s al rival en su próximo turno y tiene 2 usos', () => {
    let s = acknowledgeHandoff(newMatch(), T0)
    const attacker = currentPlayerIndex(s)
    s = usePower(s, 'attack', T0 + 10)
    expect(s.players[attacker].attackUsesLeft).toBe(1)
    expect(usePower(s, 'attack', T0 + 20)).toEqual(s)
    s = submitAnswer(s, currentExercise(s).correctIndex, T0 + 1000)
    s = acknowledgeHandoff(s, T0)
    expect(s.currentLimitMs).toBe(25_000)
    expect(s.players[currentPlayerIndex(s)].underAttack).toBeTruthy()
  })
})

describe('privacidad entre turnos', () => {
  it('la pantalla de transición no contiene nada de la pregunta anterior', () => {
    let s = acknowledgeHandoff(newMatch(), T0)
    const ex = currentExercise(s)
    s = submitAnswer(s, ex.correctIndex, T0 + 1000)
    const view = getPublicView(s, T0 + 1500)
    const json = JSON.stringify(view)
    expect(view.phase).toBe('handoff')
    expect(view.question).toBe(undefined)
    expect(json).not.toContain(ex.statement)
    expect(json).not.toContain(ex.explanation)
    for (const o of ex.options) expect(json).not.toContain(JSON.stringify(o))
    for (const step of ex.steps) expect(json).not.toContain(JSON.stringify(step))
    expect(json).not.toContain('correctIndex')
    expect(view.handoffMessage!.startsWith('Turno finalizado. Entrega el dispositivo')).toBeTruthy()
  })
  it('durante el turno no se expone la respuesta ni la explicación', () => {
    const s = acknowledgeHandoff(newMatch(), T0)
    const json = JSON.stringify(getPublicView(s, T0 + 100))
    expect(json).not.toContain('correctIndex')
    expect(json).not.toContain(JSON.stringify(currentExercise(s).explanation))
  })
  it('al terminar la ronda se revelan respuestas y explicaciones', () => {
    const s = playRound(newMatch(), ['ok', 'bad'])
    const v = getPublicView(s, T0)
    expect(v.phase).toBe('roundResult')
    expect(v.reveal!.correctAnswers[0]).toBe(s.exercises[0][0].options[s.exercises[0][0].correctIndex])
    expect(v.reveal!.explanations[1].length).toBeGreaterThan(5)
  })
})

describe('historial y récords', () => {
  const memory = (): KeyValueStorage & { data: Record<string, string> } => {
    const data: Record<string, string> = {}
    return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v } }
  }
  const finished = (seed: number) => {
    let s = createMatch({ names: ['Ana', 'Luis'], moduleIds: [6], seed, config: { rounds: 2 } })
    for (let r = 0; r < 2; r++) s = advanceRound(playRound(s, ['ok', 'bad']))
    return s
  }
  it('guarda, recarga y evita duplicados', () => {
    const st = memory()
    const sum = summarizeMatch(finished(1), 'p1', '2026-11-05T10:00:00Z')
    saveMatch(st, sum)
    saveMatch(st, sum)
    saveMatch(st, summarizeMatch(finished(2), 'p2', '2026-11-05T11:00:00Z'))
    const h = loadHistory(st)
    expect(h).toHaveLength(2)
    expect(h[0].id).toBe('p2')
    expect(h[1].players[0].name).toBe('Ana')
  })
  it('tolera datos corruptos', () => {
    const st = memory()
    st.setItem(HISTORY_KEY, '{no es json')
    expect(loadHistory(st)).toEqual([])
    st.setItem(HISTORY_KEY, JSON.stringify([{ foo: 1 }]))
    expect(loadHistory(st)).toEqual([])
  })
  it('no resume partidas sin terminar', () => {
    expect(() => summarizeMatch(newMatch(), 'x', 'now')).toThrow()
  })
  it('calcula récords', () => {
    const st = memory()
    saveMatch(st, summarizeMatch(finished(1), 'p1', 'a'))
    saveMatch(st, summarizeMatch(finished(2), 'p2', 'b'))
    const rec = computeRecords(loadHistory(st))
    expect(rec.totalMatches).toBe(2)
    expect(rec.winsByPlayer['Ana']).toBe(2)
    expect(rec.bestScore!.name).toBe('Ana')
    expect(rec.bestScore!.score).toBeGreaterThan(0)
  })
})
