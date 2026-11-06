# MATHEX ARENA V5 — Pixel Battle + controles táctiles

## Cambios de esta versión
- Se mantienen los controles de teclado para ambos jugadores.
- Se agregan controles táctiles visibles durante el duelo 2D: movimiento izquierda/derecha, salto, ataque e impulso para cada jugador.
- Los controles táctiles usan Pointer Events, permiten mantener pulsados los botones de movimiento y eliminan el estado pulsado al soltar o cancelar el toque.
- En pantallas pequeñas los controles táctiles se apilan y se oculta la guía de teclado para dar prioridad al espacio jugable.
- Se regeneró `dist-site/index.html` con el juego empaquetado en un único HTML autónomo.

## Archivos principales
- `site/app.js`: interfaz y lógica de interacción del juego estático.
- `site/style.css`: estilos y controles táctiles.
- `dist-site/index.html`: versión lista para publicar en alojamiento estático.
- `src/`: motor matemático, módulos, preguntas, partidas y almacenamiento.

## Cómo probar
1. Abrir `dist-site/index.html` en un navegador moderno.
2. Iniciar una partida versus y completar los dos turnos matemáticos.
3. En la pantalla de duelo, probar los botones táctiles de ambos jugadores o usar el teclado.
4. En computador: Jugador 1 A/D, W, F, G; Jugador 2 flechas, Enter y Shift.
5. Para volver a generar el HTML: `npm run build:site` (Node.js 22.13 o superior).

## Verificación realizada
- `npm run build:site`: ejecutado correctamente; generó `dist-site/index.html` (123 KB).
- Comprobación estática: los controles `data-touch`, listeners `pointerdown`, `pointerup` y `pointercancel` están incluidos en el HTML generado.

## Pendiente
- Prueba manual en dispositivos Android/iOS reales y en distintos tamaños de pantalla.
- Pruebas de interacción completas en navegador para validar el combate táctil de dos participantes.
- Ejecutar la batería completa de pruebas del motor y revisar el juego en navegadores de destino.

## Publicación
Para Netlify Drop, subir la carpeta completa `dist-site`. Conservar el resto del proyecto para futuras modificaciones y reconstrucciones.


## Créditos de presentación

El juego muestra en su pie de página: **Presentado por Isabella**.
