import type { ModuleId, ModuleInfo } from './types.ts'

export const MODULES: ModuleInfo[] = [
  { id: 1, level: 1, name: 'Sistemas 2×2', description: 'Resuelve y clasifica sistemas de dos ecuaciones con dos incógnitas.', difficulty: 1,
    theory: 'Un sistema 2×2 busca valores de x e y que cumplan ambas ecuaciones. Puede ser compatible determinado (una solución), incompatible (ninguna) o compatible indeterminado (infinitas). Siempre se verifica sustituyendo en las ecuaciones originales.' },
  { id: 2, level: 1, name: 'Método de igualación', description: 'Despeja la misma incógnita en ambas ecuaciones e iguala.', difficulty: 1,
    theory: 'Se despeja x en las dos ecuaciones, se igualan las expresiones y queda una ecuación con una sola incógnita (y). Luego se sustituye para hallar x.' },
  { id: 3, level: 1, name: 'Método de sustitución', description: 'Despeja una incógnita y sustitúyela en la otra ecuación.', difficulty: 1,
    theory: 'Se despeja una incógnita de una ecuación (conviene la de coeficiente 1) y se sustituye en la otra. Queda una ecuación de una incógnita.' },
  { id: 4, level: 1, name: 'Reducción o eliminación', description: 'Multiplica las ecuaciones para cancelar una incógnita al restar.', difficulty: 2,
    theory: 'Se multiplican las ecuaciones por números adecuados para que una incógnita tenga el mismo coeficiente; al restar desaparece y se resuelve la otra.' },
  { id: 5, level: 1, name: 'Aplicaciones 2×2', description: 'Plantea y resuelve problemas con dos incógnitas.', difficulty: 2,
    theory: 'Primero se definen las incógnitas, luego se traduce el enunciado a dos ecuaciones y se resuelve el sistema. La respuesta debe tener sentido en el contexto del problema.' },
  { id: 6, level: 1, name: 'Determinantes 2×2', description: 'Calcula |a b; c d| = ad − bc.', difficulty: 1,
    theory: 'El determinante de una matriz 2×2 es el producto de la diagonal principal menos el producto de la diagonal secundaria: ad − bc.' },
  { id: 7, level: 1, name: 'Regla de Cramer 2×2', description: 'Resuelve con D, Dx y Dy.', difficulty: 2,
    theory: 'Si D ≠ 0, x = Dx/D e y = Dy/D, donde Dx y Dy se obtienen reemplazando la columna de la incógnita por los términos independientes. Si D = 0 no hay solución única.' },
  { id: 8, level: 2, name: 'Sistemas 3×3', description: 'Resuelve y clasifica sistemas de tres ecuaciones.', difficulty: 2,
    theory: 'Se resuelven por eliminación gaussiana: con operaciones entre filas se llega a una matriz escalonada. Según los rangos, el sistema es determinado, indeterminado o incompatible.' },
  { id: 9, level: 2, name: 'Determinantes 3×3', description: 'Calcula determinantes 3×3 por cofactores.', difficulty: 2,
    theory: 'Se expande por una fila: a11·M11 − a12·M12 + a13·M13, donde cada Mij es el determinante 2×2 que queda al quitar la fila i y la columna j.' },
  { id: 10, level: 2, name: 'Método de Sarrus', description: 'Suma de diagonales principales menos diagonales secundarias.', difficulty: 2,
    theory: 'Se repiten las dos primeras filas (o columnas) bajo la matriz; se suman los productos de las tres diagonales descendentes y se restan los de las tres ascendentes.' },
  { id: 11, level: 2, name: 'Regla de Cramer 3×3', description: 'Resuelve sistemas 3×3 con D, Dx, Dy y Dz.', difficulty: 3,
    theory: 'Si D ≠ 0, cada incógnita es el cociente entre su determinante (columna sustituida por los términos independientes) y D.' },
  { id: 12, level: 2, name: 'Aplicaciones 3×3', description: 'Plantea y resuelve problemas con tres incógnitas.', difficulty: 3,
    theory: 'Se definen tres incógnitas, se plantean tres ecuaciones a partir del enunciado y se resuelve el sistema con el método más cómodo.' },
]

export const getModule = (id: ModuleId): ModuleInfo => {
  const m = MODULES.find((x) => x.id === id)
  if (!m) throw new RangeError(`Módulo inexistente: ${id}`)
  return m
}
