/** Generador pseudoaleatorio reproducible (mulberry32). */
export interface Rng {
  next(): number
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  shuffle<T>(items: readonly T[]): T[]
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1))
  return {
    next,
    int,
    pick: (items) => items[int(0, items.length - 1)],
    shuffle: (items) => {
      const a = [...items]
      for (let i = a.length - 1; i > 0; i--) {
        const j = int(0, i)
        const t = a[i]
        a[i] = a[j]
        a[j] = t
      }
      return a
    },
  }
}
