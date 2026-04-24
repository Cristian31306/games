<script setup>
import { ref, onMounted, computed } from 'vue'
import { io } from 'socket.io-client'

const socket = ref(null)
const myId = ref('')
const myName = ref('')
const roomId = ref('')
const joined = ref(false)
const isCreator = ref(false)

const loginView = ref('selection') // 'selection', 'join', 'create'

const gameState = ref({
  status: 'esperando',
  players: {},
  hostId: null,
  currentWord: '',
  currentCategory: '',
  guesserId: null,
  timer: 0,
  settings: {
    timerDuration: 60,
    category: 'Música'
  },
  lastTurnResult: null
})

const categories = ["Aleatoria", "Música", "TV y Cine", "Deportes", "Tendencias", "Lugares", "Comida"]
const timerOptions = [30, 60, 120, 180]

const generateCode = () => {
  return Math.random().toString(36).substring(2, 7).toUpperCase()
}

const startCreate = () => {
  roomId.value = generateCode()
  loginView.value = 'create'
}

const startJoin = () => {
  loginView.value = 'join'
}

const backToSelection = () => {
  loginView.value = 'selection'
  roomId.value = ''
}

const connect = (creatorMode = false) => {
  if (!myName.value || !roomId.value) return
  isCreator.value = creatorMode
  socket.value = io('/adivina')
  
  socket.value.on('connect', () => {
    myId.value = socket.value.id
    socket.value.emit('join', { name: myName.value, roomId: roomId.value.toUpperCase(), isCreator: creatorMode })
    joined.value = true
  })

  socket.value.on('stateUpdate', (newState) => {
    gameState.value = newState
  })

  socket.value.on('timerTick', (timeLeft) => {
    gameState.value.timer = timeLeft
  })
}

const startGame = () => {
  socket.value.emit('startGame')
}

const nextWord = (guessed) => {
  socket.value.emit('nextWord', guessed)
}

const updateSettings = () => {
  socket.value.emit('updateSettings', gameState.value.settings)
}

const confirmNextTurn = () => {
  socket.value.emit('confirmNextTurn')
}

const isHost = computed(() => gameState.value.hostId === myId.value)
const isGuesser = computed(() => gameState.value.guesserId === myId.value)
const playersList = computed(() => Object.values(gameState.value.players))
</script>

