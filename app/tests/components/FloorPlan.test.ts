import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import FloorPlan from '../../src/components/FloorPlan.svelte';
import type { Room, PetLocation } from '../../src/lib/stores.svelte';

describe('FloorPlan', () => {
  afterEach(() => cleanup());

  const sampleRooms: Room[] = [
    { name: 'Living', bounds: { x1: 0, y1: 0, x2: 300, y2: 250 } },
    { name: 'Kitchen', bounds: { x1: 300, y1: 0, x2: 500, y2: 200 } },
    { name: 'Bedroom', bounds: { x1: 0, y1: 250, x2: 250, y2: 500 } },
  ];

  const samplePets: PetLocation[] = [
    {
      id: 'pet-dog-1',
      species: 'dog',
      name: 'Rex',
      position: { x: 150, y: 100 },
      room: 'Living',
      activity: 'walking',
      confidence: 0.95,
    },
    {
      id: 'pet-cat-1',
      species: 'cat',
      name: 'Luna',
      position: { x: 380, y: 80 },
      room: 'Kitchen',
      activity: 'sitting',
      confidence: 0.82,
    },
  ];

  it('renders SVG with correct viewBox', () => {
    const { container } = render(FloorPlan, {
      rooms: sampleRooms,
      pets: [],
      selectedPetId: null,
    });
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 600 400');
  });

  it('renders room rects from rooms prop', () => {
    const { container } = render(FloorPlan, {
      rooms: sampleRooms,
      pets: [],
      selectedPetId: null,
    });
    const rects = container.querySelectorAll('rect');
    // At least 3 room rects for 3 rooms
    expect(rects.length).toBeGreaterThanOrEqual(3);
  });

  it('renders room name labels', () => {
    const { getByText } = render(FloorPlan, {
      rooms: sampleRooms,
      pets: [],
      selectedPetId: null,
    });
    expect(getByText('Living')).toBeInTheDocument();
    expect(getByText('Kitchen')).toBeInTheDocument();
    expect(getByText('Bedroom')).toBeInTheDocument();
  });

  it('renders pet dots from pets prop', () => {
    const { container } = render(FloorPlan, {
      rooms: sampleRooms,
      pets: samplePets,
      selectedPetId: null,
    });
    // Pet dots are <circle> elements with cursor pointer style
    const petCircles = container.querySelectorAll('circle[style*="cursor:pointer"]');
    expect(petCircles.length).toBe(2);
  });

  it('renders pet name labels', () => {
    const { getByText } = render(FloorPlan, {
      rooms: sampleRooms,
      pets: samplePets,
      selectedPetId: null,
    });
    expect(getByText('Rex')).toBeInTheDocument();
    expect(getByText('Luna')).toBeInTheDocument();
  });

  it('no dots when pets array is empty', () => {
    const { container } = render(FloorPlan, {
      rooms: sampleRooms,
      pets: [],
      selectedPetId: null,
    });
    const petCircles = container.querySelectorAll('circle[style*="cursor:pointer"]');
    expect(petCircles.length).toBe(0);
  });

  it('highlights selected pet dot with different stroke', () => {
    const { container } = render(FloorPlan, {
      rooms: sampleRooms,
      pets: samplePets,
      selectedPetId: 'pet-dog-1',
    });
    const selectedDot = container.querySelectorAll('circle[stroke="white"]');
    expect(selectedDot.length).toBeGreaterThanOrEqual(1);
  });

  it('renders grid lines', () => {
    const { container } = render(FloorPlan, {
      rooms: sampleRooms,
      pets: [],
      selectedPetId: null,
    });
    const gridLines = container.querySelectorAll('line[stroke*="0.04"]');
    expect(gridLines.length).toBeGreaterThan(0);
  });

  it('has accessible aria-label', () => {
    const { container } = render(FloorPlan, {
      rooms: sampleRooms,
      pets: [],
      selectedPetId: null,
    });
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-label', 'Floor plan showing pet locations');
    expect(svg).toHaveAttribute('role', 'img');
  });

  it('shows fallback when no rooms configured', () => {
    const { getByText } = render(FloorPlan, {
      rooms: [],
      pets: [],
      selectedPetId: null,
    });
    expect(getByText('No floor plan configured')).toBeInTheDocument();
  });

  it('does not show fallback text when rooms exist', () => {
    const { queryByText } = render(FloorPlan, {
      rooms: sampleRooms,
      pets: [],
      selectedPetId: null,
    });
    expect(queryByText('No floor plan configured')).not.toBeInTheDocument();
  });
});
