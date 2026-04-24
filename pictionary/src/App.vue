<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'
import { io } from 'socket.io-client'

const socket = ref(null)
const joined = ref(false)
const loginView = ref('selection')
const myName = ref('')
const roomId = ref('')
const gameState = ref(null)
const myWord = ref('')
const message = ref('')
const chatContainer = ref(null)

// Canvas Drawing State
const canvasRef = ref(null)
const isDrawing = ref(false)
const selectedTool = ref('brush')
const color = ref('#000000')
const lineWidth = ref(5)
const lastPos = ref({ x: 0, y: 0 })

const isHost = computed(() => socket.value?.id === gameState.value?.hostId)
const isDrawer = computed(() => socket.value?.id === gameState.value?.drawerId)

onMounted(() => {
  socket.value = io('/pictionary')

  socket.value.on('stateUpdate', (state) => {
    const prevStatus = gameState.value?.status;
    gameState.value = state
    
    if (prevStatus !== 'jugando' && state.status === 'jugando') {
      nextTick(() => {
        clearCanvasLocal()
        // Redraw history if any (for late joiners)
        state.drawHistory.forEach(data => drawOnCanvas(data))
      })
    }
    nextTick(() => {
      scrollToBottom()
    })
  })

  socket.value.on('draw', (data) => {
    drawOnCanvas(data)
  })

  socket.value.on('clearCanvas', () => {
    clearCanvasLocal()
  })

  socket.value.on('yourWord', (word) => {
    myWord.value = word
  })

  socket.value.on('timerUpdate', (time) => {
    if (gameState.value) {
      gameState.value.timer = time
    }
  })

  socket.value.on('message', (msg) => {
    if (gameState.value) {
      if (!gameState.value.chat) gameState.value.chat = []
      gameState.value.chat.push(msg)
      if (gameState.value.chat.length > 50) gameState.value.chat.shift()
    }
    nextTick(() => {
      scrollToBottom()
    })
  })

  const scrollToBottom = () => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  }
})

const startCreate = () => {
  roomId.value = Math.random().toString(36).substring(2, 7).toUpperCase()
  loginView.value = 'create'
}

const startJoin = () => {
  loginView.value = 'join'
}

const backToSelection = () => {
  loginView.value = 'selection'
  roomId.value = ''
}

const connect = (isCreator) => {
  if (myName.value.trim() && roomId.value.trim()) {
    socket.value.emit('join', {
      name: myName.value,
      roomId: roomId.value.toUpperCase(),
      isCreator
    })
    joined.value = true
  }
}

const startGame = () => {
  socket.value.emit('startGame')
}

// Drawing Functions
const startDrawing = (e) => {
  if (!isDrawer.value || gameState.value.status !== 'jugando') return
  isDrawing.value = true
  const { x, y } = getPos(e)
  lastPos.value = { x, y }
}

const stopDrawing = () => {
  isDrawing.value = false
}

const draw = (e) => {
  if (!isDrawing.value || !isDrawer.value || gameState.value.status !== 'jugando') return
  
  const { x, y } = getPos(e)
  const drawData = {
    x1: lastPos.value.x,
    y1: lastPos.value.y,
    x2: x,
    y2: y,
    color: selectedTool.value === 'eraser' ? '#ffffff' : color.value,
    width: lineWidth.value
  }
  
  socket.value.emit('draw', drawData)
  drawOnCanvas(drawData)
  lastPos.value = { x, y }
}

const getPos = (e) => {
  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height)
  }
}

const drawOnCanvas = (data) => {
  const ctx = canvasRef.value.getContext('2d')
  ctx.beginPath()
  ctx.strokeStyle = data.color
  ctx.lineWidth = data.width
  ctx.lineCap = 'round'
  ctx.moveTo(data.x1, data.y1)
  ctx.lineTo(data.x2, data.y2)
  ctx.stroke()
}

const clearCanvasLocal = () => {
  if (!canvasRef.value) return
  const ctx = canvasRef.value.getContext('2d')
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
}

