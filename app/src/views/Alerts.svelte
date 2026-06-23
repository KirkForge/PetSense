<script lang="ts">
  import { store, dismissAlert } from '$lib/stores.svelte';

  interface Zone {
    id: string;
    name: string;
    room: string;
    alertType: 'push' | 'visual';
    active: boolean;
  }

  let zones: Zone[] = $state([]);
  let showAddZone = $state(false);
  let newZoneName = $state('');
  let newZoneRoom = $state('');
  let newZoneAlertType: 'push' | 'visual' = $state('visual');

  const roomNames = $derived(store.floorPlan.map((r) => r.name));

  function addZone() {
    if (!newZoneName.trim() || !newZoneRoom) return;
    zones = [
      ...zones,
      {
        id: crypto.randomUUID(),
        name: newZoneName.trim(),
        room: newZoneRoom,
        alertType: newZoneAlertType,
        active: true,
      },
    ];
    newZoneName = '';
    newZoneRoom = '';
    newZoneAlertType = 'visual';
    showAddZone = false;
  }

  function toggleZone(id: string) {
    zones = zones.map((z) => (z.id === id ? { ...z, active: !z.active } : z));
  }

  function removeZone(id: string) {
    zones = zones.filter((z) => z.id !== id);
  }

  function timeAgo(ts: number): string {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return 'Just now';
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  }
</script>

<div class="alerts-view">
  <!-- Zone Configuration -->
  <div class="section glass">
    <div class="section-header">
      <h3>Alert Zones</h3>
      <button class="btn-primary" onclick={() => (showAddZone = !showAddZone)}>
        {showAddZone ? 'Cancel' : '+ Add Zone'}
      </button>
    </div>

    {#if showAddZone}
      <div class="add-zone-form glass">
        <input
          type="text"
          placeholder="Zone name (e.g. No-go Kitchen)"
          bind:value={newZoneName}
          class="input"
        />
        <select bind:value={newZoneRoom} class="input">
          <option value="" disabled>Select room...</option>
          {#each roomNames as room}
            <option value={room}>{room}</option>
          {/each}
        </select>
        <select bind:value={newZoneAlertType} class="input">
          <option value="push">Push Notification</option>
          <option value="visual">Visual Only</option>
        </select>
        <button class="btn-primary" onclick={addZone} disabled={!newZoneName.trim() || !newZoneRoom}>
          Save Zone
        </button>
      </div>
    {/if}

    {#if zones.length === 0 && !showAddZone}
      <div class="empty-state" style="padding: var(--space-6);">
        <div class="empty-icon">🚫</div>
        <div class="empty-title">No zones configured</div>
        <div class="empty-desc">Add a zone to get alerts when your pet enters specific rooms.</div>
      </div>
    {:else}
      <div class="zone-list">
        {#each zones as zone (zone.id)}
          <div class="zone-card" class:inactive={!zone.active}>
            <div class="zone-info">
              <span class="zone-name">{zone.name}</span>
              <span class="zone-room">{zone.room}</span>
              <span class="zone-type">{zone.alertType === 'push' ? 'Push' : 'Visual'}</span>
            </div>
            <div class="zone-actions">
              <button
                class="toggle-switch"
                class:on={zone.active}
                onclick={() => toggleZone(zone.id)}
                aria-label="Toggle zone"
              ></button>
              <button class="btn-ghost" onclick={() => removeZone(zone.id)}>Remove</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Alert History -->
  <div class="section glass">
    <div class="section-header">
      <h3>Alert History</h3>
      <span class="count-badge">{store.alerts.length}</span>
    </div>

    {#if store.alerts.length === 0}
      <div class="empty-state" style="padding: var(--space-6);">
        <div class="empty-icon">🔔</div>
        <div class="empty-title">No alerts yet</div>
        <div class="empty-desc">Alerts will appear here when pets trigger your configured zones.</div>
      </div>
    {:else}
      <div class="alert-list">
        {#each store.alerts as alert (alert.id)}
          <div class="alert-row glass">
            <div class="alert-icon">🔔</div>
            <div class="alert-body">
              <div class="alert-message">{alert.message}</div>
              <div class="alert-meta">{timeAgo(alert.timestamp)}</div>
            </div>
            <button class="dismiss-btn" onclick={() => dismissAlert(alert.id)} aria-label="Dismiss alert">
              x
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .alerts-view {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    animation: slide-up 0.3s ease-out;
  }

  .section { padding: var(--space-5); }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-4);
  }

  .section-header h3 {
    font-size: 1rem;
    font-weight: 600;
  }

  .count-badge {
    font-size: 0.75rem;
    color: var(--text-muted);
    background: var(--glass-bg);
    padding: var(--space-1) var(--space-2);
    border-radius: 999px;
  }

  .add-zone-form {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-4);
    margin-bottom: var(--space-4);
    flex-wrap: wrap;
  }

  .input {
    padding: var(--space-2) var(--space-3);
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: 0.85rem;
    min-width: 0;
  }

  .input::placeholder { color: var(--text-dim); }

  .zone-list { display: flex; flex-direction: column; gap: var(--space-2); }

  .zone-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--glass-bg);
    gap: var(--space-3);
  }

  .zone-card.inactive { opacity: 0.45; }

  .zone-info {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: 0.85rem;
  }

  .zone-name { font-weight: 600; }
  .zone-room { color: var(--text-muted); }
  .zone-type {
    font-size: 0.7rem;
    color: var(--accent);
    background: var(--accent-soft);
    padding: var(--space-1) var(--space-2);
    border-radius: 999px;
  }

  .zone-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .toggle-switch {
    width: 40px;
    height: 22px;
    border-radius: 11px;
    background: var(--text-dim);
    border: none;
    cursor: pointer;
    position: relative;
    transition: background 0.2s;
  }

  .toggle-switch.on { background: var(--accent); }

  .toggle-switch::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    transition: transform 0.2s;
  }

  .toggle-switch.on::after { transform: translateX(18px); }

  .alert-list { display: flex; flex-direction: column; gap: var(--space-2); }

  .alert-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--glass-bg) !important;
    backdrop-filter: none !important;
    border: 1px solid var(--glass-border);
    box-shadow: none;
    animation: slide-up 0.2s ease-out;
  }

  .alert-icon { font-size: 1.1rem; flex-shrink: 0; }

  .alert-body { flex: 1; min-width: 0; }
  .alert-message { font-size: 0.85rem; font-weight: 500; }
  .alert-meta { font-size: 0.72rem; color: var(--text-muted); margin-top: 1px; }

  .dismiss-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    font-size: 1rem;
    padding: var(--space-1);
  }

  .dismiss-btn:hover { color: var(--text); }
</style>