<template>
  <div class="app-shell">
    <div class="glass-bg"></div>
    
    <div class="game-container">
      <header v-if="joined" class="fade-in">
        <div class="brand">
          <div class="logo-icon"><i class="fas fa-ghost"></i></div>
          <h1>ADIVINA</h1>
        </div>
        <div class="room-badge">SALA {{ roomId }}</div>
      </header>

      <main>
        <!-- LOGIN FLOW (Matching STOP style) -->
        <div v-if="!joined" class="login-card bento-card slide-up">
          <h2>¡Bienvenido!</h2>
          
          <!-- View: Selection -->
          <div v-if="loginView === 'selection'" class="view-content">
            <p>Elige cómo quieres empezar a jugar.</p>
            <div class="field">
              <label>TU NOMBRE</label>
              <input v-model="myName" placeholder="Ej: Camilo" class="premium-input">
            </div>
            <div class="action-stack">
              <button class="main-btn" @click="startCreate" :disabled="!myName.trim()">
                CREAR NUEVA SALA
              </button>
              <div class="divider"><span>O</span></div>
              <button class="main-btn secondary-btn" @click="startJoin" :disabled="!myName.trim()">
                UNIRSE A UNA SALA
              </button>
            </div>
          </div>

          <!-- View: Create -->
          <div v-else-if="loginView === 'create'" class="view-content">
            <p>Comparte este código con tus amigos para jugar.</p>
            <div class="code-hero">{{ roomId }}</div>
            <button class="main-btn" @click="connect(true)">
              ENTRAR A LA SALA
            </button>
            <button class="back-link" @click="backToSelection"><i class="fas fa-arrow-left"></i> Volver</button>
          </div>

          <!-- View: Join -->
          <div v-else-if="loginView === 'join'" class="view-content">
            <p>Introduce el código de la sala de tu amigo.</p>
            <div class="field">
              <label>CÓDIGO DE SALA</label>
              <input v-model="roomId" placeholder="Ej: XJ92K" class="premium-input" @keyup.enter="connect(false)">
            </div>
            <button class="main-btn" @click="connect(false)" :disabled="!roomId.trim()">
              UNIRSE AHORA
            </button>
            <button class="back-link" @click="backToSelection"><i class="fas fa-arrow-left"></i> Volver</button>
          </div>
        </div>

        <!-- Lobby -->
        <div v-else-if="gameState.status === 'esperando'" class="lobby-view bento-card slide-up">
          <div class="view-header">
            <h3>Preparando Partida</h3>
            <div class="players-counter">{{ playersList.length }} jugadores listos</div>
          </div>

          <div class="players-grid">
            <div v-for="p in playersList" :key="p.id" class="player-card">
              <div class="avatar">{{ p.name[0].toUpperCase() }}</div>
              <span>{{ p.name }}</span>
              <div v-if="p.id === gameState.hostId" class="host-tag">HOST</div>
            </div>
          </div>

          <div v-if="isHost" class="host-settings">
            <div class="setting-row">
              <label>Categoría del mazo</label>
              <div class="category-selector">
                <button 
                  v-for="cat in categories" 
                  :key="cat" 
                  @click="gameState.settings.category = cat; updateSettings()"
                  :class="{ active: gameState.settings.category === cat }"
                >{{ cat }}</button>
              </div>
            </div>
            <div class="setting-row">
              <label>Tiempo de ronda</label>
              <div class="timer-selector">
                <button 
                  v-for="t in timerOptions" 
                  :key="t" 
                  @click="gameState.settings.timerDuration = t; updateSettings()"
                  :class="{ active: gameState.settings.timerDuration === t }"
                >{{ t }}s</button>
              </div>
            </div>
            <button @click="startGame" class="main-btn start-btn" :disabled="playersList.length < 2">
              {{ playersList.length < 2 ? 'ESPERANDO JUGADORES...' : '¡EMPEZAR YA!' }}
            </button>
          </div>
          <div v-else class="waiting-area">
            <div class="loader"></div>
            <p>El anfitrión está configurando la sala...</p>
          </div>
        </div>

        <!-- Fase de Juego -->
        <div v-else-if="gameState.status === 'jugando'" class="game-view fade-in">
          <div class="game-header">
            <div class="timer-bubble" :class="{ 'warning': gameState.timer <= 10 }">
              {{ gameState.timer }}s
            </div>
            <div class="turn-info">
              <span class="label">ADIVINA:</span>
              <span class="name">{{ gameState.players[gameState.guesserId]?.name }}</span>
            </div>
            <div class="score-bubble">Mis Puntos: {{ gameState.players[myId]?.points }}</div>
          </div>

          <div v-if="isGuesser" class="role-view guesser-side slide-up">
            <div class="physical-card hidden">
              <div class="card-back">
                <div class="ghost-icon"><i class="fas fa-ghost"></i></div>
                <h3>¡MIRA AL OTRO!</h3>
                <p>No veas tu pantalla ahora</p>
              </div>
            </div>
            <div class="instruction">¡Coloca el móvil en tu frente!</div>
          </div>

          <div v-else class="role-view clue-side slide-up">
            <div class="physical-card">
              <div class="card-front">
                <span class="cat-pill">{{ gameState.settings.category }}</span>
                <h2 class="word">{{ gameState.currentWord }}</h2>
              </div>
            </div>
            <div class="action-grid">
              <button @click="nextWord(true)" class="action-btn success">
                <i class="fas fa-check"></i> ADIVINÓ
              </button>
              <button @click="nextWord(false)" class="action-btn skip">
                <i class="fas fa-forward"></i> PASAR
              </button>
            </div>
          </div>
        </div>

        <!-- Transición de Turno -->
        <div v-else-if="gameState.status === 'resultadoTurno'" class="turn-transition bento-card slide-up">
          <div v-if="gameState.lastTurnResult?.guessed" class="result-icon success">
            <i class="fas fa-check-circle"></i>
          </div>
          <div v-else class="result-icon fail">
            <i class="fas fa-times-circle"></i>
          </div>

          <h2 v-if="gameState.lastTurnResult?.guessed">¡Punto para {{ gameState.lastTurnResult?.playerName }}!</h2>
          <h2 v-else>¡Se acabó el tiempo para {{ gameState.lastTurnResult?.playerName }}!</h2>
          
          <div class="word-reveal">
            <span class="label">LA PALABRA ERA:</span>
            <div class="word">{{ gameState.lastTurnResult?.word }}</div>
          </div>

          <div class="next-player-preview">
            Siguiente en adivinar: <strong>{{ gameState.players[gameState.guesserId]?.name }}</strong>
          </div>

          <button v-if="isHost" @click="confirmNextTurn" class="main-btn">
            Siguiente Turno <i class="fas fa-arrow-right"></i>
          </button>
          <div v-else class="waiting-footer">Esperando que el host inicie el siguiente turno...</div>
        </div>

        <!-- Resultados -->
        <div v-else-if="gameState.status === 'resultados'" class="results-view bento-card slide-up">
          <div class="trophy-icon"><i class="fas fa-trophy"></i></div>
          <h2>Posiciones</h2>
          
          <div class="scoreboard">
            <div v-for="p in playersList.sort((a,b) => b.points - a.points)" :key="p.id" class="score-row">
              <div class="player-info">
                <div class="mini-avatar">{{ p.name[0] }}</div>
                <span>{{ p.name }}</span>
              </div>
              <div class="player-points">{{ p.points }} pts</div>
            </div>
          </div>

          <button v-if="isHost" @click="startGame" class="main-btn">JUGAR OTRA VEZ</button>
          <div v-else class="waiting-footer">Esperando que el host inicie otra partida...</div>
        </div>
      </main>
    </div>
  </div>