const clearCanvas = () => {
  socket.value.emit('clearCanvas')
  clearCanvasLocal()
}

const sendMessage = () => {
  if (message.value.trim()) {
    socket.value.emit('sendMessage', message.value)
    message.value = ''
  }
}

const nextRound = () => {
  socket.value.emit('nextRound')
}

const getInitials = (name) => {
  return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : '??'
}
</script>

<template>
  <div class="app-shell" :class="{ 'my-turn-bg': isDrawer && gameState?.status === 'jugando' }">
    <a href="/" style="position: fixed; top: 1rem; right: 2rem; color: #666; text-decoration: none; font-size: 0.9rem; z-index: 100;">🏠 Volver al Lobby</a>
    <div class="glass-bg"></div>
    
    <div class="game-container">
      <header>
        <div class="brand">
          <div class="logo-icon"><i class="fas fa-palette"></i></div>
          <h1>PICTIONARY</h1>
        </div>
        <div v-if="joined" class="room-badge">SALA {{ roomId }}</div>
      </header>

      <main>
        <!-- LOGIN FLOW -->
        <div v-if="!joined" class="login-card bento-card slide-up active-glow">
          <h2>¡Bienvenido a PICTIONARY!</h2>
          <div v-if="loginView === 'selection'" class="view-content">
            <p>Elige cómo quieres empezar a jugar.</p>
            <div class="field">
              <label>TU NOMBRE</label>
              <input v-model="myName" placeholder="Ej: Dalí" class="premium-input">
            </div>
            <div class="action-stack">
              <button class="main-btn" @click="startCreate" :disabled="!myName.trim()">CREAR NUEVA SALA</button>
              <div class="divider"><span>O</span></div>
              <button class="main-btn secondary-btn" @click="startJoin" :disabled="!myName.trim()">UNIRSE A UNA SALA</button>
            </div>
          </div>

          <div v-else-if="loginView === 'create'" class="view-content">
            <p>Comparte este código con tus amigos.</p>
            <div class="code-hero">{{ roomId }}</div>
            <button class="main-btn" @click="connect(true)">ENTRAR A LA SALA</button>
            <button class="back-link" @click="backToSelection"><i class="fas fa-arrow-left"></i> Volver</button>
          </div>

          <div v-else-if="loginView === 'join'" class="view-content">
            <p>Introduce el código de la sala.</p>
            <div class="field">
              <label>CÓDIGO DE SALA</label>
              <input v-model="roomId" placeholder="Ej: XJ92K" class="premium-input" @keyup.enter="connect(false)">
            </div>
            <button class="main-btn" @click="connect(false)" :disabled="!roomId.trim()">UNIRSE AHORA</button>
            <button class="back-link" @click="backToSelection"><i class="fas fa-arrow-left"></i> Volver</button>
          </div>
        </div>

        <!-- LOBBY -->
        <div v-else-if="gameState?.status === 'esperando'" class="lobby-view bento-card fade-in">
          <h2>Esperando artistas...</h2>
          <p>La partida comenzará cuando el host lo decida.</p>
          
          <div class="players-grid">
            <div v-for="player in gameState.players" :key="player.id" class="player-card">
              <div class="avatar">
                {{ getInitials(player.name) }}
                <div v-if="player.id === gameState.hostId" class="host-tag">HOST</div>
              </div>
              <span>{{ player.name }}</span>
            </div>
          </div>

          <div v-if="isHost" class="action-stack">
            <button @click="startGame" class="main-btn" :disabled="Object.keys(gameState.players).length < 2">
              EMPEZAR JUEGO ({{ Object.keys(gameState.players).length }}/2+)
            </button>
          </div>
          <div v-else class="waiting-footer">Esperando que el host inicie...</div>
        </div>

        <!-- GAMEPLAY -->
        <div v-else-if="gameState?.status === 'jugando' || gameState?.status === 'resultado'" class="gameplay-view">
          <div class="game-layout">
            <!-- Sidebar: Players -->
            <div class="players-sidebar bento-card">
              <h3>Artistas</h3>
              <div class="sidebar-list">
                <div v-for="player in gameState.players" :key="player.id" class="player-row" :class="{ 'is-drawer': player.id === gameState.drawerId, 'guessed': player.hasGuessed }">
                  <div class="mini-avatar">{{ getInitials(player.name) }}</div>
                  <div class="player-info">
                    <span class="p-name">{{ player.name }}</span>
                    <span class="p-points">{{ player.points }} pts</span>
                  </div>
                  <div v-if="player.hasGuessed" class="check-icon"><i class="fas fa-check-circle"></i></div>
                  <div v-if="player.id === gameState.drawerId" class="brush-icon"><i class="fas fa-paint-brush"></i></div>
                </div>
              </div>
            </div>

            <!-- Main: Canvas Area -->
            <div class="canvas-area">
              <div class="canvas-header bento-card">
                <div class="timer-badge" :class="{ 'timer-low': gameState.timer < 10 }">
                  <i class="fas fa-clock"></i> {{ gameState.timer }}s
                </div>
                <div class="word-hint" v-if="!isDrawer">
                   PALABRA: {{ gameState.status === 'resultado' ? gameState.currentWord : '_ '.repeat(gameState.currentWord.length) }}
                </div>
                <div class="word-hint" v-else>
                  DIBUJA: <span class="reveal">{{ gameState.currentWord }}</span>
                </div>
              </div>

              <div class="canvas-container bento-card">
                <canvas 
                  ref="canvasRef" 
                  width="800" 
                  height="500"
                  @mousedown="startDrawing"
                  @mousemove="draw"
                  @mouseup="stopDrawing"
                  @mouseleave="stopDrawing"
                  @touchstart.prevent="startDrawing"
                  @touchmove.prevent="draw"
                  @touchend.prevent="stopDrawing"
                ></canvas>
                
                <div v-if="gameState.status === 'resultado'" class="round-overlay">
                  <h3>¡Tiempo agotado!</h3>
                  <p>La palabra era: <strong>{{ gameState.currentWord }}</strong></p>
                  <div v-if="isHost" class="overlay-actions">
                    <button @click="nextRound" class="main-btn next-btn">SIGUIENTE PALABRA <i class="fas fa-arrow-right"></i></button>
                  </div>
                  <div v-else class="waiting-footer">Esperando que el host continúe...</div>
                </div>
              </div>

              <div v-if="isDrawer && gameState.status === 'jugando'" class="toolbar bento-card">
                <div class="tool-group">
                  <div class="tool-selector">
                    <button @click="selectedTool = 'brush'" :class="{ active: selectedTool === 'brush' }" title="Pincel">
                      <i class="fas fa-paint-brush"></i>
                    </button>
                    <button @click="selectedTool = 'eraser'" :class="{ active: selectedTool === 'eraser' }" title="Borrador">
                      <i class="fas fa-eraser"></i>
                    </button>
                  </div>
                  <input type="color" v-model="color" class="color-picker" :disabled="selectedTool === 'eraser'">
                  <div class="brush-sizes">
                    <button v-for="size in [2, 5, 10, 20]" :key="size" @click="lineWidth = size" :class="{ active: lineWidth === size }">
                      <div class="dot" :style="{ width: size + 'px', height: size + 'px' }"></div>
                    </button>
                  </div>
                </div>
                <button @click="clearCanvas" class="clear-btn"><i class="fas fa-trash"></i> Limpiar Lienzo</button>
              </div>
            </div>

            <!-- Chat: Guesses -->
            <div class="chat-sidebar bento-card">
              <h3>Chat / Adivinanzas</h3>
              <div class="chat-messages" ref="chatContainer">
                <div v-for="(msg, idx) in gameState.chat" :key="idx" class="chat-bubble" :class="{ 'system-msg': msg.system }">
                  <strong v-if="!msg.system">{{ msg.name }}: </strong>
                  <span>{{ msg.message }}</span>
                </div>
              </div>
              <div class="chat-input" v-if="!isDrawer && !gameState.players[socket.id]?.hasGuessed && gameState.status === 'jugando'">
                <input v-model="message" placeholder="Escribe tu respuesta..." @keyup.enter="sendMessage">
                <button @click="sendMessage"><i class="fas fa-paper-plane"></i></button>
              </div>
              <div class="chat-footer" v-else-if="isDrawer">
                ¡Tú estás dibujando!
              </div>
              <div class="chat-footer guessed" v-else-if="gameState.players[socket.id]?.hasGuessed">
                ¡Ya adivinaste! Espera a los demás.
              </div>
            </div>
          </div>
        </div>

        <!-- FINAL RESULTS -->
        <div v-else-if="gameState?.status === 'final'" class="results-view bento-card fade-in">
          <h2>Podio Final</h2>
          <div class="podium">
             <div v-for="(player, idx) in Object.values(gameState.players).sort((a,b) => b.points - a.points)" :key="player.id" class="podium-item" :class="'rank-' + (idx + 1)">
                <div class="avatar">{{ idx + 1 }}</div>
                <span class="p-name">{{ player.name }}</span>
                <span class="p-points">{{ player.points }} pts</span>
             </div>
          </div>
          <button v-if="isHost" @click="startGame" class="main-btn">JUGAR OTRA VEZ</button>
          <div v-else class="waiting-footer">Esperando que el host inicie otra...</div>
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
  --radius: 32px;
}

