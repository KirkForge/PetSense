<script lang="ts">
  import { pets, healthTrends, selectPet, selectedPetId, HealthTrend } from '$lib/stores.svelte';
  import SpeciesBadge from '../components/SpeciesBadge.svelte';
  import ActivitySparkline from '../components/ActivitySparkline.svelte';

  /** Dummy health data — in real app, loaded from DB/edge hub */
  interface PetHealth {
    petId: string;
    species: 'dog' | 'cat';
    name: string;
    todayMins: number;
    weekAvg: number;
    prevWeekAvg: number;
    dailyMins: number[]; /* last 14 days */
    changePct: number;
    anomaly: boolean;
  }

  const healthData: PetHealth[] = $derived(
    pets.map((pet, i) => {
      const today = 30 + Math.floor(Math.random() * 40);
      const prev = 48 + Math.floor(Math.random() * 20);
      const avg = today + Math.floor(Math.random() * 15);
      const daily = Array.from({ length: 14 }, () => 20 + Math.floor(Math.random() * 50));
      return {
        petId: pet.id,
        species: pet.species,
        name: pet.name ?? pet.id,
        todayMins: today,
        weekAvg: avg,
        prevWeekAvg: prev,
        dailyMins: daily,
        changePct: prev > 0 ? Math.round(((avg - prev) / prev) * 100) : 0,
        anomaly: prev > 0 && avg < prev * 0.7,
      };
    })
  );

  let activePetId = $derived(selectedPetId ?? (pets.length > 0 ? pets[0].id : null));
  let activeHealth = $derived(healthData.find((h) => h.petId === activePetId) ?? null);

  function weekBarColor(minutes: number): string {
    if (minutes > 50) return '#4ade80';
    if (minutes > 25) return '#fbbf24';
    return '#f87171';
  }
</script>

<div class="health-view">
  {#if pets.length === 0}
    <div class="empty-state">
      <div class="empty-icon">💊</div>
      <div class="empty-title">No pets tracked</div>
      <div class="empty-desc">Health analytics will appear once pets are detected by CSI sensors.</div>
    </div>
  {:else}
    <!-- Pet Selector -->
    <div class="pet-selector glass">
      {#each pets as pet}
        <button
          class="chip"
          class:active={activePetId === pet.id}
          onclick={() => selectPet(pet.id)}
        >
          <SpeciesBadge species={pet.species} size="sm" />
          {pet.name ?? pet.id}
        </button>
      {/each}
    </div>

    {#if activeHealth}
      <!-- Anomaly Alert -->
      {#if activeHealth.anomaly}
        <div class="anomaly-card glass">
          <div class="anomaly-icon">⚠️</div>
          <div class="anomaly-text">
            <strong>{activeHealth.name}</strong> is significantly less active this week ({activeHealth.changePct}%).
            This could indicate illness, arthritis, or depression. Consider a vet visit.
          </div>
        </div>
      {/if}

      <!-- Stats Row -->
      <div class="stats-row">
        <div class="stat-card glass">
          <span class="stat-label">Today</span>
          <span class="stat-value">{activeHealth.todayMins}min active</span>
        </div>
        <div class="stat-card glass">
          <span class="stat-label">Week Avg</span>
          <span class="stat-value">{activeHealth.weekAvg}min</span>
        </div>
        <div class="stat-card glass">
          <span class="stat-label">Change</span>
          <span class="stat-value" class:decline={activeHealth.changePct < 0} class:improve={activeHealth.changePct > 0}>
            {activeHealth.changePct > 0 ? '+' : ''}{activeHealth.changePct}%
          </span>
        </div>
      </div>

      <!-- Activity Trend Sparkline -->
      <div class="chart-card glass">
        <h4>14-Day Activity Trend</h4>
        <ActivitySparkline
          data={activeHealth.dailyMins}
          color="#ff8c42"
          width={600}
          height={120}
        />
      </div>

      <!-- Activity Heatmap (7-day mini grid) -->
      <div class="chart-card glass">
        <h4>7-Day Activity Heatmap</h4>
        <div class="heatmap">
          {#each activeHealth.dailyMins.slice(0, 7) as min, i}
            <div class="heatmap-cell" style="background: {weekBarColor(min)};" title="Day {i + 1}: {min}min">
              <span class="heatmap-label">{['M','T','W','T','F','S','S'][i]}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Baseline Comparison: Bar Chart -->
      <div class="chart-card glass">
        <h4>Week Comparison</h4>
        <div class="bar-compare">
          <div class="bar-col">
            <span class="bar-label-text">Previous Week</span>
            <div class="bar-wrap">
              <div class="bar" style="height: {(activeHealth.prevWeekAvg / 80) * 100}%; background: var(--text-dim);"></div>
            </div>
            <span class="bar-val">{activeHealth.prevWeekAvg} min</span>
          </div>
          <div class="bar-col">
            <span class="bar-label-text">Current Week</span>
            <div class="bar-wrap">
              <div class="bar" style="height: {(activeHealth.weekAvg / 80) * 100}%; background: var(--accent);"></div>
            </div>
            <span class="bar-val">{activeHealth.weekAvg} min</span>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .health-view {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    animation: slide-up 0.3s ease-out;
  }

  .pet-selector {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    flex-wrap: wrap;
  }

  .anomaly-card {
    display: flex;
    align-items: flex-start;
    gap: var(--space-4);
    padding: var(--space-5);
    border-color: rgba(251, 191, 36, 0.3);
    background: rgba(251, 191, 36, 0.06);
  }

  .anomaly-icon { font-size: 1.5rem; flex-shrink: 0; }
  .anomaly-text { font-size: 0.9rem; line-height: 1.5; color: var(--warning); }

  .stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4);
  }

  .stat-card {
    padding: var(--space-4);
    text-align: center;
  }

  .stat-label {
    display: block;
    font-size: 0.72rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--space-2);
  }

  .stat-value {
    display: block;
    font-size: 1.2rem;
    font-weight: 700;
  }

  .decline { color: var(--danger); }
  .improve { color: var(--success); }

  .chart-card {
    padding: var(--space-5);
  }

  .chart-card h4 {
    font-size: 0.8rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--space-4);
  }

  .heatmap {
    display: flex;
    gap: var(--space-2);
  }

  .heatmap-cell {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s;
  }

  .heatmap-cell:hover { transform: scale(1.15); }

  .heatmap-label {
    font-size: 0.7rem;
    font-weight: 700;
    color: #0a0a0f;
  }

  .bar-compare {
    display: flex;
    align-items: flex-end;
    gap: var(--space-8);
    justify-content: center;
  }

  .bar-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .bar-label-text {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin-bottom: var(--space-2);
  }

  .bar-wrap {
    width: 60px;
    height: 120px;
    display: flex;
    align-items: flex-end;
  }

  .bar {
    width: 100%;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    transition: height 0.4s ease;
  }

  .bar-val {
    font-size: 0.8rem;
    font-weight: 600;
  }

  @media (max-width: 640px) {
    .stats-row { grid-template-columns: 1fr; }
  }
</style>
