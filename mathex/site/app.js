import { MODULES } from './questions/modules.ts'
import { buildBank } from './questions/bank.ts'
import { DEFAULT_CONFIG } from './game/config.ts'
import { createMatch, acknowledgeHandoff, usePower, submitAnswer, timeoutTurn, advanceRound, currentPlayerIndex, timeLeftMs } from './game/match.ts'
import { getPublicView } from './game/view.ts'
import { summarizeMatch, saveMatch, loadHistory, computeRecords } from './services/storage.ts'

const mem = {}
const store = (() => { try { localStorage.setItem('_t', '1'); localStorage.removeItem('_t'); return localStorage } catch { return { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v } } } })()
const $app = document.getElementById('app')
const bank = buildBank()
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const S = { screen: 'home', battle: null, names: ['Jugador 1', 'Jugador 2'], mods: new Set([1, 6, 7]), cfg: { rounds: 10, secondsPerQuestion: 30, difficulty: 0 }, match: null, saved: false, T: null, notice: '', sound: store.getItem('mathex-arena:sound') !== 'off' }
try { const p = JSON.parse(store.getItem('mathex-arena:prefs') || 'null'); if (p) { S.names = p.names || S.names; S.mods = new Set(p.mods || [...S.mods]); S.cfg = { ...S.cfg, ...p.cfg } } } catch { /* preferencias corruptas: se ignoran */ }
const savePrefs = () => { try { store.setItem('mathex-arena:prefs', JSON.stringify({ names: S.names, mods: [...S.mods], cfg: S.cfg })) } catch { /* sin almacenamiento */ } }
const back = (to, label = '← Volver') => `<button class="ghost" data-a="go" data-to="${to}">${label}</button>`
const bar = (v, max) => `<div class="bar"><i style="width:${Math.max(0, (100 * v) / max)}%"></i></div>`
const eq = (txt) => esc(txt)
const playTone = (frequency = 520, duration = .11, type = 'sine') => {
  if (!S.sound) return
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx(), osc = ctx.createOscillator(), gain = ctx.createGain()
    osc.type = type; osc.frequency.setValueAtTime(frequency, ctx.currentTime)
    gain.gain.setValueAtTime(.0001, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.07, ctx.currentTime + .012)
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + duration)
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + duration + .02)
    osc.onended = () => ctx.close()
  } catch { /* audio no disponible */ }
}
const progress = (n, total) => `<div class="progress"><i style="width:${Math.max(0, Math.min(100, 100*n/Math.max(1,total)))}%"></i></div>`

