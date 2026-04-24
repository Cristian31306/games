<script setup>
import { ref, onMounted, computed } from 'vue'
import { io } from 'socket.io-client'

const socket = ref(null)
const myId = ref('')
const myName = ref('')
const roomId = ref('')
const joined = ref(false)
const isCreator = ref(false)
const loginView = ref('selection')

const gameState = ref({
  status: 'esperando',
  players: {},
  hostId: null,
  currentPlayerId: null,
  currentCategory: '',
  isExploded: false,
  loserId: null
})

const generateCode = () => Math.random().toString(36).substring(2, 7).toUpperCase()
const startCreate = () => { roomId.value = generateCode(); loginView.value = 'create' }
const startJoin = () => { loginView.value = 'join' }
const backToSelection = () => { loginView.value = 'selection'; roomId.value = '' }

const connect = (creatorMode = false) => {
  if (!myName.value || !roomId.value) return
  isCreator.value = creatorMode
  socket.value = io('/bomba')
  
  socket.value.on('connect', () => {
    myId.value = socket.value.id
    socket.value.emit('join', { name: myName.value, roomId: roomId.value.toUpperCase(), isCreator: creatorMode })
    joined.value = true
  })

  socket.value.on('stateUpdate', (newState) => {
    gameState.value = newState
  })

  socket.value.on('exploded', () => {
    // Aquí se podría disparar un sonido de explosión
    if (window.navigator.vibrate) window.navigator.vibrate([100, 50, 100, 50, 300])
  })
}

const startGame = () => socket.value.emit('startGame')
const passBomb = () => socket.value.emit('passBomb')
const resetGame = () => socket.value.emit('resetGame')

const isHost = computed(() => gameState.value.hostId === myId.value)
const isMyTurn = computed(() => gameState.value.currentPlayerId === myId.value)
const playersList = computed(() => Object.values(gameState.value.players))
</script>

