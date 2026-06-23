<script lang="ts">
  interface Props {
    data: number[];
    color: string;
    width: number;
    height: number;
  }

  let { data, color, width, height }: Props = $props();

  const MARGIN = { top: 8, right: 8, bottom: 8, left: 8 };

  const chartW = $derived(width - MARGIN.left - MARGIN.right);
  const chartH = $derived(height - MARGIN.top - MARGIN.bottom);

  const points = $derived.by(() => {
    if (data.length === 0) return '';
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const stepX = chartW / Math.max(data.length - 1, 1);

    return data
      .map((val, i) => {
        const x = MARGIN.left + i * stepX;
        const y = MARGIN.top + chartH - ((val - min) / range) * chartH;
        return `${x},${y}`;
      })
      .join(' ');
  });

  const areaPoints = $derived(
    points
      ? `${MARGIN.left + chartW},${MARGIN.top + chartH} ` +
        points +
        ` ${MARGIN.left},${MARGIN.top + chartH}`
      : ''
  );

  const gradientId = $derived('sg-' + color.replace('#', ''));

  const lastPoint = $derived.by(() => {
    if (data.length === 0) return null;
    const last = data[data.length - 1];
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const stepX = chartW / Math.max(data.length - 1, 1);
    return {
      x: MARGIN.left + (data.length - 1) * stepX,
      y: MARGIN.top + chartH - ((last - min) / range) * chartH,
    };
  });
</script>

{#if data.length > 0}
  <svg viewBox="0 0 {width} {height}" width="100%" height="auto" aria-label="Activity sparkline chart" role="img">
    <defs>
      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color={color} stop-opacity="0.3" />
        <stop offset="100%" stop-color={color} stop-opacity="0.02" />
      </linearGradient>
    </defs>

    <!-- Area fill -->
    <polygon points={areaPoints} fill={`url(#${gradientId})`} />

    <!-- Line -->
    <polyline
      points={points}
      fill="none"
      stroke={color}
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    {#if lastPoint}
      <!-- Last point dot -->
      <circle cx={lastPoint.x} cy={lastPoint.y} r="3" fill={color} stroke="white" stroke-width="1" />
    {/if}
  </svg>
{:else}
  <div style="text-align:center;color:var(--text-muted);padding: var(--space-4);font-size: 0.8rem;">
    No activity data yet
  </div>
{/if}
