<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { io } from 'socket.io-client'
import { playTick, playBuzzer, playWin } from './utils/audio'

// Componentes
import GameBoard from './components/GameBoard.vue'
import Validador from './components/Validador.vue'
import Resultados from './components/Resultados.vue'
import Login from './components/Login.vue'

const socket = ref(null)
const DEFAULT_CATEGORIES = [
  { id: 'nombre', label: 'Nombre', icon: '👤' },
  { id: 'apellido', label: 'Apellido', icon: '👥' },
  { id: 'ciudad', label: 'Ciudad / País', icon: '📍' },
  { id: 'cosa', label: 'Cosa', icon: '📦' },
  { id: 'color', label: 'Color', icon: '🎨' },
  { id: 'fruta', label: 'Fruta / Verdura', icon: '🍎' },
  { id: 'animal', label: 'Animal', icon: '🦁' }
]

const gameState = ref({
  status: 'esperando',
  letter: '',
  players: {},
  rounds: [],
  hostId: null,
  timer: 0,
  validation: {},
  settings: {
    timerDuration: 0,
    categories: [...DEFAULT_CATEGORIES]
  }
})

const localSettings = ref({
  timerDuration: 0,
  categories: [...DEFAULT_CATEGORIES]
})

const isHost = computed(() => gameState.value.hostId === myId.value)
const otherPlayers = computed(() => {
  return Object.values(gameState.value.players).filter(p => p.id !== myId.value)
})

const myId = ref('')
const myName = ref('')
const currentRoomId = ref('')
const joined = ref(false)

const boardRef = ref(null)


const connectSocket = ({ name, roomId, isCreator }) => {
  myName.value = name
  currentRoomId.value = roomId
  // Conexión al namespace unificado /stop
  socket.value = io('/stop')
  
  socket.value.on('connect', () => {
    myId.value = socket.value.id
    socket.value.emit('join', { name, roomId, isCreator })
    joined.value = true
  })

  socket.value.on('stateUpdate', (newState) => {
    const oldStatus = gameState.value.status
    gameState.value = newState
    
    if (isHost.value && oldStatus !== 'esperando' && newState.status === 'esperando') {
      localSettings.value = JSON.parse(JSON.stringify(newState.settings))
    }
    if (oldStatus !== 'resultados' && newState.status === 'resultados') {
      playWin()
    }
  })
/*
  socket.value.on('timerTick', (timeLeft) => {
    gameState.value.timer = timeLeft
    if (timeLeft <= 5 && timeLeft > 0) {
      playTick()
    }
  }) */

  socket.value.on('stopTriggered', ({ stopperId, stopperName }) => {
    playBuzzer()
    // Si yo no fui el que dio STOP, envío mis respuestas de inmediato
    if (stopperId !== myId.value && stopperId !== 'system' && boardRef.value) {
      socket.value.emit('submitAnswers', boardRef.value.answers)
    }
    console.log(`¡STOP! por ${stopperName}`)
  })
}

const startRound = () => {
  socket.value.emit('startRound')
}

const handleStop = (answers) => {
  socket.value.emit('stop', answers)
}

const handleSubmitAnswers = (answers) => {
  socket.value.emit('submitAnswers', answers)
}

const handleFinishCalibration = (points) => {
  socket.value.emit('finishCalibration', points)
}

const handleSkipLetter = () => {
  socket.value.emit('skipLetter')
}

const updateSettings = () => {
  if (isHost.value) {
    socket.value.emit('updateSettings', localSettings.value)
  }
}

const changeTimer = (val) => {
  localSettings.value.timerDuration = val 
  updateSettings()
}

const handleToggleWord = ({ targetPlayerId, categoryId }) => {
  if (socket.value) {
    socket.value.emit('toggleWord', { targetPlayerId, categoryId })
  }
}

const handleResetGame = () => {
  socket.value.emit('resetGame')
}

const me = computed(() => gameState.value.players[myId.value] || {})
</script>

