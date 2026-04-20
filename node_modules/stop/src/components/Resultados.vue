<script setup>
import { computed } from 'vue'

const props = defineProps({
  rounds: Array,
  players: Object,
  categories: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['next', 'reset'])

const sortedPlayers = computed(() => {
  return Object.entries(props.players)
    .map(([id, p]) => ({ ...p, id: id }))
    .sort((a, b) => b.points - a.points)
})

const lastRound = computed(() => {
  if (props.rounds.length === 0) return null
  return props.rounds[props.rounds.length - 1]
})

const winner = computed(() => sortedPlayers.value[0])
const isTie = computed(() => {
  if (sortedPlayers.value.length < 2) return false
  return sortedPlayers.value[0].points === sortedPlayers.value[1].points
})

// Desglose de rondas para la "Tabla de Victoria"
const historyTable = computed(() => {
  return props.rounds.map(round => {
    return {
      letter: round.letter,
      scores: { ...(round.roundPoints || {}) }
    }
  })
})
</script>

<template>
  <div class="results-view">
    <div class="bento-card winner-card active-glow">
      <div v-if="isTie" class="celebration">
        <h2>🤝 ¡EMPATE! 🤝</h2>
        <p>Ambos son unos maestros del STOP.</p>
      </div>
      <div v-else class="celebration">
        <span class="crown">👑</span>
        <h2>¡VICTORIA PARA {{ winner.name.toUpperCase() }}!</h2>
        <p>Con un total de {{ winner.points }} puntos acumulados.</p>
      </div>

      <div class="summary-grid">
        <div v-for="player in sortedPlayers" :key="player.id" class="player-rank">
          <span class="rank-name">{{ player.name }}</span>
          <span class="rank-points">{{ player.points }} pts</span>
        </div>
      </div>

      <div class="action-buttons">
        <button class="next-btn" @click="emit('next')">SIGUIENTE LETRA</button>
        <button class="reset-btn" @click="emit('reset')">REINICIAR TODO</button>
      </div>
    </div>

    <!-- Detalles de la Última Ronda -->
    <div class="bento-card history-card" v-if="lastRound">
      <h3>DETALLES REVISIÓN LETRA '{{ lastRound.letter }}'</h3>
      <div class="history-table-container">
        <table class="history-table">
          <thead>
            <tr>
              <th>Categoría</th>
              <template v-for="player in sortedPlayers" :key="player.id">
                <th>{{ player.name }}</th>
                <th class="pts-th">Pts</th>
              </template>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cat in categories" :key="cat.id">
              <td style="font-size: 0.9rem; color: var(--text-secondary);">{{ cat.label }}</td>
              <template v-for="player in sortedPlayers" :key="player.id">
                <td>{{ lastRound.players[player.id]?.answers[cat.id] || '---' }}</td>
                <td class="pts-col">{{ lastRound.roundDetails[player.id]?.[cat.id] || 0 }}</td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tabla de Victoria (Historial General) -->
    <div class="bento-card history-card" v-if="rounds.length > 0">
      <h3>HISTORIAL DE RONDAS</h3>
      <div class="history-table-container">
        <table class="history-table">
          <thead>
            <tr>
              <th>LETRA</th>
              <th v-for="player in sortedPlayers" :key="player.id">
                {{ player.name }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(round, idx) in historyTable" :key="idx">
              <td class="td-letter">{{ round.letter }}</td>
              <td v-for="player in sortedPlayers" :key="player.id">
                {{ round.scores[player.id] || 0 }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.results-view {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  align-items: center;
}

.winner-card {
  max-width: 600px;
  width: 100%;
  text-align: center;
  padding: 3rem;
}

.celebration h2 { font-size: 2.2rem; margin: 1rem 0; }
.crown { font-size: 4rem; display: block; filter: drop-shadow(0 0 10px gold); }

.summary-grid {
  margin: 2rem 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.player-rank {
  background: rgba(255,255,255,0.05);
  padding: 1rem 2rem;
  border-radius: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rank-name { font-weight: 700; font-size: 1.2rem; }
.rank-points { color: var(--accent-color); font-weight: 800; }

.action-buttons {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.next-btn {
  flex: 2;
  background: var(--accent-color);
  color: white;
  border: none;
  padding: 1rem;
  border-radius: 12px;
  font-weight: 800;
  cursor: pointer;
}

.reset-btn {
  flex: 1;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
  padding: 1rem;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
}

.history-card {
  width: 100%;
  max-width: 800px;
}

h3 { margin-bottom: 1.5rem; font-size: 0.9rem; letter-spacing: 2px; color: var(--text-secondary); }

.history-table-container {
  overflow-x: auto;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
}

.history-table th {
  text-align: left;
  padding: 1rem;
  border-bottom: 2px solid var(--glass-border);
  font-size: 0.8rem;
  color: var(--accent-color);
}

.history-table td {
  padding: 1rem;
  border-bottom: 1px solid var(--glass-border);
  font-size: 1.1rem;
}

.td-letter {
  font-weight: 800;
  color: var(--accent-color);
}

.pts-th {
  color: var(--text-secondary) !important;
}

.pts-col {
  color: var(--accent-color);
  font-weight: bold;
}
</style>
