<script lang="ts">
  import type { Room } from '$lib/stores.svelte';
  import type { PetLocation } from '$lib/stores.svelte';
  import { getPetTrail } from '$lib/stores.svelte';

  interface Props {
    rooms: Room[];
    pets: PetLocation[];
    selectedPetId: string | null;
    onselectpet?: (e: CustomEvent<string>) => void;
  }

  let { rooms, pets, selectedPetId, onselectpet }: Props = $props();

  const VIEW = { w: 600, h: 400 };
  const MARGIN = 20;

  /** Map coordinate to SVG point */
  function mapPos(pos: { x: number; y: number }): { x: number; y: number } {
    const xRange = rooms.length > 0
      ? Math.max(...rooms.map((r) => r.bounds.x2)) - Math.min(...rooms.map((r) => r.bounds.x1))
      : 500;
    const yRange = rooms.length > 0
      ? Math.max(...rooms.map((r) => r.bounds.y2)) - Math.min(...rooms.map((r) => r.bounds.y1))
      : 500;
    const xMin = rooms.length > 0 ? Math.min(...rooms.map((r) => r.bounds.x1)) : 0;
    const yMin = rooms.length > 0 ? Math.min(...rooms.map((r) => r.bounds.y1)) : 0;

    const sx = MARGIN + ((pos.x - xMin) / xRange) * (VIEW.w - 2 * MARGIN);
    const sy = MARGIN + ((pos.y - yMin) / yRange) * (VIEW.h - 2 * MARGIN);
    return { x: sx ?? VIEW.w / 2, y: sy ?? VIEW.h / 2 };
  }

  /** Room colors palette */
  const roomPalette = [
    '#ff8c4222', '#42d4ff22', '#4ade8022', '#fbbf2422',
    '#f472b622', '#a78bfa22', '#f8717122', '#60a5fa22',
  ];

  function roomFill(i: number): string {
    return rooms[i]?.color ?? roomPalette[i % roomPalette.length];
  }

  function roomStroke(i: number): string {
    const fill = roomFill(i);
    return fill.slice(0, 7) + '55';
  }

  /** Species-based color */
  function petColor(species: 'dog' | 'cat'): string {
    return species === 'dog' ? '#ff8c42' : '#42d4ff';
  }

  /** Trail polyline points string */
  function trailPoints(petId: string): string {
    const trail = getPetTrail(petId);
    if (trail.length < 2) return '';
    return trail.map((p) => {
      const m = mapPos(p);
      return `${m.x},${m.y}`;
    }).join(' ');
  }

  function handleDotClick(petId: string) {
    onselectpet?.(new CustomEvent('selectpet', { detail: petId }));
  }

  /** Grid lines */
  const gridLines = $derived.by(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i <= 10; i++) {
      const pct = i / 10;
      const x = MARGIN + pct * (VIEW.w - 2 * MARGIN);
      const y = MARGIN + pct * (VIEW.h - 2 * MARGIN);
      if (i > 0 && i < 10) {
        lines.push({ x1: x, y1: MARGIN, x2: x, y2: VIEW.h - MARGIN });
        lines.push({ x1: MARGIN, y1: y, x2: VIEW.w - MARGIN, y2: y });
      }
    }
    return lines;
  });

  /** Check for missing room layout */
  const hasRooms = rooms.length > 0;
</script>

<svg
  viewBox="0 0 {VIEW.w} {VIEW.h}"
  aria-label="Floor plan showing pet locations"
  role="img"
  xmlns="http://www.w3.org/2000/svg"
  style="width:100%;height:auto;"
>
  <title>PetSense Floor Plan — Real-time pet location map</title>
  <desc>Interactive map showing room layout with live pet position indicators and movement trails.</desc>

  <!-- Grid lines -->
  {#each gridLines as line}
    <line
      x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
      stroke="rgba(255,255,255,0.04)" stroke-width="1"
    />
  {/each}

  {#if hasRooms}
    <!-- Room rectangles -->
    {#each rooms as room, i}
      {@const tl = mapPos({ x: room.bounds.x1, y: room.bounds.y1 })}
      {@const br = mapPos({ x: room.bounds.x2, y: room.bounds.y2 })}
      <rect
        x={tl.x} y={tl.y}
        width={br.x - tl.x} height={br.y - tl.y}
        fill={roomFill(i)}
        stroke={roomStroke(i)}
        stroke-width="1.5"
        rx="4"
      />
      <!-- Room label -->
      <text
        x={tl.x + (br.x - tl.x) / 2}
        y={tl.y + (br.y - tl.y) / 2}
        text-anchor="middle"
        dominant-baseline="central"
        fill="rgba(255,255,255,0.25)"
        font-size="12"
        font-family="var(--font-sans)"
      >{room.name}</text>
    {/each}

    <!-- Pet movement trails -->
    {#each pets as pet}
      {@const pts = trailPoints(pet.id)}
      {#if pts}
        <polyline
          points={pts}
          fill="none"
          stroke={petColor(pet.species)}
          stroke-width="1.5"
          stroke-dasharray="4 4"
          opacity="0.35"
        />
      {/if}
    {/each}

    <!-- Pet position dots -->
    {#each pets as pet}
      {@const pos = mapPos(pet.position)}
      {@const isSelected = selectedPetId === pet.id}
      {@const color = petColor(pet.species)}

      <!-- Ping ring for selected pet -->
      {#if isSelected}
        <circle cx={pos.x} cy={pos.y} r="14" fill="none" stroke={color} stroke-width="2" opacity="0.4">
          <animate attributeName="r" from="8" to="22" dur="1.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.6" to="0" dur="1.2s" repeatCount="indefinite" />
        </circle>
      {/if}

      <!-- Pet dot -->
      <circle
        cx={pos.x} cy={pos.y} r="7"
        fill={color}
        stroke={isSelected ? 'white' : 'none'}
        stroke-width={isSelected ? 2 : 0}
        opacity={isSelected ? 1 : 0.85}
        style="cursor:pointer;"
        onclick={() => handleDotClick(pet.id)}
      >
        <animate attributeName="r" values="6;8;6" dur="2s" repeatCount="indefinite" />
      </circle>

      <!-- Pet name label -->
      <text
        x={pos.x} y={pos.y - 14}
        text-anchor="middle"
        fill={color}
        font-size="10"
        font-weight="600"
        font-family="var(--font-sans)"
      >{pet.name ?? pet.id}</text>
    {/each}

    <!-- Coordinate reference labels -->
    <text x={VIEW.w / 2} y={VIEW.h - 4} text-anchor="middle" fill="rgba(255,255,255,0.15)" font-size="8">X</text>
    <text x={4} y={VIEW.h / 2} text-anchor="middle" fill="rgba(255,255,255,0.15)" font-size="8" transform="rotate(-90,4,{VIEW.h/2})">Y</text>
  {:else}
    <!-- Fallback when no floor plan -->
    <rect x="0" y="0" width={VIEW.w} height={VIEW.h} fill="none" />
    <text
      x={VIEW.w / 2} y={VIEW.h / 2}
      text-anchor="middle" dominant-baseline="central"
      fill="var(--text-muted)" font-size="14"
      font-family="var(--font-sans)"
    >No floor plan configured</text>
    <text
      x={VIEW.w / 2} y={VIEW.h / 2 + 22}
      text-anchor="middle" dominant-baseline="central"
      fill="var(--text-dim)" font-size="11"
      font-family="var(--font-sans)"
    >Configure rooms in edge hub config.yaml</text>
  {/if}
</svg>
