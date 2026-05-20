<script lang="ts">
  import { pets, alerts, isConnected } from '$lib/stores.svelte';
  import LiveMap from './views/LiveMap.svelte';
  import Timeline from './views/Timeline.svelte';
  import Alerts from './views/Alerts.svelte';
  import Health from './views/Health.svelte';

  const tabs = ['Map', 'Timeline', 'Alerts', 'Health'] as const;
  type Tab = (typeof tabs)[number];

  let activeTab: Tab = $state('Map');

  function statusLabel(): string {
    if (isConnected.value) return 'Connected';
    return 'Disconnected';
  }
</script>

<div class="app-shell">
  <!-- Top Nav -->
  <nav class="glass top-nav">
    <div class="nav-brand">
      <span class="brand-icon">🐾</span>
      <span class="brand-text">PetSense</span>
    </div>

    <div class="tab-bar">
      {#each tabs as tab}
        <button
          class="tab-btn"
          class:active={activeTab === tab}
          onclick={() => (activeTab = tab)}
        >
          {tab}
        </button>
      {/each}
    </div>

    <div class="nav-status" title={statusLabel()}>
      <span
        class="dot"
        class:connected={isConnected.value}
        class:disconnected={!isConnected.value}
      ></span>
      <span class="status-text">{statusLabel()}</span>
    </div>
  </nav>

  <!-- Tab Content -->
  <main class="tab-content">
    {#if activeTab === 'Map'}
      <LiveMap />
    {:else if activeTab === 'Timeline'}
      <Timeline />
    {:else if activeTab === 'Alerts'}
      <Alerts />
    {:else if activeTab === 'Health'}
      <Health />
    {/if}
  </main>
</div>

<style>
  .top-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-5);
    margin-bottom: var(--space-6);
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .nav-brand {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: 700;
    font-size: 1.15rem;
    letter-spacing: -0.02em;
  }

  .brand-icon { font-size: 1.3rem; }
  .brand-text { color: var(--text); }

  .nav-status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 0.75rem;
    color: var(--text-muted);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-sm);
    transition: background 0.15s;
    cursor: default;
  }

  .nav-status:hover { background: var(--glass-bg-hover); }
  .status-text { white-space: nowrap; }

  .tab-content {
    animation: slide-up 0.25s ease-out;
  }

  @media (max-width: 640px) {
    .top-nav { padding: var(--space-3); gap: var(--space-3); }
    .tab-bar { order: 3; width: 100%; justify-content: center; }
    .tab-btn { padding: var(--space-1) var(--space-3); font-size: 0.8rem; }
  }
</style>
