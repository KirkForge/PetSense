<script lang="ts">
  import { pets, floorPlan, selectedPetId, selectPet, getPetTrail, isConnected, PetLocation } from '$lib/stores.svelte';
  import FloorPlan from '../components/FloorPlan.svelte';
  import SpeciesBadge from '../components/SpeciesBadge.svelte';

  let selectedPet: PetLocation | null = $derived(
    selectedPetId ? pets.find((p) => p.id === selectedPetId) ?? null : null
  );

  function handleSelectPet(e: CustomEvent<string>) {
    const id = e.detail;
    selectPet(selectedPetId === id ? null : id);
  }

  function lastSeenText(pet: PetLocation): string {
    return 'Just now';
  }

  function confidenceBar(pct: number): string {
    return `${Math.round(pct * 100)}%`;
  }
</script>

<div class="live-map">
  {#if floorPlan.length === 0 && pets.length === 0}
    <div class="empty-state">
      <div class="empty-icon">📡</div>
      <div class="empty-title">No pets detected</div>
      <div class="empty-desc">Waiting for CSI data from edge hub. Make sure your ESP32 sensors are online and streaming.</div>
    </div>
  {:else}
    <!-- Floor Plan Container -->
    <div class="map-container glass">
      <FloorPlan
        rooms={floorPlan}
        pets={pets}
        selectedPetId={selectedPetId}
        onselectpet={handleSelectPet}
      />
    </div>

    <!-- Info Sidebar -->
    <div class="info-area">
      <!-- Legend -->
      <div class="legend glass">
        <div class="legend-title">Legend</div>
        <div class="legend-item">
          <span class="legend-dot" style="background: #ff8c42;"></span>
          <span>Dog</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot" style="background: #42d4ff;"></span>
          <span>Cat</span>
        </div>
        <div class="legend-item">
          <svg width="40" height="4" style="display:inline;vertical-align:middle;">
            <line x1="0" y1="2" x2="40" y2="2" stroke="#555" stroke-dasharray="3 3" />
          </svg>
          <span style="margin-left: 6px;">Movement trail</span>
        </div>
      </div>

      <!-- Selected Pet Info Card -->
      {#if selectedPet}
        <div class="pet-info glass">
          <div class="info-header">
            <SpeciesBadge species={selectedPet.species} size="md" />
            <span class="info-name">{selectedPet.name ?? selectedPet.id}</span>
          </div>
          <div class="info-grid">
            <div class="info-cell">
              <span class="info-label">Room</span>
              <span class="info-value">{selectedPet.room}</span>
            </div>
            <div class="info-cell">
              <span class="info-label">Activity</span>
              <span class="badge activity-badge">{selectedPet.activity}</span>
            </div>
            <div class="info-cell">
              <span class="info-label">Confidence</span>
              <span class="info-value">{confidenceBar(selectedPet.confidence)}</span>
            </div>
            <div class="info-cell">
              <span class="info-label">Last seen</span>
              <span class="info-value">{lastSeenText(selectedPet)}</span>
            </div>
          </div>
        </div>
      {:else if pets.length > 0}
        <div class="pet-info glass" style="text-align:center;color:var(--text-muted);padding:var(--space-5);">
          Click a pet to see details
        </div>
      {/if}

      <!-- Pet List -->
      {#if pets.length > 0}
        <div class="pet-list glass">
          <div class="legend-title">Tracked Pets ({pets.length})</div>
          {#each pets as pet}
            <button
              class="pet-list-item"
              class:selected={selectedPetId === pet.id}
              onclick={() => selectPet(selectedPetId === pet.id ? null : pet.id)}
            >
              <SpeciesBadge species={pet.species} size="sm" />
              <span class="pet-list-name">{pet.name ?? pet.id}</span>
              <span class="pet-list-room">{pet.room}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .live-map {
    display: flex;
    gap: var(--space-5);
    animation: slide-up 0.3s ease-out;
  }

  .map-container {
    flex: 1;
    min-height: 480px;
    overflow: hidden;
    padding: var(--space-2);
  }

  .info-area {
    width: 260px;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    flex-shrink: 0;
  }

  .legend {
    padding: var(--space-4);
  }

  .legend-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: var(--space-3);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 0.82rem;
    color: var(--text);
    margin-bottom: var(--space-2);
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .pet-info {
    padding: var(--space-4);
  }

  .info-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }

  .info-name {
    font-weight: 600;
    font-size: 1rem;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .info-cell {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .info-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .info-value {
    font-size: 0.85rem;
    font-weight: 500;
  }

  .activity-badge {
    background: var(--glass-bg);
    color: var(--accent);
    font-size: 0.7rem;
  }

  .pet-list {
    padding: var(--space-4);
  }

  .pet-list-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s;
    font-size: 0.82rem;
    margin-bottom: var(--space-1);
  }

  .pet-list-item:hover { background: var(--glass-bg-hover); }
  .pet-list-item.selected { background: var(--accent-soft); }

  .pet-list-name { flex: 1; text-align: left; }
  .pet-list-room { color: var(--text-muted); font-size: 0.75rem; }

  @media (max-width: 800px) {
    .live-map { flex-direction: column; }
    .info-area { width: 100%; flex-direction: row; flex-wrap: wrap; }
    .info-area > * { flex: 1 1 200px; }
  }
</style>