body { margin: 0; font-family: 'Outfit', sans-serif; background: var(--bg); color: var(--text); overflow-x: hidden; }

.app-shell { min-height: 100vh; position: relative; transition: background 0.3s ease; }
.my-turn-bg { background: rgba(37, 99, 235, 0.05); }

.glass-bg {
  position: fixed; inset: 0; z-index: -1;
  background: 
    radial-gradient(circle at 0% 0%, rgba(37, 99, 235, 0.03) 0%, transparent 40%),
    radial-gradient(circle at 100% 100%, rgba(124, 58, 237, 0.03) 0%, transparent 40%);
}

.game-container { max-width: 1400px; margin: 0 auto; padding: 2rem; }

header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
.brand { display: flex; align-items: center; gap: 0.8rem; }
.logo-icon { font-size: 1.5rem; color: var(--primary); }
header h1 { font-size: 1.2rem; font-weight: 900; letter-spacing: 3px; margin: 0; }
.room-badge { background: #fff; padding: 0.5rem 1.2rem; border-radius: 100px; font-size: 0.75rem; font-weight: 800; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }

.bento-card { background: #fff; border-radius: var(--radius); padding: 2rem; border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 10px 40px rgba(0,0,0,0.03); }

/* Layout Gameplay */
.game-layout { display: grid; grid-template-columns: 250px 1fr 300px; gap: 1.5rem; height: calc(100vh - 180px); }

/* Sidebar Players */
.players-sidebar { display: flex; flex-direction: column; overflow: hidden; }
.players-sidebar h3 { font-size: 1rem; margin-bottom: 1.5rem; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
.sidebar-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.8rem; }
.player-row { display: flex; align-items: center; gap: 0.8rem; padding: 0.8rem; border-radius: 16px; background: #f8fafc; transition: all 0.3s ease; }
.player-row.is-drawer { border: 2px solid var(--primary); background: #eff6ff; }
.player-row.guessed { background: #ecfdf5; border-color: var(--success); }
.mini-avatar { width: 40px; height: 40px; background: #fff; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; color: var(--primary); }
.player-info { display: flex; flex-direction: column; flex: 1; }
.p-name { font-weight: 700; font-size: 0.9rem; }
.p-points { font-size: 0.75rem; color: #64748b; font-weight: 800; }
.check-icon { color: var(--success); }
.brush-icon { color: var(--primary); animation: bounce 1s infinite; }

@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }

/* Canvas Area */
.canvas-area { display: flex; flex-direction: column; gap: 1rem; }
.canvas-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 2rem; }
.timer-badge { background: #f1f5f9; padding: 0.5rem 1rem; border-radius: 100px; font-weight: 800; font-size: 0.9rem; }
.timer-low { color: var(--danger); animation: pulse 1s infinite; }
.word-hint { font-size: 1.2rem; font-weight: 900; letter-spacing: 4px; }
.reveal { color: var(--primary); text-transform: uppercase; letter-spacing: 2px; }

.canvas-container { position: relative; padding: 0; overflow: hidden; background: #fff; flex: 1; border: 2px solid #f1f5f9; }
canvas { width: 100%; height: 100%; cursor: crosshair; touch-action: none; }
.round-overlay { position: absolute; inset: 0; background: rgba(255,255,255,0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10; text-align: center; }
.round-overlay h3 { font-size: 2.5rem; margin-bottom: 1rem; }

.toolbar { display: flex; justify-content: space-between; align-items: center; padding: 1rem; flex-wrap: wrap; gap: 1rem; }
.tool-group { display: flex; align-items: center; gap: 1.2rem; }
.tool-selector { display: flex; gap: 0.5rem; background: #f1f5f9; padding: 0.4rem; border-radius: 12px; }
.tool-selector button { width: 40px; height: 40px; border-radius: 8px; border: none; background: transparent; cursor: pointer; color: #64748b; transition: all 0.2s; }
.tool-selector button.active { background: #fff; color: var(--primary); box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
.color-picker { width: 45px; height: 45px; border: none; padding: 0; background: none; cursor: pointer; border-radius: 10px; }
.color-picker:disabled { opacity: 0.3; cursor: not-allowed; }
.brush-sizes { display: flex; gap: 0.4rem; }
.brush-sizes button { width: 38px; height: 38px; border-radius: 10px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer; }
.brush-sizes button.active { background: var(--primary); color: #fff; }
.dot { background: currentColor; border-radius: 50%; }
.clear-btn { width: auto; padding: 0.8rem 1.2rem; background: #fee2e2; color: var(--danger); border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 0.5rem; }
.clear-btn:hover { background: #fecaca; }

/* Chat Sidebar */
.chat-sidebar { display: flex; flex-direction: column; overflow: hidden; }
.chat-sidebar h3 { font-size: 1rem; margin-bottom: 1.5rem; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
.chat-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.chat-bubble { padding: 0.6rem 1rem; background: #f1f5f9; border-radius: 12px 12px 12px 0; font-size: 0.85rem; max-width: 90%; }
.system-msg { background: #eff6ff; color: var(--primary); border-radius: 12px; font-weight: 700; text-align: center; max-width: 100%; }
.chat-input { display: flex; gap: 0.5rem; }
.chat-input input { flex: 1; padding: 0.8rem; border-radius: 12px; border: 1px solid #e2e8f0; outline: none; }
.chat-input button { width: 45px; padding: 0; background: var(--primary); border-radius: 12px; }
.chat-footer { text-align: center; font-size: 0.8rem; color: #94a3b8; font-weight: 800; padding: 1rem; border-top: 1px solid #f1f5f9; }
.chat-footer.guessed { color: var(--success); }

/* Login/Buttons */
.action-stack { display: flex; flex-direction: column; gap: 1rem; }
.main-btn { width: 100%; padding: 1.3rem; border-radius: 18px; border: none; background: #000; color: #fff; font-weight: 800; font-size: 1.1rem; cursor: pointer; transition: all 0.3s ease; }
.main-btn:hover:not(:disabled) { background: var(--primary); transform: translateY(-2px); box-shadow: 0 10px 20px rgba(37, 99, 235, 0.2); }
.main-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.secondary-btn { background: #f1f5f9; color: #000; border: 1px solid #e2e8f0; }

.field { margin-bottom: 2rem; text-align: left; }
.field label { display: block; font-size: 0.8rem; font-weight: 800; margin-bottom: 0.8rem; letter-spacing: 1px; }
.premium-input { width: 100%; padding: 1.2rem; border: 2px solid #e2e8f0; border-radius: 18px; font-size: 1.1rem; outline: none; box-sizing: border-box; }
.premium-input:focus { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1); }

.code-hero { font-size: 4rem; font-weight: 900; color: var(--primary); letter-spacing: 8px; margin: 2rem 0; text-align: center; }
.back-link { background: none; border: none; color: #64748b; margin-top: 2rem; cursor: pointer; font-weight: 600; width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }

.players-grid { display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: center; margin: 3rem 0; }
.player-card { display: flex; flex-direction: column; align-items: center; gap: 0.8rem; position: relative; }
.avatar { width: 70px; height: 70px; background: #fff; border-radius: 24px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.5rem; color: var(--primary); border: 1px solid #e2e8f0; }
.host-tag { position: absolute; top: -8px; right: -8px; font-size: 0.6rem; font-weight: 900; background: #000; color: #fff; padding: 0.3rem 0.6rem; border-radius: 8px; }

.podium { display: flex; flex-direction: column; gap: 1rem; margin: 2rem 0; }
.podium-item { display: flex; align-items: center; gap: 1rem; padding: 1.5rem; border-radius: 20px; background: #f8fafc; }
.rank-1 { background: #fffbeb; border: 2px solid #fcd34d; }

.login-card { 
  max-width: 450px !important; 
  margin: 0 auto; 
  padding: 3rem !important;
  border: 2px solid var(--primary) !important;
  box-shadow: 0 15px 45px rgba(37, 99, 235, 0.1) !important;
}

@keyframes glow {
  0% { box-shadow: 0 0 5px rgba(37, 99, 235, 0.2); }
  50% { box-shadow: 0 0 20px rgba(37, 99, 235, 0.4); }
  100% { box-shadow: 0 0 5px rgba(37, 99, 235, 0.2); }
}

.active-glow {
  animation: glow 2s infinite;
}

.action-stack { display: flex; flex-direction: column; gap: 1rem; }
.main-btn { width: 100%; padding: 1.2rem; border-radius: 14px; border: none; background: #000; color: #fff; font-weight: 800; font-size: 1.1rem; cursor: pointer; transition: all 0.3s ease; }
.main-btn:hover:not(:disabled) { background: var(--primary); transform: translateY(-2px); }
.main-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.secondary-btn { background: #f1f5f9 !important; color: #000 !important; border: 1px solid #e2e8f0 !important; }

.divider { display: flex; align-items: center; text-align: center; color: #64748b; font-size: 0.8rem; margin: 0.5rem 0; }
.divider::before, .divider::after { content: ''; flex: 1; border-bottom: 1px solid #e2e8f0; }
.divider span { padding: 0 1rem; }

.code-hero { font-size: 3.5rem; font-weight: 900; color: var(--primary); letter-spacing: 5px; margin-bottom: 2rem; text-align: center; }
.back-link { background: none; border: none; color: #64748b; margin-top: 1.5rem; cursor: pointer; font-size: 0.9rem; width: 100%; text-align: center; }

.field { margin-bottom: 2.5rem; text-align: left; }
.field label { display: block; font-size: 0.8rem; font-weight: 800; color: #0f172a; margin-bottom: 0.6rem; letter-spacing: 1px; }
.premium-input { width: 100%; padding: 1.2rem; border: 2px solid #e2e8f0; border-radius: 14px; font-size: 1.1rem; outline: none; box-sizing: border-box; color: #000; }
.premium-input::placeholder { color: #94a3b8; }
.premium-input:focus { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1); }

@keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.slide-up { animation: slideUp 0.6s cubic-bezier(0.23, 1, 0.32, 1); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.fade-in { animation: fadeIn 0.8s ease; }
@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }

.next-btn {
  margin-top: 1.5rem;
  max-width: 300px;
  background: var(--primary) !important;
}

.overlay-actions {
  width: 100%;
  display: flex;
  justify-content: center;
}

.round-overlay {
  box-shadow: 0 0 50px rgba(0,0,0,0.1);
  border-radius: var(--radius);
  margin: 1rem;
}
</style>
