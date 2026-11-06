# MATHEX ARENA

Videojuego educativo de matemáticas con estética futurista/esports, para **dos jugadores en el mismo computador**. Los jugadores compiten por turnos resolviendo sistemas de ecuaciones 2×2 y 3×3, determinantes, Cramer y Sarrus.

> **Estado:** juego jugable completo en una sola página estática (`dist-site/index.html`), con las 15 pantallas. Ver `ESTADO_DEL_PROYECTO.md`.

## Características implementadas

- 12 módulos matemáticos con teoría, ejercicios, explicación paso a paso y verificación por sustitución.
- 180 ejercicios fijos y reproducibles (15 por módulo) + generación procedural con semillas.
- Casos especiales: sistemas incompatibles, indeterminados, D = 0 y soluciones fraccionarias (fracciones exactas, sin decimales).
- Motor de partidas: 10 rondas, 30 s, 100 pts + 25 por rapidez, 100 de vida, −10 por ronda perdida (todo configurable).
- Poderes con reglas reales: ESCUDO, PISTA, COMBO y ATAQUE VISUAL.
- Privacidad entre turnos: la pantalla de transición no contiene nada de la pregunta anterior.
- Historial y récords guardados en LocalStorage (capa de servicio lista).

## Reglas de la partida

- En cada ronda **cada jugador recibe un ejercicio distinto** (mismo módulo y dificultad), así el segundo no ve lo que respondió el primero.
- Ronda: si solo uno acierta, gana y el otro pierde vida. Si ambos aciertan, gana el más rápido y nadie pierde vida. Si ambos fallan, ambos pierden vida.
- Fin: tras las rondas o si la vida de un jugador llega a 0. Gana quien conserva vida; si no, mayor puntaje; luego mayor vida; si no, empate.
- **ESCUDO** (1 uso): activado antes de responder, evita perder vida si fallas. **PISTA** (2 usos): oculta 2 opciones incorrectas, pero pierdes el bono de rapidez. **COMBO**: requiere racha de 3 aciertos; si aciertas, +50 puntos y se consume la racha. **ATAQUE VISUAL** (2 usos): efecto sobre el rival y −5 s en su próximo turno.

## Tecnologías

React 19, TypeScript estricto, Vite, Zustand, KaTeX, Zod, Vitest, React Testing Library, Playwright, ESLint y Prettier. Funciona sin servidor ni cuenta.

## Estructura

```
src/
  math/        fracciones exactas, determinantes, Cramer, Sarrus, Gauss-Jordan, RNG con semilla
  questions/   tipos, módulos, generadores de ejercicios y banco de 180
  game/        configuración, puntuación, poderes, máquina de estados de la partida, vista pública
  services/    historial y récords (LocalStorage)
  tests/       pruebas unitarias
  pages/ components/ store/ hooks/ styles/ utils/   (interfaz: pendiente)
```

## Requisitos e instalación

Node.js LTS y npm.

```
npm install
npm run dev        # desarrollo
npm run build      # producción
npm run preview    # probar la versión de producción
npm run test       # pruebas
npm run lint       # ESLint
```

`npm install` generará `package-lock.json`; consérvalo en el repositorio.

## Cómo continuar

1. Ejecuta `npm install`, luego `npm run test`, `npm run lint` y `npm run build`.
2. Crea el store de Zustand en `src/store/` envolviendo las funciones de `src/game/match.ts`.
3. Construye las pantallas usando `getPublicView()` (`src/game/view.ts`) como única fuente de datos: así se garantiza la privacidad entre turnos.
4. Renderiza ecuaciones con KaTeX usando el campo `latex` de cada ejercicio.

## Publicar la página (despliegue)

El juego se empaqueta en **un solo archivo** sin dependencias ni servidor:

```
npm run build:site     # genera dist-site/index.html (requiere solo Node 22.13+)
```

Para subirlo, usa cualquiera de estas opciones gratuitas:
- **Netlify Drop**: arrastra la carpeta `dist-site` a app.netlify.com/drop.
- **GitHub Pages**: sube `dist-site/index.html` a un repositorio y activa Pages (Settings → Pages).
- **Vercel / Cloudflare Pages**: carpeta de salida `dist-site`, sin comando de build (o `npm run build:site`).
- Abrir `index.html` directamente también funciona sin internet.

`site/app.js` y `site/style.css` son la interfaz (JS plano sobre el motor de `src/`); la versión React/Vite de `package.json` sigue disponible para evolucionar el proyecto.

## Mejoras visuales y de jugabilidad (respaldo 3)

La versión estática ahora incluye una interfaz renovada de estilo esports/neón, navegación más clara, HUD competitivo, barra de progreso de rondas, pantalla de relevo destacada, presentación de campeón, efectos de sonido opcionales y un entrenamiento con puntos, rachas y resumen de resultados.

Para generar la versión lista para abrir o publicar:

```bash
npm run build:site
```

Abre `dist-site/index.html` en el navegador. El sonido se puede activar o desactivar desde el control de la parte superior.

## Duelo 2D Pixel Battle

Después de que ambos participantes responden su ejercicio, la ronda pasa a una arena pixel art en 2D. El resultado matemático determina el equipamiento:

- Quien gana la pregunta recibe un bláster de energía de estilo arcade.
- Quien pierde recibe un bate de espuma para combate cercano.
- Si ambos aciertan, el más rápido obtiene el bláster; si empatan exactamente, ambos reciben uno.
- Si ambos fallan, ambos usan bate de espuma.
- El primer impacto válido gana el duelo, suma 25 puntos y resta 10 de vida al rival.
- Si pasan 25 segundos sin impacto, el duelo termina en empate.

### Controles de teclado

| Acción | Jugador 1 (cian) | Jugador 2 (magenta) |
|---|---|---|
| Mover | A / D | ← / → |
| Saltar | W | ↑ |
| Atacar | F | Enter |
| Impulso | G | Shift |

El combate es caricaturesco y no gráfico. Los ataques son efectos de energía y golpes de bate de espuma; no representa armas reales.


## Presentación

**MATHEX ARENA — Presentado por Isabella.**