<template>
  <div class="app-container">
    <a href="/" style="position: fixed; top: 1rem; right: 2rem; color: #666; text-decoration: none; font-size: 0.9rem; z-index: 100;">🏠 Volver al Lobby</a>
    <header v-if="joined">
      <h1>STOP! <span v-if="gameState.letter" class="letter-glow">{{ gameState.letter }}</span></h1>
      <div v-if="currentRoomId" class="room-id-tag">SALA: <span>{{ currentRoomId }}</span></div>
      <div class="players-info" v-if="joined">
        <div class="player-tag">
          <span class="dot online"></span> {{ myName }} (Tú): {{ me.points || 0 }} pts
        </div>
        <div class="player-tag" v-for="p in otherPlayers" :key="p.id">
          <span class="dot online"></span> {{ p.name }}: {{ p.points || 0 }} pts
        </div>
        <div class="player-tag waiting" v-if="otherPlayers.length === 0">
          <span class="dot"></span> Esperando jugadores...
        </div>
      </div>
      

    </header>

    <main>
      <transition name="fade" mode="out-in">
        <!-- Pantalla de Login -->
        <Login v-if="!joined" @join="connectSocket" />

        <!-- Pantalla de Espera (Lobby) -->
        <div v-else-if="gameState.status === 'esperando'" class="view-center">
          <div class="bento-card active-glow lobby-card">
            
            <div v-if="isHost" class="host-controls">
              <h3>Configuración (Anfitrión)</h3>
              


              <div class="control-group">
                <label>Categorías (Fijas):</label>
                <div class="cat-list">
                  <div class="cat-pill" v-for="c in localSettings.categories" :key="c.id">
                    {{ c.icon }} {{ c.label }}
                  </div>
                </div>
              </div>

              <button 
                class="stop-btn start-match-btn" 
                :disabled="otherPlayers.length === 0"
                @click="startRound"
              >
                {{ otherPlayers.length > 0 ? 'EMPEZAR PARTIDA' : 'ESPERANDO JUGADORES...' }}
              </button>
            </div>
            
            <div v-else class="guest-view">
              <h3>Sala de Espera</h3>
              <p>El anfitrión {{ gameState.players[gameState.hostId]?.name || '' }} está configurando la partida...</p>
              <ul class="guest-categories">
                <li v-for="c in gameState.settings.categories" :key="c.id">{{ c.icon }} {{ c.label }}</li>
              </ul>

            </div>
            
          </div>
        </div>

        <!-- Pantalla de Juego -->
        <GameBoard 
          v-else-if="gameState.status === 'jugando'" 
          ref="boardRef"
          :letter="gameState.letter"
          :categories="gameState.settings.categories"
          :is-disabled="false"
          @stop="handleStop"
          @skip="handleSkipLetter"
          :ready-to-skip="me.readyToSkip"
        />

        <!-- Pantalla de Calificación -->
        <Validador 
          v-else-if="gameState.status === 'calificando'"
          :my-id="myId"
          :players="gameState.players"
          :categories="gameState.settings.categories"
          :validation="gameState.validation"
          @finish="handleFinishCalibration"
          @toggle="handleToggleWord"
        />

        <!-- Pantalla de Resultados -->
        <Resultados 
          v-else-if="gameState.status === 'resultados'"
          :rounds="gameState.rounds"
          :players="gameState.players"
          :categories="gameState.settings.categories"
          @next="startRound"
          @reset="handleResetGame"
        />
      </transition>
    </main>
  </div>
</template>

<style>
.app-container {
  max-width: 1100px;
  margin: 0 auto;
}

header {
  margin-bottom: 2rem;
  text-align: center;
  background: var(--bg-color);
  z-index: 100;
  padding: 2rem 0.5rem;
  border-bottom: 1px solid var(--glass-border);
}

header h1 {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), margin 0.3s ease;
  transform-origin: center;
  margin: 0;
  will-change: transform;
}



.room-id-tag {
  display: inline-block;
  background: rgba(255,255,255,0.05);
  padding: 0.4rem 1.2rem;
  border-radius: 50px;
  border: 1px solid var(--glass-border);
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0.5rem 0;
  letter-spacing: 2px;
}
.room-id-tag span {
  color: var(--accent-color);
  font-weight: 800;
}

.letter-glow {
  color: var(--accent-color);
  text-shadow: 0 0 20px var(--accent-glow);
  margin-left: 1rem;
}



.players-info {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.player-tag {
  background: var(--glass-bg);
  padding: 0.4rem 1rem;
  border-radius: 100px;
  border: 1px solid var(--glass-border);
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 500;
  font-size: 0.85rem;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3f3f46;
}

.dot.online {
  background: #10b981;
  box-shadow: 0 0 10px #10b981;
}

.view-center {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 40vh;
}

.global-timer {
  font-size: 3rem;
  font-weight: 900;
  color: var(--accent-color);
  text-shadow: 0 0 20px var(--accent-glow);
  margin-top: 1rem;
}

.lobby-card {
  width: 100%;
  max-width: 600px;
  padding: 2rem;
}

.host-controls h3, .guest-view h3 {
  margin-bottom: 2rem;
  text-align: center;
}

.control-group {
  margin-bottom: 2rem;
}
.control-group label {
  display: block;
  font-weight: 800;
  margin-bottom: 1rem;
  color: var(--text-secondary);
}

.btn-group {
  display: flex;
  gap: 1rem;
}
.btn-group button {
  flex: 1;
  padding: 0.8rem;
  border-radius: 8px;
  border: 1px solid var(--glass-border);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
}
.btn-group button.active {
  background: var(--accent-color);
  border-color: var(--accent-color);
  font-weight: bold;
}

.cat-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
}
.cat-pill {
  background: rgba(255,255,255,0.05);
  padding: 0.5rem 1rem;
  border-radius: 50px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.remove-cat {
  cursor: pointer;
  color: #ef4444;
  margin-left: 0.5rem;
}
.add-cat-btn {
  background: transparent;
  border: 1px dashed var(--glass-border);
  color: var(--text-secondary);
  padding: 0.5rem 1rem;
  border-radius: 50px;
  cursor: pointer;
}

.start-match-btn {
  width: 100%;
  padding: 1.2rem;
  font-size: 1.1rem;
  border-radius: 12px;
  margin-top: 1rem;
}

.guest-view {
  text-align: center;
}
.guest-categories {
  list-style: none;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
  margin: 2rem 0;
}
.guest-categories li {
  background: rgba(255,255,255,0.05);
  padding: 0.5rem 1rem;
  border-radius: 8px;
}

/* Transiciones */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