const SCREENS = {
  home: () => `<section class="hero card">
      <div class="hero-kicker"><span class="live-dot"></span> TEMPORADA LOCAL · 2 JUGADORES</div>
      <div class="hero-emblem"><span>∑</span><i>⚡</i></div>
      <p class="eyebrow">PIENSA RÁPIDO. JUEGA INTELIGENTE.</p>
      <h1>MATHEX <em>ARENA</em></h1>
      <p class="sub">El conocimiento es tu mejor arma. ¿Quién dominará la arena?</p>
      <button class="pri hero-cta" data-a="go" data-to="mode">⚔ ENTRAR A LA ARENA <span>→</span></button>
      <div class="hero-foot"><span>12 DISCIPLINAS</span><b>✦</b><span>180+ RETOS</span><b>✦</b><span>UN SOLO DISPOSITIVO</span></div>
    </section>
    <div class="feature-grid"><div class="feature"><span>⚔️</span><b>Duelo local</b><small>Compite cara a cara</small></div><div class="feature"><span>🧠</span><b>Entrena</b><small>Domina cada método</small></div><div class="feature"><span>🏆</span><b>Sube tu nivel</b><small>Supera tus récords</small></div></div>
    <div class="home-actions"><button class="secondary" data-a="go" data-to="help">📖 Cómo se juega</button><button class="secondary" data-a="go" data-to="records">🏆 Ver récords</button></div>`,
  mode: () => `<div class="section-head"><p class="eyebrow">ELIGE TU EXPERIENCIA</p><h2>Selecciona un modo</h2><p class="mu">Cada partida es una oportunidad para subir de nivel.</p></div>
    <div class="mode-grid"><button class="mode-card mode-versus" data-a="go" data-to="players"><span class="mode-icon">⚔️</span><span class="mode-label">MODO COMPETITIVO</span><b>VERSUS</b><small>Dos jugadores · duelo por rondas · poderes especiales</small><i>JUGAR AHORA →</i></button><button class="mode-card mode-training" data-a="go" data-to="train"><span class="mode-icon">🎯</span><span class="mode-label">MEJORA TUS HABILIDADES</span><b>ENTRENAMIENTO</b><small>Practica a tu ritmo y aprende con soluciones explicadas</small><i>ENTRENAR →</i></button></div>
    <div class="quick-grid"><button class="quick-card" data-a="go" data-to="history">🗂 <span><b>Historial</b><small>Revisa tus partidas</small></span><strong>→</strong></button><button class="quick-card" data-a="go" data-to="records">🏆 <span><b>Récords</b><small>Consulta tus mejores marcas</small></span><strong>→</strong></button></div>${back('home')}`,
  players: () => `<div class="section-head"><p class="eyebrow">PREPARA EL DUELO</p><h2>¿Quién entra a la arena?</h2><p class="mu">Elige los nombres de los dos competidores.</p></div><div class="player-setup"><div class="player-panel cyan-panel"><div class="avatar">⚡</div><label>JUGADOR 01 · CIAN</label><input data-n="0" maxlength="14" value="${esc(S.names[0])}"></div><div class="versus-mark">VS</div><div class="player-panel pink-panel"><div class="avatar">🔥</div><label>JUGADOR 02 · MAGENTA</label><input data-n="1" maxlength="14" value="${esc(S.names[1])}"></div></div>
    <div class="row">${back('mode')}<button class="pri" data-a="go" data-to="modules">Elegir disciplinas →</button></div>`,
  modules: () => `<div class="section-head"><p class="eyebrow">SELECCIÓN DE DISCIPLINAS</p><h2>Arma tu campeonato</h2><p class="mu">Selecciona los temas que aparecerán durante el duelo.</p><div class="selection-count"><b>${S.mods.size}</b> de 12 seleccionados</div></div>${[1, 2].map((l) => `<div class="card module-group"><div class="module-title"><span class="level-badge">0${l}</span><div><h3>Nivel ${l}: sistemas ${l + 1}×${l + 1}</h3><small>${l === 1 ? 'Fundamentos y métodos de resolución' : 'Desafíos avanzados y aplicaciones'}</small></div></div><div class="module-grid">${MODULES.filter((m) => m.level === l).map((m) => `<button class="module-option ${S.mods.has(m.id) ? 'selected' : ''}" data-a="mod" data-id="${m.id}"><span class="module-check">${S.mods.has(m.id) ? '✓' : '+'}</span><b>${esc(m.name)}</b><span class="tag">${'★'.repeat(m.difficulty)}</span><small>${esc(m.description)}</small></button>`).join('')}</div></div>`).join('')}
    <div class="sticky-actions"><button data-a="all">${S.mods.size === 12 ? 'Quitar todos' : 'Seleccionar todos'}</button>${back('players')}<button class="pri" data-a="to-config">Continuar · ${S.mods.size} temas →</button></div>`,
  config: () => `<div class="section-head"><p class="eyebrow">REGLAS DEL TORNEO</p><h2>Configura la batalla</h2></div><div class="card config-card"><div class="config-row"><div><label>RONDAS</label><small>Duración del campeonato</small></div><input type="number" min="1" max="30" data-k="rounds" value="${S.cfg.rounds}"></div><div class="config-row"><div><label>TIEMPO POR PREGUNTA</label><small>Segundos para resolver</small></div><input type="number" min="10" max="120" data-k="secondsPerQuestion" value="${S.cfg.secondsPerQuestion}"></div><div class="config-row"><div><label>DIFICULTAD</label><small>Elige el nivel de desafío</small></div><select data-k="difficulty">${['Progresiva', 'Fácil', 'Media', 'Difícil'].map((t, i) => `<option value="${i}" ${+S.cfg.difficulty === i ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div class="rules-strip"><span>⭐ 100 pts por acierto</span><span>⚡ +25 rapidez</span><span>❤️ 100 de vida</span></div></div><div class="row">${back('modules')}<button class="pri" data-a="versus">Ver enfrentamiento →</button></div>`,
  versus: () => `<div class="versus-screen card pop"><p class="eyebrow">EL COMBATE ESTÁ POR COMENZAR</p><div class="versus-players"><div class="versus-player cyan-text"><div class="avatar">⚡</div><b>${esc(S.names[0])}</b><small>PLAYER 01</small></div><div class="versus-burst">VS</div><div class="versus-player pink-text"><div class="avatar">🔥</div><b>${esc(S.names[1])}</b><small>PLAYER 02</small></div></div><div class="match-summary"><span>🎮 ${S.cfg.rounds} rondas</span><span>⏱ ${S.cfg.secondsPerQuestion} segundos</span><span>🧩 ${S.mods.size} disciplinas</span></div><button class="pri hero-cta" data-a="start">⚡ ¡COMENZAR COMBATE!</button></div>${back('config')}`,
  help: () => `<div class="section-head"><p class="eyebrow">GUÍA DEL COMPETIDOR</p><h2>Cómo dominar la arena</h2></div><div class="card help-card"><div class="help-step"><span>01</span><div><b>Elige tus disciplinas</b><p>Selecciona entre 12 módulos de sistemas de ecuaciones, determinantes y métodos de resolución.</p></div></div><div class="help-step"><span>02</span><div><b>Resuelve por turnos</b><p>Cada jugador recibe un ejercicio distinto del mismo tema. La pantalla de relevo oculta la pregunta anterior.</p></div></div><div class="help-step"><span>03</span><div><b>Gana puntos y protege tu energía</b><p>Acierto = 100 pts; rapidez = +25 pts. Fallar o agotar el tiempo resta 10 de vida, salvo que uses un escudo.</p></div></div><div class="help-step"><span>04</span><div><b>¡Entra al duelo 2D!</b><p>Después de cada pregunta hay un combate pixel art. Quien acierta recibe un bláster de energía; quien falla usa un bate de espuma. El primer impacto gana el duelo y causa 10 de daño.</p></div></div><div class="help-step"><span>05</span><div><b>Controles de teclado</b><p>Jugador 1: A/D mover, W saltar, F atacar, G impulso. Jugador 2: ←/→ mover, ↑ saltar, Enter atacar, Shift impulso.</p></div></div><div class="help-tip">💡 CONSEJO: practica los módulos que más te cuestan antes de entrar al modo versus.</div></div>${back('home')}`,
}

function arena() {
  const m = S.match, v = getPublicView(m, Date.now()), pi = currentPlayerIndex(m), me = m.players[pi], cfg = m.config
  const pc = (p, i) => `<div class="pl ${i ? 'b' : ''} ${i === pi ? 'act' : ''}"><div class="player-line"><span class="player-orb">${i ? '🔥' : '⚡'}</span><b>${esc(p.name)}</b><span class="player-role">P${i + 1}</span></div>${bar(p.life, cfg.startingLife)}<span class="player-stats">❤ ${p.life} <i>·</i> ★ ${p.score}</span><small class="streak-label">${p.streak >= 3 ? '🔥 RACHA MÁXIMA' : p.streak ? '🔥 Racha x' + p.streak : 'LISTO PARA EL DUELO'}</small></div>`
  const pw = (k, ic, t, n, ok) => `<button class="power-button power-${k}" data-a="pw" data-p="${k}" ${ok ? '' : 'disabled'} title="${t}"><span>${ic}</span><b>${t}</b><small>${n === '' ? (ok ? 'DISPONIBLE' : 'BLOQUEADO') : n + ' usos'}</small></button>`
  return `<div class="arena-shell ${me.underAttack ? 'glitch' : ''}"><div class="arena-topline"><span><i class="live-dot"></i> COMBATE EN CURSO</span><span>RONDA ${v.round} / ${v.totalRounds}</span></div><div class="round-track">${progress(v.round - 1, v.totalRounds)}</div>
    <div class="hud">${pc(m.players[0], 0)}<div class="mid"><span>ROUND</span><b>${v.round.toString().padStart(2,'0')}</b><small>VS</small></div>${pc(m.players[1], 1)}</div>
    ${me.underAttack ? '<p class="attack-alert">⚡ INTERFERENCIA ENTRANTE · ¡Responde rápido!</p>' : ''}
    <div class="question-card card"><div class="question-meta"><span class="question-chip">🧠 DESAFÍO MATEMÁTICO</span><span class="turn-player" style="color:var(--${pi ? 'm' : 'c'})">TURNO DE ${esc(v.activePlayer).toUpperCase()}</span></div><div class="timer-row"><b><span id="tl">${Math.ceil(v.timeLeftMs / 1000)}</span><small> SEG</small></b><div class="timer" id="tb"><i style="width:100%"></i></div></div><div class="q">${eq(v.question.statement)}</div><p class="question-hint">Selecciona la respuesta correcta antes de que termine el tiempo.</p></div>
    <div class="answer-title"><span>ELIGE TU RESPUESTA</span><small>4 OPCIONES · 1 CORRECTA</small></div><div class="opts">${v.question.options.map((o) => `<button class="answer-option" data-a="ans" data-i="${o.index}" ${o.hidden ? 'disabled style="visibility:hidden"' : ''}><span class="option-letter">${String.fromCharCode(65 + o.index)}</span><b>${esc(o.text)}</b><i>↗</i></button>`).join('')}</div>
    <div class="power-heading"><span>⚡ HABILIDADES ESPECIALES</span><small>USA TU ESTRATEGIA</small></div><div class="pw power-grid">${pw('shield', '🛡️', 'Escudo', me.shieldUsesLeft, me.shieldUsesLeft > 0 && !me.shieldActive)}${pw('hint', '💡', 'Pista', me.hintUsesLeft, me.hintUsesLeft > 0 && !me.hintUsedThisTurn)}${pw('combo', '🔥', 'Combo', '', me.streak >= cfg.comboStreakRequired && !me.comboActive)}${pw('attack', '⚡', 'Ataque', me.attackUsesLeft, me.attackUsesLeft > 0 && !me.attackUsedThisTurn)}</div>
    <p class="power-status">${me.shieldActive ? '🛡 Escudo activo · ' : ''}${me.comboActive ? '🔥 Combo activado: +50 puntos · ' : ''}${me.hintUsedThisTurn ? '💡 Pista utilizada: sin bono de rapidez' : 'Completa rachas de 3 aciertos para desbloquear el combo.'}</p></div>`
}
// --- DUELO 2D PIXEL ART: el resultado matemático decide el equipamiento. ---
function createBattle() {
  const record = S.match.history[S.match.history.length - 1]
  const turns = record.turns
  let favored = record.winner
  if (favored === null && turns[0].correct && turns[1].correct && turns[0].elapsedMs === turns[1].elapsedMs) favored = 'both'
  S.battle = {
    players: [
      { x: 150, y: 0, vy: 0, facing: 1, weapon: favored === 0 || favored === 'both' ? 'blaster' : 'foam', onGround: true },
      { x: 810, y: 0, vy: 0, facing: -1, weapon: favored === 1 || favored === 'both' ? 'blaster' : 'foam', onGround: true },
    ],
    keys: new Set(), projectiles: [], particles: [], startedAt: performance.now(), lastFrame: 0,
    cooldown: [0, 0], dashUntil: [0, 0], dashCooldown: [0, 0], remaining: 25, done: false, winner: null, looping: false,
  }
}
function battleView() {
  if (!S.battle) createBattle()
  const b = S.battle, names = S.match.players
  const weaponName = (w) => w === 'blaster' ? 'BLÁSTER DE ENERGÍA' : 'BATE DE ESPUMA'
  return `<section class="pixel-duel card pop">
    <div class="pixel-duel-head"><div><p class="eyebrow">RONDA ${S.match.round + 1} · DUELO DE REACCIÓN</p><h2>¡A LA ARENA!</h2><p class="mu">El primer impacto gana el duelo y quita 10 de vida al rival.</p></div><div class="duel-clock"><b id="battleTime">25</b><small>SEG</small></div></div>
    <div class="duel-loadouts"><div class="loadout cyan-loadout"><b>${esc(names[0].name)}</b><span>${b.players[0].weapon === 'blaster' ? '🔷' : '🪵'} ${weaponName(b.players[0].weapon)}</span></div><div class="loadout-vs">VS</div><div class="loadout pink-loadout"><b>${esc(names[1].name)}</b><span>${b.players[1].weapon === 'blaster' ? '🔷' : '🪵'} ${weaponName(b.players[1].weapon)}</span></div></div>
    <div class="pixel-stage-wrap"><canvas id="duelCanvas" width="960" height="360" aria-label="Arena de combate pixel art de dos jugadores"></canvas><div class="stage-caption"><span>NEON ROOFTOP · 01</span><span>PRIMER IMPACTO = VICTORIA</span></div></div>
    <div class="touch-controls" aria-label="Controles táctiles para dos jugadores">
      <div class="touch-player touch-cyan"><b>JUGADOR 1 · CONTROLES TÁCTILES</b><div class="touch-pad"><button data-touch="a" aria-label="Jugador 1 izquierda">◀</button><button data-touch="d" aria-label="Jugador 1 derecha">▶</button><button data-touch="w" class="touch-action" aria-label="Jugador 1 saltar">⬆ SALTAR</button><button data-touch="f" class="touch-action" aria-label="Jugador 1 atacar">⚡ ATACAR</button><button data-touch="g" class="touch-action" aria-label="Jugador 1 impulso">➤ IMPULSO</button></div></div>
      <div class="touch-player touch-pink"><b>JUGADOR 2 · CONTROLES TÁCTILES</b><div class="touch-pad"><button data-touch="arrowleft" aria-label="Jugador 2 izquierda">◀</button><button data-touch="arrowright" aria-label="Jugador 2 derecha">▶</button><button data-touch="arrowup" class="touch-action" aria-label="Jugador 2 saltar">⬆ SALTAR</button><button data-touch="enter" class="touch-action" aria-label="Jugador 2 atacar">⚡ ATACAR</button><button data-touch="shift" class="touch-action" aria-label="Jugador 2 impulso">➤ IMPULSO</button></div></div>
    </div>
    <div class="duel-controls"><div class="control-player"><b>JUGADOR 1 · TECLADO</b><span><kbd>A</kbd><kbd>D</kbd> Mover <kbd>W</kbd> Saltar <kbd>F</kbd> Atacar <kbd>G</kbd> Impulso</span></div><div class="control-player"><b>JUGADOR 2 · TECLADO</b><span><kbd>←</kbd><kbd>→</kbd> Mover <kbd>↑</kbd> Saltar <kbd>ENTER</kbd> Atacar <kbd>SHIFT</kbd> Impulso</span></div></div>
    <p class="duel-tip" id="duelTip">${b.players[0].weapon === 'blaster' || b.players[1].weapon === 'blaster' ? '🔷 El bláster alcanza a distancia. ¡Esquiva y busca el momento!' : '🪵 Ambos tienen bate de espuma. Acércate para conectar el toque.'}</p>
  </section>`
}
const DUEL = { width: 960, height: 360, floor: 292 }
function pixelRect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h) }
function drawPixelFighter(ctx, p, i, now) {
  const x = Math.round(p.x), y = Math.round(DUEL.floor - 64 - p.y), c = i ? '#ff5bc8' : '#42eaff', dark = i ? '#742b86' : '#145b88', light = i ? '#ffd0f2' : '#c8fbff'
  const flash = p.dashUntil > now
  ctx.save(); if (flash) ctx.globalAlpha = .65 + Math.sin(now / 20) * .25
  // sombra y botas
  pixelRect(ctx, x - 20, DUEL.floor - 5, 42, 6, '#02071399')
  pixelRect(ctx, x - 15, y + 48, 13, 13, '#10182d'); pixelRect(ctx, x + 3, y + 48, 13, 13, '#10182d')
  pixelRect(ctx, x - 17, y + 57, 17, 5, c); pixelRect(ctx, x + 1, y + 57, 17, 5, c)
  // torso y extremidades estilo 16-bit
  pixelRect(ctx, x - 17, y + 22, 34, 29, dark); pixelRect(ctx, x - 13, y + 25, 26, 21, c)
  pixelRect(ctx, x - 21, y + 27, 7, 20, dark); pixelRect(ctx, x + 14, y + 27, 7, 20, dark)
  // cabeza / visor
  pixelRect(ctx, x - 15, y, 30, 24, '#172944'); pixelRect(ctx, x - 12, y + 3, 24, 18, light)
  pixelRect(ctx, x - 10, y + 9, 20, 6, i ? '#a52eaa' : '#167da8'); pixelRect(ctx, x + (p.facing > 0 ? 5 : -9), y + 9, 4, 4, '#fff')
  // insignia
  pixelRect(ctx, x - 4, y + 30, 8, 8, '#f6fbff')
  if (p.weapon === 'blaster') {
    const gx = x + p.facing * 18
    pixelRect(ctx, gx + (p.facing < 0 ? -18 : 0), y + 30, 20, 7, '#202b49')
    pixelRect(ctx, gx + (p.facing < 0 ? -18 : 0), y + 28, 13, 4, c)
    pixelRect(ctx, gx + (p.facing < 0 ? -22 : 17), y + 31, 5, 5, '#fff')
  } else {
    ctx.save(); ctx.translate(x + p.facing * 16, y + 35); ctx.rotate(p.facing * -.55)
    pixelRect(ctx, -3, -27, 7, 35, '#9a7047'); pixelRect(ctx, -8, -30, 17, 9, '#d7b27a'); pixelRect(ctx, -8, -23, 17, 5, '#f4d49c'); ctx.restore()
  }
  ctx.restore()
}
function drawBattle(ctx, b, now) {
  const W = DUEL.width, H = DUEL.height, floor = DUEL.floor
  ctx.imageSmoothingEnabled = false
  const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#101b42'); sky.addColorStop(.65, '#17183c'); sky.addColorStop(1, '#090f23'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H)
  // estrellas y edificios pixelados
  for (let i = 0; i < 48; i++) { const x = (i * 193 + 31) % W, y = (i * 47 + 19) % 180; pixelRect(ctx, x, y, i % 4 === 0 ? 3 : 2, 2, i % 3 ? '#7187c8' : '#56eaff') }
  for (let i = 0; i < 15; i++) { const x = i * 68, h = 55 + ((i * 37) % 85); pixelRect(ctx, x, floor - h, 54, h, '#111b3a'); for (let wy = floor - h + 12; wy < floor - 8; wy += 17) for (let wx = x + 9; wx < x + 48; wx += 16) pixelRect(ctx, wx, wy, 5, 7, (i + wx + wy) % 3 ? '#29466d' : '#4c3677') }
  // suelo y rejilla
  pixelRect(ctx, 0, floor, W, H - floor, '#101b32'); pixelRect(ctx, 0, floor, W, 5, '#45eaff')
  ctx.strokeStyle = '#28466a'; ctx.lineWidth = 1
  for (let x = -80; x < W + 80; x += 48) { ctx.beginPath(); ctx.moveTo(W / 2, floor); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = floor + 22; y < H; y += 18) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  // proyectiles y destellos
  b.projectiles.forEach((q) => { ctx.save(); ctx.shadowBlur = 18; ctx.shadowColor = q.color; pixelRect(ctx, q.x - 7, q.y - 5, 14, 10, q.color); pixelRect(ctx, q.x - 3, q.y - 8, 6, 16, '#fff'); ctx.restore() })
  b.particles = b.particles.filter((p) => now - p.t < 420)
  b.particles.forEach((p) => { const age = (now - p.t) / 420; pixelRect(ctx, p.x + p.dx * age, p.y + p.dy * age, 5, 5, p.color) })
  b.players.forEach((p, i) => drawPixelFighter(ctx, p, i, now))
  // etiquetas sobre cada jugador
  ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#eaf8ff'
  b.players.forEach((p, i) => { ctx.fillText(S.match.players[i].name.slice(0, 14), p.x, DUEL.floor - 78 - p.y) })
}
function finishBattle(winner) {
  const b = S.battle
  if (!b || b.done) return
  b.done = true; b.winner = winner
  if (winner !== null) {
    const loser = winner === 0 ? 1 : 0
    S.match.players[loser].life = Math.max(0, S.match.players[loser].life - 10)
    S.match.players[winner].score += 25
    const rec = S.match.history[S.match.history.length - 1]
    rec.combatWinner = winner; rec.combatDamage = [winner === 1 ? 10 : 0, winner === 0 ? 10 : 0]
    playTone(900, .24)
  } else playTone(330, .2)
  render()
}
function duelAttack(i, now) {
  const b = S.battle, p = b.players[i], target = b.players[1 - i]
  if (b.done || now < b.cooldown[i]) return
  b.cooldown[i] = now + (p.weapon === 'blaster' ? 720 : 620)
  if (p.weapon === 'blaster') {
    b.projectiles.push({ x: p.x + p.facing * 25, y: DUEL.floor - 40 - p.y, vx: p.facing * 10, owner: i, color: i ? '#ff66dc' : '#4df2ff' })
    playTone(620, .07, 'square')
  } else {
    const close = Math.abs(target.x - p.x) < 82 && Math.abs(target.y - p.y) < 42 && Math.sign(target.x - p.x) === p.facing
    b.particles.push({ x: p.x + p.facing * 34, y: DUEL.floor - 43 - p.y, dx: p.facing * 24, dy: -12, t: now, color: '#ffe5a2' })
    playTone(250, .09, 'triangle')
    if (close && b.dashUntil[1 - i] <= now) finishBattle(i)
  }
}
function triggerBattleKey(key) {
  const b = S.battle
  if (S.screen !== 'match' || S.match?.phase !== 'roundResult' || !b || b.done) return
  b.keys.add(key)
  const now = performance.now()
  if (key === 'w' && b.players[0].onGround) { b.players[0].vy = -11; b.players[0].onGround = false }
  if (key === 'arrowup' && b.players[1].onGround) { b.players[1].vy = -11; b.players[1].onGround = false }
  if (key === 'g' && now >= b.dashCooldown[0]) { const p = b.players[0]; p.x = Math.max(30, Math.min(930, p.x + p.facing * 74)); p.dashUntil = now + 180; b.dashUntil[0] = now + 180; b.dashCooldown[0] = now + 1200; playTone(420,.06) }
  if (key === 'shift' && now >= b.dashCooldown[1]) { const p = b.players[1]; p.x = Math.max(30, Math.min(930, p.x + p.facing * 74)); p.dashUntil = now + 180; b.dashUntil[1] = now + 180; b.dashCooldown[1] = now + 1200; playTone(420,.06) }
  if (key === 'f') duelAttack(0, now)
  if (key === 'enter') duelAttack(1, now)
}
function duelKeyDown(e) {
  const key = e.key.toLowerCase(), allowed = ['a','d','w','f','g','arrowleft','arrowright','arrowup','enter','shift']
  if (!allowed.includes(key) || e.repeat || S.screen !== 'match' || S.match?.phase !== 'roundResult' || !S.battle || S.battle.done) return
  e.preventDefault(); triggerBattleKey(key)
}
function duelKeyUp(e) { if (S.battle) S.battle.keys.delete(e.key.toLowerCase()) }
document.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('[data-touch]')
  if (!btn || !S.battle || S.battle.done) return
  e.preventDefault()
  const key = btn.dataset.touch
  btn.classList.add('pressed')
  if (btn.setPointerCapture && e.pointerId !== undefined) { try { btn.setPointerCapture(e.pointerId) } catch {} }
  triggerBattleKey(key)
}, { passive: false })
document.addEventListener('pointerup', (e) => {
  const btn = e.target.closest('[data-touch]')
  if (!btn) return
  btn.classList.remove('pressed')
  if (S.battle) S.battle.keys.delete(btn.dataset.touch)
})
document.addEventListener('pointercancel', (e) => {
  const btn = e.target.closest('[data-touch]')
  if (btn) { btn.classList.remove('pressed'); if (S.battle) S.battle.keys.delete(btn.dataset.touch) }
})
function battleLoop(now) {
  const b = S.battle, canvas = document.getElementById('duelCanvas')
  if (!b || b.done || !canvas || S.screen !== 'match') { if (b) b.looping = false; return }
  const ctx = canvas.getContext('2d'), dt = Math.min(2.2, (now - (b.lastFrame || now)) / 16.67 || 1); b.lastFrame = now
  const map = [{ left:'a', right:'d' }, { left:'arrowleft', right:'arrowright' }]
  b.players.forEach((p, i) => {
    const keys = b.keys, move = (keys.has(map[i].right) ? 1 : 0) - (keys.has(map[i].left) ? 1 : 0)
    if (move) { p.x = Math.max(28, Math.min(932, p.x + move * 3.5 * dt)); p.facing = move }
    else p.facing = p.x < b.players[1-i].x ? 1 : -1
    p.vy += .55 * dt; p.y -= p.vy * dt
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.onGround = true } else p.onGround = false
  })
  b.projectiles = b.projectiles.filter((q) => {
    q.x += q.vx * dt
    const target = b.players[1 - q.owner]
    if (Math.abs(q.x - target.x) < 22 && Math.abs(q.y - (DUEL.floor - 38 - target.y)) < 35 && b.dashUntil[1 - q.owner] <= now) { finishBattle(q.owner); return false }
    return q.x > 0 && q.x < DUEL.width
  })
  b.remaining = Math.max(0, 25 - (now - b.startedAt) / 1000)
  const timer = document.getElementById('battleTime'); if (timer) timer.textContent = Math.ceil(b.remaining)
  drawBattle(ctx, b, now)
  if (b.remaining <= 0) { finishBattle(null); return }
  b.loopId = requestAnimationFrame(battleLoop)
}
function startBattleLoop() {
  const b = S.battle
  if (!b || b.done || b.looping) return
  const canvas = document.getElementById('duelCanvas')
  if (!canvas) return
  b.looping = true; b.lastFrame = performance.now(); b.loopId = requestAnimationFrame(battleLoop)
}
document.addEventListener('keydown', duelKeyDown)
document.addEventListener('keyup', duelKeyUp)

function handoff() {
  const v = getPublicView(S.match, Date.now()), target = currentPlayerIndex(S.match)
  return `<div class="handoff-screen card pop"><div class="handoff-lock">🔒</div><p class="eyebrow">RELEVO DE COMPETIDOR</p><div class="big">${esc(v.handoffMessage)}</div><p class="mu">La pregunta anterior está protegida. Entrega el dispositivo al siguiente jugador.</p><div class="handoff-target" style="color:var(--${target ? 'm' : 'c'})"><span>PRÓXIMO EN JUGAR</span><b>${esc(v.activePlayer || S.match.players[target].name)}</b></div><div class="hud">${v.players.map((p, i) => `<div class="pl ${i ? 'b' : ''}"><b>${esc(p.name)}</b>${bar(p.life, S.match.config.startingLife)}<span>❤ ${p.life} · ★ ${p.score}</span></div>`).join('<div></div>')}</div><button class="pri hero-cta" data-a="ready">YA ESTOY LISTO/A · COMENZAR →</button></div>`
}
function result() {
  const m = S.match, v = getPublicView(m, Date.now()), r = v.reveal, last = m.round + 1 >= m.config.rounds || m.players.some((p) => p.life <= 0)
  const t = (i) => { const x = r.record.turns[i]; return `<div class="card ${x.correct ? '' : 'shake'}"><h3 style="color:var(--${i ? 'm' : 'c'})">${esc(m.players[i].name)} <span class="${x.correct ? 'ok' : 'bad'}">${x.correct ? '✔ Correcto' : x.timedOut ? '⌛ Tiempo agotado' : '✖ Incorrecto'}</span></h3>
    <p>${x.points ? '+' + x.points + ' pts' : '0 pts'}${x.speedBonus ? ' (⚡ rapidez)' : ''}${x.comboBonus ? ' (🔥 combo)' : ''} · ${(x.elapsedMs / 1000).toFixed(1)} s${r.record.lifeLost[i] ? ` · <span class="bad">−${r.record.lifeLost[i]} ❤</span>` : x.shielded ? ' · 🛡 protegido' : ''}</p>
    <p class="mu" style="white-space:pre-line">${esc(m.exercises[r.record.round][i].statement)}</p><p>Respuesta correcta: <b class="ok">${esc(r.correctAnswers[i])}</b></p>
    <details><summary>Ver explicación paso a paso</summary><p>${esc(r.explanations[i])}</p><ol class="st">${r.steps[i].map((s) => `<li>${esc(s)}</li>`).join('')}</ol></details></div>` }
  const duelReport = S.battle?.done ? `<div class="duel-report card"><b>${S.battle.winner === null ? '🤝 DUELO EMPATADO' : `🏆 ${esc(m.players[S.battle.winner].name)} GANA EL DUELO`}</b><span>${S.battle.winner === null ? 'No hubo impacto en el tiempo disponible.' : `+25 puntos y −10 de vida para ${esc(m.players[1 - S.battle.winner].name)}.`}</span></div>` : ''
  return `${duelReport}<div class="round-result-head card pop"><p class="eyebrow">REPORTE DE COMBATE · RONDA ${r.record.round + 1}</p><div class="result-medal">${r.record.winner === null ? '🤝' : '🏅'}</div><h2>${r.record.winner === null ? 'RONDA EMPATADA' : `¡${esc(m.players[r.record.winner].name)} GANA LA RONDA!`}</h2><p class="mu">${r.record.winner === null ? 'Los dos competidores mantienen el pulso.' : 'Un punto más cerca de dominar la arena.'}</p></div>
    <div class="hud">${v.players.map((p, i) => `<div class="pl ${i ? 'b' : ''}"><b>${esc(p.name)}</b>${bar(p.life, m.config.startingLife)}<span>❤ ${p.life} · ★ ${p.score}</span></div>`).join('<div></div>')}</div>${t(0)}${t(1)}
    <button class="pri" style="width:100%" data-a="next">${last ? 'Ver resultados finales →' : 'Siguiente ronda →'}</button>`
}
function final() {
  const m = S.match, w = m.winner
  return `<div class="champion-screen card pop"><div class="champion-glow">${w === 'draw' ? '🤝' : '🏆'}</div><p class="eyebrow">FIN DEL CAMPEONATO</p><h1>${w === 'draw' ? '¡EMPATE!' : esc(m.players[w].name)}</h1><p class="sub">${w === 'draw' ? 'Igualdad total. ¡Una revancha lo decide!' : '¡CAMPEÓN/A DE MATHEX ARENA!'}</p><div class="champion-stats">${m.players.map((p, i) => `<div class="champion-player ${w === i ? 'winner' : ''}"><span>${i ? '🔥' : '⚡'}</span><b>${esc(p.name)}</b><strong>${p.score}</strong><small>PUNTOS · ❤ ${p.life} VIDA</small>${w === i ? '<em>CAMPEÓN/A</em>' : ''}</div>`).join('')}</div><p class="mu">${m.history.length} ronda(s) · partida guardada en el historial</p></div><div class="row"><button class="pri" data-a="rematch">🔁 REVANCHA</button><button data-a="go" data-to="mode">Menú principal</button><button data-a="go" data-to="history">Historial</button></div>`
}
function history() {
  const h = loadHistory(store)
  return `<h2>Historial</h2>${h.length ? h.map((x) => `<div class="card"><b>${esc(x.players[0].name)}</b> ${x.players[0].score} — ${x.players[1].score} <b>${esc(x.players[1].name)}</b><br><span class="mu">${x.winner === 'draw' ? 'Empate' : 'Ganó ' + esc(x.players[x.winner].name)} · ${x.rounds} rondas · ${new Date(x.finishedAt).toLocaleString()}</span></div>`).join('') : '<p class="card mu">Aún no hay partidas.</p>'}${back('mode')}`
}
function records() {
  const r = computeRecords(loadHistory(store)), w = Object.entries(r.winsByPlayer).sort((a, b) => b[1] - a[1])
  return `<h2>Récords</h2><div class="card"><p>Partidas jugadas: <b>${r.totalMatches}</b> · Empates: <b>${r.draws}</b></p><p>Mejor puntaje: <b class="ok">${r.bestScore ? esc(r.bestScore.name) + ' — ' + r.bestScore.score : '—'}</b></p></div>
    <div class="card"><h3>Victorias</h3>${w.length ? w.map(([n, c]) => `<p>${esc(n)}: <b>${c}</b></p>`).join('') : '<p class="mu">Sin datos.</p>'}</div>${back('mode')}`
}
function train() {
  const T = S.T
  if (!T) return `<div class="section-head"><p class="eyebrow">ZONA DE PRÁCTICA</p><h2>Entrena como un campeón</h2><p class="mu">Elige una disciplina, resuelve a tu ritmo y aprende del procedimiento.</p></div><div class="training-grid">${MODULES.map((m) => `<div class="training-module"><div class="training-module-top"><span>DISCIPLINA ${String(m.id).padStart(2,'0')}</span><span>${'★'.repeat(m.difficulty)}</span></div><b>${esc(m.name)}</b><p>${esc(m.theory)}</p><button data-a="tr" data-id="${m.id}">ENTRENAR →</button></div>`).join('')}</div>${back('mode')}`
  if (T.finished) return `<div class="training-result card pop"><div class="result-medal">🏅</div><p class="eyebrow">ENTRENAMIENTO COMPLETADO</p><h2>¡Buen trabajo!</h2><div class="training-score">${T.score}<small> PUNTOS</small></div><div class="training-stats"><span>✔ ${T.correct} correctas</span><span>🔥 Mejor racha: ${T.bestStreak}</span><span>📚 ${T.list.length} ejercicios</span></div><p class="mu">${T.correct === T.list.length ? '¡Perfecto! Dominaste todos los ejercicios de este módulo.' : 'Cada ejercicio es una oportunidad para mejorar. Repite el módulo y supera tu marca.'}</p><div class="row"><button data-a="tr" data-id="${T.id}">🔁 Repetir módulo</button><button class="pri" data-a="tend">Elegir otro módulo →</button></div></div>`
  const ex = T.list[T.i], done = T.picked !== null
  return `<div class="training-head"><div><p class="eyebrow">MODO ENTRENAMIENTO</p><h2>${esc(MODULES[T.id - 1].name)}</h2></div><div class="training-points">${T.score}<small>PTS</small></div></div><div class="training-progress">${progress(T.i + (done ? 1 : 0), T.list.length)}<span>RETO ${T.i + 1} / ${T.list.length}</span></div><div class="card training-question"><div class="question-meta"><span class="question-chip">🎯 PRÁCTICA LIBRE</span><span class="tag">🔥 RACHA ${T.streak}</span></div><div class="q">${eq(ex.statement)}</div></div>
    <div class="answer-title"><span>TU RESPUESTA</span><small>PIENSA ANTES DE ELEGIR</small></div><div class="opts">${ex.options.map((o, i) => `<button class="answer-option" data-a="tpick" data-i="${i}" ${done ? 'disabled' : ''} style="${done && i === ex.correctIndex ? 'border-color:var(--g);background:#0c392f' : done && i === T.picked ? 'border-color:var(--r);background:#421d2c' : ''}"><span class="option-letter">${String.fromCharCode(65+i)}</span><b>${esc(o)}</b></button>`).join('')}</div>
    ${done ? `<div class="card training-feedback pop"><b class="${T.picked === ex.correctIndex ? 'ok' : 'bad'}">${T.picked === ex.correctIndex ? '⚡ ¡RESPUESTA CORRECTA! +100 PTS' : '💡 NO TE RINDAS, ¡APRENDE DEL ERROR!'}</b><p>${esc(ex.explanation)}</p><ol class="st">${ex.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol><div class="training-feedback-foot"><span>Marcador: <b>${T.score} pts</b></span><span>Mejor racha: <b>${T.bestStreak}</b></span></div><button class="pri" data-a="tnext">${T.i + 1 < T.list.length ? 'Siguiente desafío →' : 'Ver resultados →'}</button></div>` : ''}<button class="ghost" data-a="tend">← Salir del entrenamiento</button>`
}
function render() {
  const m = S.match
  let h
  if (S.screen === 'match' && m) {
    if (m.phase === 'finished' && !S.saved) { S.saved = true; playTone(880, .35); try { saveMatch(store, summarizeMatch(m, 'p' + Date.now(), new Date().toISOString())) } catch { /* sin almacenamiento */ } }
    if (m.phase === 'roundResult' && (!S.battle || (S.battle.round !== m.round))) { createBattle(); S.battle.round = m.round }
    h = m.phase === 'handoff' ? handoff() : m.phase === 'turn' ? arena() : m.phase === 'roundResult' ? (S.battle?.done ? result() : battleView()) : final()
  } else h = (S.screen === 'history' ? history : S.screen === 'records' ? records : S.screen === 'train' ? train : SCREENS[S.screen] || SCREENS.home)()
  $app.innerHTML = `<header class="topbar"><button class="brand-mini" data-a="go" data-to="home"><span>∑</span> MATHEX <b>ARENA</b></button><div class="topbar-right"><span class="online-pill"><i class="live-dot"></i> LOCAL</span><button class="sound-toggle" data-a="sound" title="Activar o desactivar sonidos">${S.sound ? '🔊' : '🔇'} <span>SONIDO</span></button></div></header><main class="screen-content">${h}</main><footer class="site-footer"><span>MATHEX ARENA</span><span>APRENDE · COMPITE · SUPERA TUS LÍMITES</span><span class="presented-by">PRESENTADO POR ISABELLA</span></footer>`
  $app.style.animation = 'none'; void $app.offsetWidth; $app.style.animation = ''
  if (S.screen === 'match' && m?.phase === 'roundResult' && S.battle && !S.battle.done) startBattleLoop()
}
function startMatch(seed) {
  const d = +S.cfg.difficulty
  S.match = createMatch({ names: [S.names[0].trim() || 'Jugador 1', S.names[1].trim() || 'Jugador 2'], moduleIds: [...S.mods].sort((a, b) => a - b), seed, difficulty: d || undefined, config: { rounds: S.cfg.rounds, secondsPerQuestion: S.cfg.secondsPerQuestion } })
  S.saved = false; S.battle = null; S.screen = 'match'
}
const A = {
  go: (d) => { S.screen = d.to; if (d.to === 'train') S.T = null; render() },
  mod: (d) => { const id = +d.id; S.mods.has(id) ? S.mods.delete(id) : S.mods.add(id); S.notice = ''; render() },
  all: () => { S.mods = S.mods.size === 12 ? new Set() : new Set(MODULES.map((m) => m.id)); render() },
  'to-config': () => { if (!S.mods.size) { S.notice = '⚠ Elige al menos un módulo.'; return render() } S.screen = 'config'; render() },
  versus: () => {
    const r = Math.round(+S.cfg.rounds), s = Math.round(+S.cfg.secondsPerQuestion)
    S.cfg.rounds = Math.min(30, Math.max(1, r || 10)); S.cfg.secondsPerQuestion = Math.min(120, Math.max(10, s || 30)); savePrefs(); S.screen = 'versus'; render()
  },
  start: () => { startMatch((Date.now() % 900000) + 1); render() },
  rematch: () => { startMatch((Date.now() % 900000) + 1); render() },
  ready: () => { S.match = acknowledgeHandoff(S.match, Date.now()); render() },
  ans: (d) => { const m = S.match, pi = currentPlayerIndex(m), correct = +d.i === m.exercises[m.round][pi].correctIndex; playTone(correct ? 760 : 190, correct ? .18 : .24, correct ? 'sine' : 'triangle'); S.match = submitAnswer(S.match, +d.i, Date.now()); render() },
  pw: (d) => { S.match = usePower(S.match, d.p, Date.now()); render() },
  next: () => { S.battle = null; S.match = advanceRound(S.match); render() },
  sound: () => { S.sound = !S.sound; store.setItem('mathex-arena:sound', S.sound ? 'on' : 'off'); if (S.sound) playTone(620, .12); render() },
  tr: (d) => { const id = +d.id; S.T = { id, list: bank.filter((e) => e.moduleId === id), i: 0, picked: null, score: 0, streak: 0, bestStreak: 0, correct: 0, finished: false }; render() },
  tpick: (d) => { if (S.T && S.T.picked === null) { S.T.picked = +d.i; if (+d.i === S.T.list[S.T.i].correctIndex) { S.T.score += 100; S.T.correct++; S.T.streak++; S.T.bestStreak = Math.max(S.T.bestStreak, S.T.streak); playTone(760, .18) } else { S.T.streak = 0; playTone(190, .24, 'triangle') } render() } },
  tnext: () => { if (S.T.i + 1 < S.T.list.length) { S.T.i++; S.T.picked = null } else S.T.finished = true; render() },
  tend: () => { S.T = null; render() },
}
document.addEventListener('click', (e) => { const el = e.target.closest('[data-a]'); if (el && A[el.dataset.a]) A[el.dataset.a](el.dataset) })
document.addEventListener('input', (e) => {
  const t = e.target
  if (t.dataset && t.dataset.n !== undefined) { S.names[+t.dataset.n] = t.value; savePrefs() }
  else if (t.dataset && t.dataset.k) S.cfg[t.dataset.k] = t.value
})
setInterval(() => {
  const m = S.match
  if (S.screen !== 'match' || !m || m.phase !== 'turn') return
  const left = timeLeftMs(m, Date.now())
  if (left <= 0) { S.match = timeoutTurn(m, Date.now()); return render() }
  const tl = document.getElementById('tl'), tb = document.getElementById('tb')
  if (tl) tl.textContent = Math.ceil(left / 1000)
  if (tb) { tb.firstElementChild.style.width = (100 * left) / m.currentLimitMs + '%'; tb.classList.toggle('low', left < 8000) }
}, 250)
render()
export { DEFAULT_CONFIG }
