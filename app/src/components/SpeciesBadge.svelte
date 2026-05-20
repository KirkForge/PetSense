<script lang="ts">
  interface Props {
    species: 'dog' | 'cat';
    size?: 'sm' | 'md';
  }

  let { species, size = 'md' }: Props = $props();

  const color = $derived(species === 'dog' ? '#ff8c42' : '#42d4ff');
  const bg = $derived(species === 'dog' ? 'rgba(255,140,66,0.15)' : 'rgba(66,212,255,0.15)');
  const label = $derived(species === 'dog' ? 'Dog' : 'Cat');
</script>

<span
  class="species-badge"
  class:sm={size === 'sm'}
  class:md={size === 'md'}
  style="
    --badge-color: {color};
    --badge-bg: {bg};
  "
  aria-label={label}
>
  <span class="badge-circle"></span>
  {#if size === 'md'}
    <span class="badge-text">{label}</span>
  {/if}
</span>

<style>
  .species-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    border-radius: 999px;
    background: var(--badge-bg);
    color: var(--badge-color);
    font-weight: 700;
    flex-shrink: 0;
  }

  .species-badge.sm {
    padding: 2px var(--space-2);
    font-size: 0.65rem;
    height: 18px;
  }

  .species-badge.md {
    padding: var(--space-1) var(--space-3);
    font-size: 0.75rem;
    height: 24px;
  }

  .badge-circle {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--badge-color);
    flex-shrink: 0;
  }

  .sm .badge-circle {
    width: 6px;
    height: 6px;
  }

  .badge-text {
    letter-spacing: 0.03em;
  }
</style>
