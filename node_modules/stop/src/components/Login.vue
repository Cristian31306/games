<script setup>
import { ref } from 'vue'

const name = ref('')
const roomId = ref('')
const view = ref('selection') // 'selection', 'join', 'create'
const emit = defineEmits(['join'])

const generateCode = () => {
  return Math.random().toString(36).substring(2, 7).toUpperCase()
}

const startCreate = () => {
  const code = generateCode()
  roomId.value = code
  view.value = 'create'
}

const startJoin = () => {
  view.value = 'join'
}

const back = () => {
  view.value = 'selection'
  roomId.value = ''
}

const join = (isCreator = false) => {
  if (name.value.trim() && roomId.value.trim()) {
    emit('join', { 
      name: name.value.trim(), 
      roomId: roomId.value.trim().toUpperCase(),
      isCreator
    })
  }
}
</script>

<template>
  <div class="login-view">
    <div class="bento-card login-card active-glow">
      <h2>¡Bienvenido a STOP!</h2>
      
      <div v-if="view === 'selection'" class="view-content fade-in">
        <p>Elige cómo quieres empezar a jugar.</p>
        <div class="input-group">
          <label>TU NOMBRE</label>
          <input v-model="name" type="text" placeholder="Ej: Camilo" />
        </div>
        <div class="selection-actions">
          <button class="join-btn" @click="startCreate" :disabled="!name.trim()">
            CREAR NUEVA SALA
          </button>
          <div class="divider"><span>O</span></div>
          <button class="join-btn secondary-btn" @click="startJoin" :disabled="!name.trim()">
            UNIRSE A UNA SALA
          </button>
        </div>
      </div>

      <div v-else-if="view === 'create'" class="view-content fade-in">
        <p>Comparte este código con tus amigos para que se unan a tu partida.</p>
        <div class="code-display">
          {{ roomId }}
        </div>
        <button class="join-btn" @click="join(true)">
          ENTRAR A LA SALA
        </button>
        <button class="back-link" @click="back">← Volver</button>
      </div>

      <div v-else-if="view === 'join'" class="view-content fade-in">
        <p>Introduce el código de la sala de tu amigo.</p>
        <div class="input-group">
          <label>CÓDIGO DE SALA</label>
          <input v-model="roomId" type="text" placeholder="Ej: XJ92K" @keyup.enter="join(false)" />
        </div>
        <button class="join-btn" @click="join(false)" :disabled="!roomId.trim()">
          UNIRSE AHORA
        </button>
        <button class="back-link" @click="back">← Volver</button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.selection-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.secondary-btn {
  background: #f1f5f9 !important;
  color: #0f172a !important;
  border: 1px solid #e2e8f0 !important;
}

.divider {
  display: flex;
  align-items: center;
  text-align: center;
  color: #64748b;
  font-size: 0.8rem;
  margin: 0.5rem 0;
}

.divider::before, .divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #e2e8f0;
}

.divider span {
  padding: 0 1rem;
}

.code-display {
  font-size: 3.5rem;
  font-weight: 900;
  color: var(--accent-color);
  letter-spacing: 5px;
  margin-bottom: 2rem;
}

.back-link {
  background: none;
  border: none;
  color: #64748b;
  margin-top: 1.5rem;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9rem;
}

.fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.login-view {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 50vh;
}

.login-card {
  max-width: 450px;
  width: 100%;
  text-align: center;
  padding: 3rem;
}

h2 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  font-weight: 800;
  color: #000;
}

p {
  color: #64748b;
  margin-bottom: 2.5rem;
}

.input-group {
  text-align: left;
  margin-bottom: 2.5rem;
}

.input-group label {
  font-size: 0.8rem;
  font-weight: 800;
  color: #0f172a; /* Negro para contraste */
  letter-spacing: 1px;
  display: block;
  margin-bottom: 0.6rem;
}

.input-group input {
  width: 100%;
  background: #ffffff;
  border: 2px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.2rem;
  color: #000000; /* Texto negro obligatorio */
  font-size: 1.1rem;
  outline: none;
  transition: all 0.3s ease;
}

.input-group input::placeholder {
  color: #94a3b8;
}

.input-group input:focus {
  border-color: var(--accent-color);
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.join-btn {
  width: 100%;
  background: #000; /* Negro para máximo impacto */
  color: white;
  border: none;
  padding: 1.2rem;
  border-radius: 14px;
  font-weight: 800;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.join-btn:hover:not(:disabled) {
  background: var(--accent-color);
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(59, 130, 246, 0.2);
}

.join-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
