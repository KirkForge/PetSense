<script lang="ts">
  import { pets } from '$lib/stores.svelte';
  import SpeciesBadge from '../components/SpeciesBadge.svelte';

  /** Activity color map */
  const activityColors: Record<string, string> = {
    walking: '#4ade80',
    running: '#fbbf24',
    lying: '#60a5fa',
    sleeping: '#60a5fa',
    playing: '#f472b6',
    scratching: '#f87171',
    sitting: '#a78bfa',
    unknown: '#71717a',
  };

  type FilterChip = 'All' | 'Dog' | 'Cat' | 'Walking' | 'Running' | 'Playing' | 'Resting';
  const filterChips: FilterChip[] = ['All', 'Dog', 'Cat', 'Walking', 'Running', 'Playing', 'Resting'];
  let activeFilter: FilterChip = $state('All');

  /** Dummy timeline entries - in real app, would be fed from edge hub */
  interface TimelineEntry {
    petId: string;
    species: 'dog' | 'cat';
    petName: string;
    activity: string;
    hour: number;
    endHour?: number;
    confidence: number;
    duration: number; /* minutes */
  }

  const timelineEntries: TimelineEntry[] = $derived(
    pets.map((pet, i) => ({
      petId: pet.id,
      species: pet.species,
      petName: pet.name ?? pet.id,
      activity: pet.activity,
      hour: new Date().getHours(),
      confidence: pet.confidence,
      duration: 10 + (i * 7),
    }))
  );

  let selectedEntry: TimelineEntry | null = $state(null);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  function matchesFilter(entry: TimelineEntry): boolean {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Dog') return entry.species === 'dog';
    if (activeFilter === 'Cat') return entry.species === 'cat';
    if (activeFilter === 'Walking') return entry.activity === 'walking';
    if (activeFilter === 'Running') return entry.activity === 'running';
    if (activeFilter === 'Playing') return entry.activity === 'playing';
    if (activeFilter === 'Resting') return entry.activity === 'lying' || entry.activity === 'sleeping' || entry.activity === 'sitting';
    return true;
  }

  const filteredEntries = $derived(timelineEntries.filter(matchesFilter));

  function activityColor(activity: string): string {
    return activityColors[activity] ?? activityColors.unknown;
  }

  function selectEntry(entry: TimelineEntry) {
    selectedEntry = selectedEntry?.petId === entry.petId && selectedEntry?.hour === entry.hour ? null : entry;
  }

  function formatHour(h: number): string {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}${ampm}`;
  }
</script>

<div class="timeline-view">
  {#if pets.length === 0}
    <div class="empty-state">
      <div class="empty-icon">🕐</div>
      <div class="empty-title">No activity yet</div>
      <div class="empty-desc">Activity timeline will appear here once pets are detected and moving through your home.</div>
    </div>
  {:else}
    <!-- Filter Chips -->
    <div class="filter-row">
      {#each filterChips as chip}
        <button
          class="chip"
          class:active={activeFilter === chip}
          onclick={() => (activeFilter = chip)}
        >
          {chip}
        </button>
      {/each}
    </div>

    <!-- Timeline -->
    <div class="timeline-scroll">
      <div class="timeline-grid">
        {#each hours as hour}
          <div class="hour-marker">
            <span class="hour-label">{formatHour(hour)}</span>
          </div>
        {/each}

        <!-- Activity Bars Layer -->
        <div class="activity-layer">
          {#each filteredEntries as entry (entry.petId + '-' + entry.hour)}
            <button
              class="activity-bar"
              class:selected={selectedEntry?.petId === entry.petId && selectedEntry?.hour === entry.hour}
              style="
                left: {(entry.hour / 24) * 100}%;
                width: {Math.max((entry.duration / 60) * (100 / 24), 1.2)}%;
                background: {activityColor(entry.activity)};
              "
              onclick={() => selectEntry(entry)}
              title="{entry.petName}: {entry.activity}"
            >
              <SpeciesBadge species={entry.species} size="sm" />
              <span class="bar-label">{entry.petName}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>

    <!-- Detail Popup -->
    {#if selectedEntry}
      <div class="detail-popup glass">
        <div class="detail-header">
          <SpeciesBadge species={selectedEntry.species} size="md" />
          <strong>{selectedEntry.petName}</strong>
          <button class="close-btn" onclick={() => (selectedEntry = null)}>x</button>
        </div>
        <div class="detail-grid">
          <div class="detail-cell">
            <span class="detail-label">Activity</span>
            <span class="detail-value">{selectedEntry.activity}</span>
          </div>
          <div class="detail-cell">
            <span class="detail-label">Time</span>
            <span class="detail-value">{formatHour(selectedEntry.hour)}</span>
          </div>
          <div class="detail-cell">
            <span class="detail-label">Duration</span>
            <span class="detail-value">{selectedEntry.duration} min</span>
          </div>
          <div class="detail-cell">
            <span class="detail-label">Confidence</span>
            <span class="detail-value">{Math.round(selectedEntry.confidence * 100)}%</span>
          </div>
        </div>
      </div>
    {/if}

    <!-- Pets Legend -->
    <div class="pets-summary">
      {#each pets as pet}
        <div class="pet-summary-item">
          <SpeciesBadge species={pet.species} size="sm" />
          <span>{pet.name ?? pet.id}:</span>
          <span style="color: {activityColor(pet.activity)};">{pet.activity}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .timeline-view {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    animation: slide-up 0.3s ease-out;
  }

  .filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .timeline-scroll {
    overflow-x: auto;
    padding-bottom: var(--space-4);
  }

  .timeline-grid {
    position: relative;
    min-width: 1200px;
    height: 180px;
    display: flex;
    border-bottom: 1px solid var(--glass-border);
    margin-bottom: var(--space-2);
  }

  .hour-marker {
    flex: 1;
    position: relative;
    border-left: 1px solid rgba(255,255,255,0.06);
    min-width: 0;
  }

  .hour-label {
    position: absolute;
    bottom: -20px;
    left: 2px;
    font-size: 0.65rem;
    color: var(--text-dim);
    white-space: nowrap;
  }

  .activity-layer {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-start;
    padding-top: var(--space-1);
    pointer-events: none;
  }

  .activity-bar {
    position: absolute;
    height: 22px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: 0 var(--space-2);
    cursor: pointer;
    border: none;
    font-size: 0.65rem;
    color: #0a0a0f;
    font-weight: 600;
    opacity: 0.85;
    transition: opacity 0.15s, transform 0.1s;
    pointer-events: all;
    top: var(--space-1);
  }

  .activity-bar:hover { opacity: 1; transform: scaleY(1.3); z-index: 2; }
  .activity-bar.selected { opacity: 1; outline: 2px solid white; z-index: 3; }

  .bar-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .detail-popup {
    padding: var(--space-4);
    animation: slide-up 0.2s ease-out;
  }

  .detail-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .close-btn {
    margin-left: auto;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    color: var(--text-muted);
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .detail-cell {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .detail-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .detail-value {
    font-size: 0.9rem;
    font-weight: 500;
  }

  .pets-summary {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    padding: var(--space-3);
  }

  .pet-summary-item {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: 0.8rem;
  }
</style>
