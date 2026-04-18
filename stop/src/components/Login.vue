<script setup>
import { ref } from 'vue'

const name = ref('')
const emit = defineEmits(['join'])

const join = () => {
  if (name.value.trim()) {
    emit('join', name.value)
  }
}
</script>

<template>
  <div class="login-view">
    <div class="bento-card login-card active-glow">
      <h2>¡Bienvenido a STOP!</h2>
      <p>Introduce tu nombre para entrar al lobby local.</p>
      
      <div class="input-group">
        <label>TU NOMBRE</label>
        <input 
          v-model="name" 
          type="text" 
          placeholder="Ej: Camilo" 
          @keyup.enter="join"
        />
      </div>

      <button class="join-btn" @click="join" :disabled="!name.trim()">
        ENTRAR AL JUEGO
      </button>
    </div>
  </div>
</template>

<style scoped>
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
}

p {
  color: var(--text-secondary);
  margin-bottom: 2.5rem;
}

.input-group {
  text-align: left;
  margin-bottom: 2.5rem;
}

.input-group label {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--accent-color);
  letter-spacing: 2px;
  display: block;
  margin-bottom: 0.5rem;
}

.input-group input {
  width: 100%;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 1rem;
  color: white;
  font-size: 1.2rem;
  outline: none;
  transition: all 0.3s ease;
}

.input-group input:focus {
  border-color: var(--accent-color);
  background: rgba(255,255,255,0.08);
  box-shadow: 0 0 15px var(--accent-glow);
}

.join-btn {
  width: 100%;
  background: var(--accent-color);
  color: white;
  border: none;
  padding: 1.2rem;
  border-radius: 12px;
  font-weight: 800;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.join-btn:hover:not(:disabled) {
  box-shadow: 0 10px 20px var(--accent-glow);
  filter: brightness(1.1);
}

.join-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