</template>

<style>
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css');

:root {
  --primary: #2563eb;
  --success: #10b981;
  --danger: #ef4444;
  --bg: #f8fafc;
  --text: #0f172a;
  --text-dim: #475569;
  --card-bg: rgba(255, 255, 255, 0.95);
  --radius: 32px;
  --shadow: 0 10px 30px rgba(0,0,0,0.04);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: 'Outfit', sans-serif;
  background: var(--bg);
  color: var(--text);
  overflow-x: hidden;
}

.app-shell {
  min-height: 100vh;
  position: relative;
}

.glass-bg {
  position: fixed;
  inset: 0;
  background: 
    radial-gradient(circle at 0% 0%, rgba(37, 99, 235, 0.03) 0%, transparent 40%),
    radial-gradient(circle at 100% 100%, rgba(124, 58, 237, 0.03) 0%, transparent 40%);
  z-index: -1;
}

.game-container {
  max-width: 1000px; /* Aumentado para PC */
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

@media (min-width: 768px) {
  .game-container {
    padding: 4rem 2rem;
  }
  
  .lobby-view, .results-view, .login-card {
    max-width: 800px;
    margin: 0 auto;
  }
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3rem;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.logo-icon {
  font-size: 1.5rem;
  color: var(--primary);
}

header h1 {
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: 3px;
  margin: 0;
  color: #000;
}

.room-badge {
  background: #fff;
  padding: 0.5rem 1.2rem;
  border-radius: 100px;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 1px;
  box-shadow: var(--shadow);
  border: 1px solid rgba(0,0,0,0.05);
}

.bento-card {
  background: var(--card-bg);
  border-radius: var(--radius);
  padding: 2rem;
  border: 1px solid rgba(0,0,0,0.05);
  box-shadow: 0 20px 40px rgba(0,0,0,0.05);
}

@media (min-width: 768px) {
  .bento-card {
    padding: 4rem;
  }
}

h2 {
  font-size: 2.2rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
  color: #000;
  text-align: center;
}

p {
  color: var(--text-dim);
  text-align: center;
  margin-bottom: 2.5rem;
  font-size: 1rem;
}

/* Inputs */
.field { margin-bottom: 2.5rem; text-align: left; }
.field label {
  display: block;
  font-size: 0.85rem;
  font-weight: 800;
  color: #000;
  margin-bottom: 0.8rem;
  letter-spacing: 1px;
}

.premium-input {
  width: 100%;
  padding: 1.2rem;
  background: #fff;
  border: 2px solid #e2e8f0;
  border-radius: 18px;
  font-size: 1.2rem;
  color: #000;
  outline: none;
  transition: all 0.3s ease;
}

.premium-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
}

/* Buttons */
.action-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.main-btn {
  width: 100%;
  padding: 1.3rem;
  background: #000;
  color: #fff;
  border: none;
  border-radius: 18px;
  font-weight: 800;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.main-btn:hover:not(:disabled) {
  background: var(--primary);
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.2);
}

.main-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary-btn {
  background: #f1f5f9;
  color: #000;
}

.divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: #cbd5e1;
  font-size: 0.8rem;
  font-weight: 800;
}