<template>
  <div class="app-shell" :class="{ 'my-turn-bg': isMyTurn && gameState.status === 'jugando' }">
    <div class="glass-bg"></div>
    <a href="/" style="position: fixed; top: 1rem; right: 2rem; color: #666; text-decoration: none; font-size: 0.9rem; z-index: 100;">🏠 Volver al Lobby</a>
    
    <div class="game-container">
      <header v-if="joined" class="fade-in">
        <div class="brand">
          <div class="logo-icon"><i class="fas fa-bomb"></i></div>
          <h1>BOMBA CALIENTE</h1>
        </div>
        <div class="room-badge">SALA {{ roomId }}</div>
      </header>

      <main>
        <!-- LOGIN FLOW -->
        <div v-if="!joined" class="login-card bento-card slide-up active-glow">
          <h2>¡Bienvenido a BOMBA CALIENTE!</h2>
          
          <div v-if="loginView === 'selection'" class="view-content">
            <p>Elige cómo quieres empezar a jugar.</p>
            <div class="field">
              <label>TU NOMBRE</label>
              <input v-model="myName" placeholder="Ej: Juan" class="premium-input">
            </div>
            <div class="action-stack">
              <button class="main-btn" @click="startCreate" :disabled="!myName.trim()">CREAR NUEVA SALA</button>
              <div class="divider"><span>O</span></div>
              <button class="main-btn secondary-btn" @click="startJoin" :disabled="!myName.trim()">UNIRSE A UNA SALA</button>
            </div>
          </div>

          <div v-else-if="loginView === 'create'" class="view-content">
            <p>Comparte este código con tus amigos para jugar.</p>
            <div class="code-hero">{{ roomId }}</div>
            <button class="main-btn" @click="connect(true)">ENTRAR A LA SALA</button>
            <button class="back-link" @click="backToSelection"><i class="fas fa-arrow-left"></i> Volver</button>
          </div>

          <div v-else-if="loginView === 'join'" class="view-content">
            <p>Introduce el código de la sala de tu amigo.</p>
            <div class="field">
              <label>CÓDIGO DE SALA</label>
              <input v-model="roomId" placeholder="Ej: XJ92K" class="premium-input" @keyup.enter="connect(false)">
            </div>
            <button class="main-btn" @click="connect(false)" :disabled="!roomId.trim()">UNIRSE AHORA</button>
            <button class="back-link" @click="backToSelection">← Volver</button>
          </div>
        </div>

        <!-- LOBBY -->
        <div v-else-if="gameState.status === 'esperando'" class="lobby-view bento-card slide-up">
          <div class="view-header">
            <h3>Sala de Espera</h3>
            <div class="players-counter">{{ playersList.length }} valientes listos</div>
          </div>
          <div class="players-grid">
            <div v-for="p in playersList" :key="p.id" class="player-card">
              <div class="avatar">{{ p.name[0].toUpperCase() }}</div>
              <span>{{ p.name }}</span>
              <div v-if="p.id === gameState.hostId" class="host-tag">HOST</div>
            </div>
          </div>
          <button v-if="isHost" @click="startGame" class="main-btn start-btn" :disabled="playersList.length < 2">
            {{ playersList.length < 2 ? 'FALTAN JUGADORES' : '¡SOLTAR LA BOMBA!' }}
          </button>
          <div v-else class="waiting-area"><p>El host iniciará pronto...</p></div>
        </div>

        <!-- JUEGO -->
        <div v-else-if="gameState.status === 'jugando'" class="game-view fade-in">
          <div class="category-card bento-card slide-up">
            <span class="label">CATEGORÍA:</span>
            <h2>{{ gameState.currentCategory }}</h2>
          </div>

          <div class="bomb-area">
            <div class="bomb-container" :class="{ 'active-bomb': isMyTurn }">
              <div class="bomb-wick">
                <div class="spark"></div>
              </div>
              <div class="bomb-body">
                <i class="fas fa-bomb"></i>
              </div>
            </div>
            <div class="turn-label">
              <span v-if="isMyTurn" class="my-turn-text">¡LA TIENES TÚ! ¡DI ALGO!</span>
              <span v-else>La tiene: <strong>{{ gameState.players[gameState.currentPlayerId]?.name }}</strong></span>
            </div>
          </div>

          <div v-if="isMyTurn" class="action-area slide-up">
            <button @click="passBomb" class="main-btn pass-btn pulse-animation">
              ¡PASAR BOMBA! <i class="fas fa-share"></i>
            </button>
          </div>
        </div>

        <!-- EXPLOSIÓN -->
        <div v-else-if="gameState.status === 'explosion'" class="explosion-view bento-card slide-up">
          <div class="explosion-icon"><i class="fas fa-fire-alt"></i></div>
          <h2 class="boom-text">¡BOOOOOM!</h2>
          <div class="loser-card">
            <p>Le explotó a:</p>
            <h3>{{ gameState.players[gameState.loserId]?.name }}</h3>
          </div>
          <div class="lives-left" v-if="gameState.players[gameState.loserId]">
            Vidas restantes: 
            <i v-for="n in gameState.players[gameState.loserId].lives" :key="n" class="fas fa-heart text-danger"></i>
          </div>
          <button v-if="isHost" @click="startGame" class="main-btn">JUGAR OTRA RONDA</button>
          <div v-else class="waiting-footer">Esperando al host...</div>
        </div>

        <!-- FINAL -->
        <div v-else-if="gameState.status === 'final'" class="explosion-view bento-card slide-up">
          <div class="explosion-icon"><i class="fas fa-skull-crossbones"></i></div>
          <h2 class="boom-text">PARTIDA TERMINADA</h2>
          <div class="loser-card">
            <p>El gran perdedor es:</p>
            <h3>{{ gameState.players[gameState.loserId]?.name }}</h3>
          </div>
          <p>¡Se quedó sin vidas!</p>
          
          <div class="action-stack" v-if="isHost">
            <button @click="resetGame" class="main-btn">VOLVER AL LOBBY</button>
          </div>
          <div v-else class="waiting-footer">El host decidirá si jugar otra partida...</div>
        </div>
      </main>
    </div>
  </div>
</template>

<style>
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css');

:root {
  --primary: #2563eb;
  --danger: #ef4444;
  --bg: #f8fafc;
  --text: #0f172a;
  --radius: 32px;
}

body { margin: 0; font-family: 'Outfit', sans-serif; background: var(--bg); color: var(--text); overflow-x: hidden; }

.app-shell { min-height: 100vh; transition: background 0.3s ease; }
.my-turn-bg { background: rgba(239, 68, 68, 0.05); }

