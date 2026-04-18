<script setup>
import { ref, reactive, onMounted, watch, computed } from 'vue'

const props = defineProps({
  me: Object,
  myId: String,
  other: Object,
  otherId: String
})

const emit = defineEmits(['finish'])

const CATEGORIES = [
  { id: 'nombre', label: 'Nombre' },
  { id: 'apellido', label: 'Apellido' },
  { id: 'ciudad', label: 'Ciudad' },
  { id: 'cosa', label: 'Cosa' },
  { id: 'color', label: 'Color' },
  { id: 'fruta', label: 'Fruta' },
  { id: 'animal', label: 'Animal' }
]

// Estado de los checkboxes: { category: { me: true, other: true } }
const checks = reactive({})

const initChecks = () => {
  CATEGORIES.forEach(cat => {
    // Solo inicializamos si no existe o si las respuestas cambiaron de vacío a algo
    if (!checks[cat.id]) {
      checks[cat.id] = { me: false, other: false }
    }
    
    const myWord = (props.me.answers[cat.id] || '').trim()
    const otherWord = (props.other.answers[cat.id] || '').trim()

    if (myWord.length > 1) checks[cat.id].me = true
    if (otherWord.length > 1) checks[cat.id].other = true
  })
}

// Inicializar al montar y vigilar cambios por si llegan tarde
onMounted(initChecks)
watch(() => [props.me.answers, props.other.answers], initChecks, { deep: true })

const normalize = (str) => {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

const calculatePoints = () => {
  let myPoints = 0
  const details = {}

  CATEGORIES.forEach(cat => {
    const rawMy = (props.me.answers[cat.id] || '').trim()
    const rawOther = (props.other.answers[cat.id] || '').trim()
    
    const myWord = normalize(rawMy)
    const otherWord = normalize(rawOther)

    let pts = 0
    if (checks[cat.id].me && rawMy.length > 1) {
      if (myWord === otherWord && checks[cat.id].other && rawOther.length > 1) {
        pts = 50
      } else {
        pts = 100
      }
      myPoints += pts
    }
    
    details[cat.id] = pts
  })

  return { points: myPoints, details }
}

const isWaiting = computed(() => props.me.readyToResults)

const finish = () => {
  if (isWaiting.value) return
  const data = calculatePoints()
  emit('finish', data)
}

const formatWord = (word) => word || '---'
</script>

<template>
  <div class="validator-view">
    <div class="bento-card table-card">
      <h2>Calificación</h2>
      <p class="subtitle">Marquen si la palabra es válida para sumar puntos.</p>

      <div class="validator-grid">
        <!-- Encabezados -->
        <div class="grid-header">Categoría</div>
        <div class="grid-header">{{ me.name }} (Tú)</div>
        <div class="grid-header">{{ other.name }}</div>

        <!-- Filas de Categorías -->
        <template v-for="cat in CATEGORIES" :key="cat.id">
          <div class="grid-cat">{{ cat.label }}</div>
          
          <div class="grid-cell" :class="{ 'valid-word': checks[cat.id]?.me, 'invalid-word': !checks[cat.id]?.me }">
            <span class="word-display">{{ formatWord(me.answers[cat.id]) }}</span>
            <input type="checkbox" v-if="checks[cat.id] && (me.answers[cat.id] || '').trim().length > 1" v-model="checks[cat.id].me" class="custom-check" />
          </div>

          <div class="grid-cell" :class="{ 'valid-word': checks[cat.id]?.other, 'invalid-word': !checks[cat.id]?.other }">
            <span class="word-display">{{ formatWord(other.answers[cat.id]) }}</span>
            <input type="checkbox" v-if="checks[cat.id] && (other.answers[cat.id] || '').trim().length > 1" v-model="checks[cat.id].other" class="custom-check" />
          </div>
        </template>
      </div>

      <button class="finish-btn" @click="finish" :disabled="isWaiting">
        {{ isWaiting ? 'ESPERANDO AL OTRO JUGADOR...' : 'CONFIRMAR PUNTOS' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.validator-view {
  display: flex;
  justify-content: center;
}

.table-card {
  width: 100%;
  max-width: 900px;
  padding: 2.5rem;
}

h2 { margin-bottom: 0.5rem; text-align: center; }
.subtitle { color: var(--text-secondary); text-align: center; margin-bottom: 2rem; font-size: 0.9rem; }

.validator-grid {
  display: grid;
  grid-template-columns: 1fr 2fr 2fr;
  gap: 1px;
  background: var(--glass-border);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 2rem;
}

.grid-header {
  background: rgba(255,255,255,0.05);
  padding: 1rem;
  font-weight: 800;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--accent-color);
}

.grid-cat {
  background: rgba(255,255,255,0.02);
  padding: 1.2rem;
  font-weight: 600;
  display: flex;
  align-items: center;
}

.grid-cell {
  background: transparent;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-left: 1px solid var(--glass-border);
  transition: all 0.3s ease;
}

.valid-word {
  background: rgba(16, 185, 129, 0.05);
  border-left: 2px solid #10b981 !important;
}

.invalid-word {
  opacity: 0.5;
  background: rgba(239, 68, 68, 0.05);
  border-left: 2px solid #ef4444 !important;
}

.invalid-word .word-display {
  text-decoration: line-through;
}

.word-display {
  font-size: 1.2rem;
  font-weight: 500;
  text-transform: capitalize;
}

.custom-check {
  width: 24px;
  height: 24px;
  accent-color: var(--accent-color);
  cursor: pointer;
}

.finish-btn {
  width: 100%;
  background: white;
  color: black;
  border: none;
  padding: 1.2rem;
  border-radius: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.3s ease;
}

.finish-btn:hover {
  background: var(--accent-color);
  color: white;
  box-shadow: 0 0 20px var(--accent-glow);
}

@media (max-width: 600px) {
  .validator-grid {
    grid-template-columns: 1fr 1.5fr 1.5fr;
  }
  .word-display { font-size: 0.9rem; }
}
</style>
