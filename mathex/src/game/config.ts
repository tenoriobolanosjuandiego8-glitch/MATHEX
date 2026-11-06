export interface GameConfig {
  rounds: number
  secondsPerQuestion: number
  pointsPerCorrect: number
  speedBonus: number
  /** Fracción del tiempo dentro de la cual una respuesta correcta gana el bono de rapidez. */
  speedBonusFraction: number
  startingLife: number
  lifeLoss: number
  comboStreakRequired: number
  comboBonus: number
  shieldUses: number
  hintUses: number
  attackUses: number
  attackTimePenaltySeconds: number
  minSecondsPerQuestion: number
}

export const DEFAULT_CONFIG: GameConfig = {
  rounds: 10,
  secondsPerQuestion: 30,
  pointsPerCorrect: 100,
  speedBonus: 25,
  speedBonusFraction: 0.5,
  startingLife: 100,
  lifeLoss: 10,
  comboStreakRequired: 3,
  comboBonus: 50,
  shieldUses: 1,
  hintUses: 2,
  attackUses: 2,
  attackTimePenaltySeconds: 5,
  minSecondsPerQuestion: 5,
}

/** Combina cambios parciales con los valores por defecto y valida rangos. */
export function buildConfig(partial: Partial<GameConfig> = {}): GameConfig {
  const c = { ...DEFAULT_CONFIG, ...partial }
  const intIn = (name: keyof GameConfig, min: number, max: number) => {
    const v = c[name]
    if (!Number.isInteger(v) || v < min || v > max) throw new RangeError(`${name} debe ser un entero entre ${min} y ${max}`)
  }
  intIn('rounds', 1, 50)
  intIn('secondsPerQuestion', 10, 300)
  intIn('pointsPerCorrect', 0, 10000)
  intIn('speedBonus', 0, 10000)
  intIn('startingLife', 1, 1000)
  intIn('lifeLoss', 0, 1000)
  if (c.speedBonusFraction <= 0 || c.speedBonusFraction > 1) throw new RangeError('speedBonusFraction debe estar en (0, 1]')
  return c
}
