<script setup>
import { ref, reactive } from 'vue'

const props = defineProps({
  letter: String,
  isDisabled: Boolean,
  readyToSkip: Boolean
})

const emit = defineEmits(['stop', 'skip'])

const CATEGORIES = [
  { id: 'nombre', label: 'Nombre', icon: '👤' },
  { id: 'apellido', label: 'Apellido', icon: '👥' },
  { id: 'ciudad', label: 'Ciudad / País', icon: '📍' },
  { id: 'cosa', label: 'Cosa', icon: '📦' },
  { id: 'color', label: 'Color', icon: '🎨' },
  { id: 'fruta', label: 'Fruta / Verdura', icon: '🍎' },
  { id: 'animal', label: 'Animal', icon: '🦁' }
]

const answers = reactive({
  nombre: '',
  apellido: '',
  ciudad: '',
  cosa: '',
  color: '',
  fruta: '',
  animal: ''
})

const handleStop = () => {
  emit('stop', { ...answers })
}

const handleSkip = () => {
  emit('skip')
}

const isButtonDisabled = computed(() => {
  // Al menos un campo debe estar lleno para dar STOP (opcional, pero ayuda)
  return Object.values(answers).every(v => v.trim() === '')
})

import { computed } from 'vue'

defineExpose({
  answers
})
</script>

<template>
  <div class="game-view">
    <div class="bento-container">
      <div 
        v-for="cat in CATEGORIES" 
        :key="cat.id" 
        class="bento-card"
        :class="{ 'card-filled': answers[cat.id].trim() !== '' }"
      >
        <div class="category-label">
          <span>{{ cat.icon }}</span> {{ cat.label }}
        </div>
        <input 
          v-model="answers[cat.id]"
          type="text"
          class="category-input"
          placeholder="..."
          :disabled="isDisabled"
        />
      </div>

      <!-- Celda del Botón STOP -->
      <div class="bento-card stop-card">
        <button 
          class="stop-btn" 
          @click="handleStop"
          :disabled="isDisabled || isButtonDisabled"
        >
          ¡STOP!
        </button>
      </div>

      <!-- Celda de Saltar Letra -->
      <div class="bento-card skip-card" :class="{ 'waiting-skip': readyToSkip }">
        <button 
          class="skip-btn" 
          @click="handleSkip"
          :disabled="isDisabled"
        >
          {{ readyToSkip ? 'ESPERANDO PAREJA...' : 'SALTAR LETRA' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-view {
  margin-top: 1rem;
}

.card-filled {
  border-color: rgba(124, 58, 237, 0.5);
  background: rgba(124, 58, 237, 0.05);
}

.stop-card {
  grid-column: span 2;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(239, 68, 68, 0.05);
}

.skip-card {
  grid-column: span 2;
  display: flex;
  justify-content: center;
  align-items: center;
}

.waiting-skip {
  background: rgba(124, 58, 237, 0.1);
  border-color: var(--accent-color);
}

.skip-btn {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
  padding: 1rem 2rem;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;
}

.skip-btn:hover:not(:disabled) {
  border-color: var(--text-primary);
  color: var(--text-primary);
}

.stop-btn {
  width: 90%;
  height: 80px;
}

@media (max-width: 900px) {
  .stop-card, .skip-card {
    grid-column: span 2;
  }
}

@media (max-width: 600px) {
  .stop-card, .skip-card {
    grid-column: 1;
  }
}
</style>
