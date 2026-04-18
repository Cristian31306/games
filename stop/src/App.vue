<script setup>
import { ref, onMounted, computed } from 'vue'
import { io } from 'socket.io-client'

// Componentes
import GameBoard from './components/GameBoard.vue'
import Validador from './components/Validador.vue'
import Resultados from './components/Resultados.vue'
import Login from './components/Login.vue'

const socket = ref(null)
const gameState = ref({
  status: 'esperando',
  letter: '',
  players: {},
  rounds: []
})

const myId = ref('')
const myName = ref('')
const joined = ref(false)

const boardRef = ref(null)

const connectSocket = (name) => {
  myName.value = name
  // Usamos la IP local actual para que la pareja pueda conectarse
  const serverUrl = `${window.location.protocol}//${window.location.hostname}:3001`
  socket.value = io(serverUrl)
  
  socket.value.on('connect', () => {
    myId.value = socket.value.id
    socket.value.emit('join', name)
    joined.value = true
  })

  socket.value.on('stateUpdate', (newState) => {
    gameState.value = newState
  })

  socket.value.on('stopTriggered', ({ stopperId, stopperName }) => {
    // Si yo no fui el que dio STOP, envío mis respuestas de inmediato
    if (stopperId !== myId.value && boardRef.value) {
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

const handleResetGame = () => {
  socket.value.emit('resetGame')
}

const me = computed(() => gameState.value.players[myId.value] || {})
const otherId = computed(() => {
  const ids = Object.keys(gameState.value.players)
  return ids.find(id => id !== myId.value) || null
})
const otherPlayer = computed(() => {
  return gameState.value.players[otherId.value] || null
})

</script>

<template>
  <div class="app-container">
    <header v-if="joined">
      <h1>STOP! <span v-if="gameState.letter" class="letter-glow">{{ gameState.letter }}</span></h1>
      <div class="players-info" v-if="joined">
        <div class="player-tag">
          <span class="dot online"></span> {{ myName }} (Tú): {{ me.points }} pts
        </div>
        <div class="player-tag" v-if="otherPlayer">
          <span class="dot online"></span> {{ otherPlayer.name }}: {{ otherPlayer.points }} pts
        </div>
        <div class="player-tag waiting" v-else>
          <span class="dot"></span> Esperando pareja...
        </div>
      </div>
    </header>

    <main>
      <transition name="fade" mode="out-in">
        <!-- Pantalla de Login -->
        <Login v-if="!joined" @join="connectSocket" />

        <!-- Pantalla de Espera -->
        <div v-else-if="gameState.status === 'esperando'" class="view-center">
          <div class="bento-card active-glow" style="text-align: center; max-width: 400px;">
            <p v-if="!otherPlayer">Envía el link a tu pareja para empezar.</p>
            <p v-else>¡Listos para jugar con {{ otherPlayer.name }}!</p>
            <button 
              class="stop-btn" 
              style="font-size: 1.2rem; margin-top: 1.5rem; width: 100%; border-radius: 12px; height: 60px;"
              :disabled="!otherPlayer"
              @click="startRound"
            >
              EMPEZAR PARTIDA
            </button>
          </div>
        </div>

        <!-- Pantalla de Juego -->
        <GameBoard 
          v-else-if="gameState.status === 'jugando'" 
          ref="boardRef"
          :letter="gameState.letter"
          :is-disabled="false"
          @stop="handleStop"
          @skip="handleSkipLetter"
          :ready-to-skip="me.readyToSkip"
        />

        <!-- Pantalla de Calificación -->
        <Validador 
          v-else-if="gameState.status === 'calificando'"
          :me="me"
          :my-id="myId"
          :other="otherPlayer"
          :other-id="otherId"
          @finish="handleFinishCalibration"
        />

        <!-- Pantalla de Resultados -->
        <Resultados 
          v-else-if="gameState.status === 'resultados'"
          :rounds="gameState.rounds"
          :players="gameState.players"
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
  margin-bottom: 3rem;
  text-align: center;
}

.letter-glow {
  color: var(--accent-color);
  text-shadow: 0 0 20px var(--accent-glow);
  margin-left: 1rem;
}

.players-info {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-top: 1rem;
}

.player-tag {
  background: var(--glass-bg);
  padding: 0.5rem 1.2rem;
  border-radius: 100px;
  border: 1px solid var(--glass-border);
  display: flex;
  align-items: center;
  gap: 0.8rem;
  font-weight: 500;
  font-size: 0.9rem;
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