.divider::before, .divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e2e8f0;
}

.code-hero {
  font-size: 4rem;
  font-weight: 900;
  color: var(--primary);
  letter-spacing: 8px;
  margin: 2rem 0;
  text-align: center;
}

.back-link {
  background: none;
  border: none;
  color: var(--text-dim);
  margin-top: 2rem;
  cursor: pointer;
  font-weight: 600;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

/* Lobby Styling */
.lobby-view { text-align: center; }
.view-header { margin-bottom: 2.5rem; }
.view-header h3 { font-size: 1.8rem; font-weight: 800; color: #000; margin-bottom: 0.5rem; }
.players-counter { font-size: 0.9rem; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 1px; }

.players-grid {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1.5rem;
  margin: 3rem 0;
}

@media (min-width: 768px) {
  .players-grid {
    gap: 3rem;
  }
}

.player-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  position: relative;
}

.avatar {
  width: 70px;
  height: 70px;
  background: #fff;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.5rem;
  color: var(--primary);
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 25px rgba(0,0,0,0.05);
  transition: transform 0.3s ease;
}

.player-card span {
  font-weight: 700;
  color: #0f172a;
  font-size: 1rem;
}

.host-tag {
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 0.6rem;
  font-weight: 900;
  background: #000;
  color: #fff;
  padding: 0.3rem 0.6rem;
  border-radius: 8px;
  letter-spacing: 1px;
}

.host-settings {
  text-align: left;
  background: #f8fafc;
  padding: 2rem;
  border-radius: 24px;
  margin-top: 2rem;
  border: 1px solid #e2e8f0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 768px) {
  .host-settings {
    grid-template-columns: 1fr 1fr;
    align-items: end;
    gap: 2rem;
    padding: 3rem;
  }
  .start-btn {
    grid-column: span 2;
  }
}

.setting-row {
  margin-bottom: 2rem;
}

.setting-row label {
  display: block;
  font-size: 0.85rem;
  font-weight: 800;
  color: #000;
  margin-bottom: 1rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.category-selector, .timer-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.category-selector button, .timer-selector button {
  padding: 0.8rem 1.4rem;
  border: 2px solid #e2e8f0;
  background: #fff;
  border-radius: 14px;
  font-size: 0.9rem;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  transition: all 0.3s ease;
}

.category-selector button:hover, .timer-selector button:hover {
  border-color: #cbd5e1;
  background: #f1f5f9;
}

.category-selector button.active, .timer-selector button.active {
  background: #000;
  color: #fff;
  border-color: #000;
  box-shadow: 0 10px 20px rgba(0,0,0,0.1);
}

.start-btn {
  margin-top: 1rem;
  height: 70px;
  font-size: 1.2rem;
  letter-spacing: 1px;
}

.physical-card {
  width: 100%;
  max-width: 600px;
  height: 380px;
  margin: 0 auto;
  background: #fff;
  border-radius: 40px;
  box-shadow: 0 40px 80px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border: 1px solid rgba(0,0,0,0.03);
}

@media (min-width: 768px) {
  .physical-card {
    height: 450px;
  }
}

.card-front { text-align: center; padding: 2rem; }
.cat-pill { background: #f1f5f9; color: var(--primary); padding: 0.6rem 1.5rem; border-radius: 100px; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; }
.word { font-size: 3.8rem; font-weight: 800; margin: 2rem 0; line-height: 1; color: #000; }

/* Game Views */
.game-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem; }
.timer-bubble { background: #fff; padding: 0.8rem 1.8rem; border-radius: 100px; font-weight: 900; color: var(--primary); box-shadow: var(--shadow); flex-shrink: 0; }
.timer-bubble.warning { color: var(--danger); animation: pulse 1s infinite; }
.score-bubble { background: #000; color: #fff; padding: 0.8rem 1.8rem; border-radius: 100px; font-weight: 900; flex-shrink: 0; }

.turn-info {
  text-align: center;
  display: flex;
  flex-direction: column;
}
.turn-info .label { font-size: 0.6rem; font-weight: 900; color: var(--text-dim); letter-spacing: 1px; }
.turn-info .name { font-size: 1.1rem; font-weight: 800; color: #000; }

/* Scoreboard */
.scoreboard {
  margin: 2rem 0 3rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.score-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  padding: 1rem 1.5rem;
  border-radius: 18px;
  border: 1px solid #e2e8f0;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.mini-avatar {
  width: 32px;
  height: 32px;
  background: #fff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  color: var(--primary);
  font-size: 0.8rem;
  border: 1px solid #e2e8f0;
}

.player-info span { font-weight: 700; color: #000; }
.player-points { font-weight: 900; color: var(--primary); }

.waiting-footer {
  text-align: center;
  color: var(--text-dim);
  font-weight: 600;
  font-size: 0.9rem;
}

/* Transición de Turno */
.turn-transition {
  text-align: center;
}

.result-icon {
  font-size: 5rem;
  margin-bottom: 1.5rem;
}
.result-icon.success { color: var(--success); }
.result-icon.fail { color: var(--danger); }

.word-reveal {
  margin: 2.5rem 0;
  padding: 2rem;
  background: #f1f5f9;
  border-radius: 24px;
}
.word-reveal .label {
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--text-dim);
  letter-spacing: 2px;
}

.next-player-preview {
  margin-bottom: 2.5rem;
  font-size: 1.1rem;
  color: #0f172a;
}
.next-player-preview strong { color: var(--primary); }

.action-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; margin-top: 2.5rem; }
.action-btn { padding: 1.6rem; border-radius: 24px; border: none; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.8rem; transition: transform 0.2s; }
.action-btn.success { background: var(--success); color: #fff; }
.action-btn.skip { background: #e2e8f0; color: #000; }
.action-btn:active { transform: scale(0.95); }

.hidden { background: #0f172a; color: #fff; }
.ghost-icon { font-size: 4rem; margin-bottom: 1.5rem; color: rgba(255,255,255,0.1); }
.instruction { margin-top: 2.5rem; text-align: center; color: var(--text-dim); font-weight: 700; font-size: 1rem; }

.trophy-icon { font-size: 6rem; color: #f59e0b; margin-bottom: 1.5rem; text-align: center; display: block; }


/* Animations */
.fade-in { animation: fadeIn 0.8s ease; }
.slide-up { animation: slideUp 0.6s cubic-bezier(0.23, 1, 0.32, 1); }

@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
</style>
