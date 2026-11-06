import type { MatchState, PlayerIndex } from '../game/types.ts'

/** Subconjunto de la API de Storage; permite usar localStorage o una versión en memoria en pruebas. */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const HISTORY_KEY = 'mathex-arena:history:v1'
export const MAX_HISTORY = 100

export interface MatchSummary {
  id: string
  finishedAt: string
  players: [{ name: string; score: number; life: number }, { name: string; score: number; life: number }]
  winner: PlayerIndex | 'draw'
  rounds: number
  moduleIds: number[]
}

export function summarizeMatch(s: MatchState, id: string, finishedAt: string): MatchSummary {
  if (s.phase !== 'finished' || s.winner === null) throw new Error('La partida aún no terminó')
  const [a, b] = s.players
  return {
    id, finishedAt,
    players: [{ name: a.name, score: a.score, life: a.life }, { name: b.name, score: b.score, life: b.life }],
    winner: s.winner, rounds: s.history.length, moduleIds: [...s.moduleIds],
  }
}

function isSummary(x: unknown): x is MatchSummary {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  const okPlayer = (p: unknown) => {
    if (typeof p !== 'object' || p === null) return false
    const q = p as Record<string, unknown>
    return typeof q.name === 'string' && typeof q.score === 'number' && typeof q.life === 'number'
  }
  return (
    typeof o.id === 'string' && typeof o.finishedAt === 'string' && Array.isArray(o.players) && o.players.length === 2 &&
    o.players.every(okPlayer) && (o.winner === 0 || o.winner === 1 || o.winner === 'draw') &&
    typeof o.rounds === 'number' && Array.isArray(o.moduleIds)
  )
}

/** Lee el historial; si los datos están corruptos devuelve lo válido en vez de romper el juego. */
export function loadHistory(storage: KeyValueStorage): MatchSummary[] {
  try {
    const raw = storage.getItem(HISTORY_KEY)
    if (!raw) return []
    const data: unknown = JSON.parse(raw)
    return Array.isArray(data) ? data.filter(isSummary) : []
  } catch {
    return []
  }
}

/** Guarda la partida (la más reciente primero). Evita duplicados por id. */
export function saveMatch(storage: KeyValueStorage, summary: MatchSummary): MatchSummary[] {
  const history = [summary, ...loadHistory(storage).filter((m) => m.id !== summary.id)].slice(0, MAX_HISTORY)
  storage.setItem(HISTORY_KEY, JSON.stringify(history))
  return history
}

export interface Records {
  totalMatches: number
  bestScore: { name: string; score: number } | null
  winsByPlayer: Record<string, number>
  draws: number
}

export function computeRecords(history: MatchSummary[]): Records {
  const rec: Records = { totalMatches: history.length, bestScore: null, winsByPlayer: {}, draws: 0 }
  for (const m of history) {
    for (const p of m.players) if (!rec.bestScore || p.score > rec.bestScore.score) rec.bestScore = { name: p.name, score: p.score }
    if (m.winner === 'draw') rec.draws++
    else {
      const name = m.players[m.winner].name
      rec.winsByPlayer[name] = (rec.winsByPlayer[name] ?? 0) + 1
    }
  }
  return rec
}
