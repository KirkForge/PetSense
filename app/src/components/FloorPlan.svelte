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

  /** Room colors palette */
  const roomPalette = [
    '#ff8c4222', '#42d4ff22', '#4ade8022', '#fbbf2422',
    '#f472b622', '#a78bfa22', '#f8717122', '#60a5fa22',
  ];

  /** Map coordinate to SVG point — pure function, no reactive reads */
  function mapPos(pos: { x: number; y: number }, xMin: number, yMin: number, xRange: number, yRange: number): { x: number; y: number } {
    const sx = MARGIN + ((pos.x - xMin) / (xRange || 500)) * (VIEW.w - 2 * MARGIN);
    const sy = MARGIN + ((pos.y - yMin) / (yRange || 500)) * (VIEW.h - 2 * MARGIN);
    return { x: sx ?? VIEW.w / 2, y: sy ?? VIEW.h / 2 };
  }

  /** Species-based color — pure function */
  function petColor(species: 'dog' | 'cat'): string {
    return species === 'dog' ? '#ff8c42' : '#42d4ff';
  }

  function handleDotClick(petId: string) {
    onselectpet?.(new CustomEvent('selectpet', { detail: petId }));
  }

  // ── Derived coordinate system ──────────────────────────

  const coordBounds = $derived.by(() => {
    if (rooms.length === 0) return { xMin: 0, yMin: 0, xRange: 500, yRange: 500 };
    const xs = rooms.map((r) => [r.bounds.x1, r.bounds.x2]).flat();
    const ys = rooms.map((r) => [r.bounds.y1, r.bounds.y2]).flat();
    return {
      xMin: Math.min(...xs),
      yMin: Math.min(...ys),
      xRange: Math.max(...xs) - Math.min(...xs),
      yRange: Math.max(...ys) - Math.min(...ys),
    };
  });

  // ── Derived room data with pre-computed positions ─────

  const roomData = $derived.by(() => {
    const { xMin, yMin, xRange, yRange } = coordBounds;
    return rooms.map((room, i) => {
      const tl = mapPos({ x: room.bounds.x1, y: room.bounds.y1 }, xMin, yMin, xRange, yRange);
      const br = mapPos({ x: room.bounds.x2, y: room.bounds.y2 }, xMin, yMin, xRange, yRange);
      const fill = room.color ?? roomPalette[i % roomPalette.length];
      const stroke = fill.slice(0, 7) + '55';
      return { ...room, tl, br, fill, stroke };
    });
  });

  // ── Derived pet data with pre-computed positions ───────

  const petData = $derived.by(() => {
    const { xMin, yMin, xRange, yRange } = coordBounds;
    return pets.map((pet) => {
      const pos = mapPos(pet.position, xMin, yMin, xRange, yRange);
      const color = petColor(pet.species);
      const trail = getPetTrail(pet.id);
      const pts = trail.length >= 2
        ? trail.map((p) => {
            const m = mapPos(p, xMin, yMin, xRange, yRange);
            return `${m.x},${m.y}`;
          }).join(' ')
        : '';
      return { ...pet, pos, color, pts };
    });
  });

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
  const hasRooms = $derived(rooms.length > 0);
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
    {#each roomData as room}
      <rect
        x={room.tl.x} y={room.tl.y}
        width={room.br.x - room.tl.x} height={room.br.y - room.tl.y}
        fill={room.fill}
        stroke={room.stroke}
        stroke-width="1.5"
        rx="4"
      />
      <!-- Room label -->
      <text
        x={room.tl.x + (room.br.x - room.tl.x) / 2}
        y={room.tl.y + (room.br.y - room.tl.y) / 2}
        text-anchor="middle"
        dominant-baseline="central"
        fill="rgba(255,255,255,0.25)"
        font-size="12"
        font-family="var(--font-sans)"
      >{room.name}</text>
    {/each}

    <!-- Pet movement trails -->
    {#each petData as pet}
      {#if pet.pts}
        <polyline
          points={pet.pts}
          fill="none"
          stroke={pet.color}
          stroke-width="1.5"
          stroke-dasharray="4 4"
          opacity="0.35"
        />
      {/if}
    {/each}

    <!-- Pet position dots -->
    {#each petData as pet}
      {@const isSelected = selectedPetId === pet.id}

      <!-- Ping ring for selected pet -->
      {#if isSelected}
        <circle cx={pet.pos.x} cy={pet.pos.y} r="14" fill="none" stroke={pet.color} stroke-width="2" opacity="0.4">
          <animate attributeName="r" from="8" to="22" dur="1.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.6" to="0" dur="1.2s" repeatCount="indefinite" />
        </circle>
      {/if}

      <!-- Pet dot -->
      <circle
        cx={pet.pos.x} cy={pet.pos.y} r="7"
        fill={pet.color}
        stroke={isSelected ? 'white' : 'none'}
        stroke-width={isSelected ? 2 : 0}
        opacity={isSelected ? 1 : 0.85}
        style="cursor:pointer;"
        role="button"
        tabindex="0"
        aria-label={`Select pet ${pet.name ?? pet.id}`}
        onclick={() => handleDotClick(pet.id)}
        onkeydown={(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleDotClick(pet.id);
          }
        }}
      >
        <animate attributeName="r" values="6;8;6" dur="2s" repeatCount="indefinite" />
      </circle>

      <!-- Pet name label -->
      <text
        x={pet.pos.x} y={pet.pos.y - 14}
        text-anchor="middle"
        fill={pet.color}
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