.game-container { max-width: 800px; margin: 0 auto; padding: 2rem 1.5rem; }
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
.brand { display: flex; align-items: center; gap: 0.8rem; }
.logo-icon { color: #000; font-size: 1.5rem; }
header h1 { font-size: 1.1rem; font-weight: 900; letter-spacing: 2px; margin: 0; }
.room-badge { background: #fff; padding: 0.5rem 1rem; border-radius: 100px; font-size: 0.7rem; font-weight: 800; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }

.bento-card { background: #fff; border-radius: var(--radius); padding: 2.5rem; box-shadow: 0 20px 40px rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.05); }

/* Bomb Animation */
.bomb-area { display: flex; flex-direction: column; align-items: center; margin: 3rem 0; }
.bomb-container { position: relative; width: 150px; height: 150px; transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.bomb-body { width: 100%; height: 100%; background: #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 4rem; position: relative; z-index: 2; box-shadow: 0 15px 35px rgba(0,0,0,0.2); }
.bomb-wick { position: absolute; top: -20px; right: 30px; width: 10px; height: 30px; background: #634b35; border-radius: 5px; transform: rotate(20deg); }
.spark { position: absolute; top: -10px; left: -5px; width: 20px; height: 20px; background: #fbbf24; border-radius: 50%; filter: blur(5px); animation: flicker 0.1s infinite alternate; }

.active-bomb { transform: scale(1.2); animation: shake 0.5s infinite; }
.active-bomb .bomb-body { background: var(--danger); box-shadow: 0 15px 35px rgba(239, 68, 68, 0.3); }

@keyframes flicker { from { opacity: 0.5; transform: scale(0.8); } to { opacity: 1; transform: scale(1.2); } }
@keyframes shake { 0% { transform: scale(1.2) rotate(0); } 25% { transform: scale(1.2) rotate(5deg); } 75% { transform: scale(1.2) rotate(-5deg); } 100% { transform: scale(1.2) rotate(0); } }

.turn-label { margin-top: 2rem; font-size: 1.1rem; font-weight: 600; color: #64748b; }
.my-turn-text { color: var(--danger); font-weight: 900; animation: pulse 1s infinite; }

.pass-btn { background: var(--danger); font-size: 1.4rem; padding: 1.5rem; box-shadow: 0 10px 25px rgba(239, 68, 68, 0.3); }
.pulse-animation { animation: pulse-shadow 2s infinite; }

@keyframes pulse-shadow { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }

/* Login/Lobby Styles (Shared with previous games) */
.action-stack { display: flex; flex-direction: column; gap: 1rem; }
.main-btn { width: 100%; padding: 1.3rem; border-radius: 18px; border: none; background: #000; color: #fff; font-weight: 800; font-size: 1.1rem; cursor: pointer; transition: all 0.3s ease; }
.main-btn:hover:not(:disabled) { background: var(--primary); transform: translateY(-2px); box-shadow: 0 10px 20px rgba(37, 99, 235, 0.2); }
.main-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.secondary-btn { background: #f1f5f9; color: #0f172a; border: 1px solid #e2e8f0; }
.secondary-btn:hover:not(:disabled) { background: #e2e8f0; color: #000; }

.field { margin-bottom: 2rem; text-align: left; }
.field label { display: block; font-size: 0.8rem; font-weight: 800; color: var(--text); margin-bottom: 0.8rem; letter-spacing: 1px; }

.view-content { padding: 1rem 0; }
.view-content p { margin-bottom: 2rem; color: #64748b; font-size: 0.95rem; }

.divider { display: flex; align-items: center; gap: 1rem; color: #cbd5e1; font-size: 0.8rem; font-weight: 800; }
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: #e2e8f0; }

.premium-input { width: 100%; padding: 1.2rem; background: #fff; border: 2px solid #e2e8f0; border-radius: 18px; font-size: 1.2rem; color: #000; outline: none; transition: all 0.3s ease; box-sizing: border-box; }
.premium-input:focus { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1); }

.code-hero { font-size: 4rem; font-weight: 900; color: var(--primary); letter-spacing: 8px; margin: 2rem 0; text-align: center; }
.back-link { background: none; border: none; color: #64748b; margin-top: 2rem; cursor: pointer; font-weight: 600; width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }

.players-grid { display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: center; margin: 3rem 0; }
.player-card { display: flex; flex-direction: column; align-items: center; gap: 0.8rem; position: relative; }
.avatar { width: 70px; height: 70px; background: #fff; border-radius: 24px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.5rem; color: var(--primary); border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
.player-card span { font-weight: 700; color: #0f172a; font-size: 1rem; }
.host-tag { position: absolute; top: -8px; right: -8px; font-size: 0.6rem; font-weight: 900; background: #000; color: #fff; padding: 0.3rem 0.6rem; border-radius: 8px; letter-spacing: 1px; }

/* Explosion View */
.explosion-view { text-align: center; }
.explosion-icon { font-size: 6rem; color: #f97316; margin-bottom: 1.5rem; animation: pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.boom-text { font-size: 3rem; font-weight: 900; color: #000; margin: 0; }
.loser-card { margin: 2rem 0; background: #f8fafc; padding: 1.5rem; border-radius: 24px; border: 1px solid #e2e8f0; }
.loser-card h3 { font-size: 2.2rem; margin: 0.5rem 0; color: var(--danger); font-weight: 900; }
.lives-left { font-weight: 800; color: #64748b; margin-bottom: 2rem; }
.text-danger { color: var(--danger); margin: 0 4px; }

@keyframes pop { 0% { transform: scale(0); } 100% { transform: scale(1); } }
.slide-up { animation: slideUp 0.6s cubic-bezier(0.23, 1, 0.32, 1); }
@keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.fade-in { animation: fadeIn 0.8s ease; }
</style>
