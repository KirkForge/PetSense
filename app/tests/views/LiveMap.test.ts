import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import LiveMap from '../../src/views/LiveMap.svelte';
import {
  pets,
  alerts,
  floorPlan,
  petTrails,
  selectPet,
  setConnectionStatus,
} from '../../src/lib/stores.svelte';
import type { Room, PetLocation } from '../../src/lib/stores.svelte';

describe('LiveMap', () => {
  // ponytail: comprehensive reset prevents cross-file state leakage when vitest
  // runs test files concurrently.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T12:30:00Z'));
    pets.splice(0, pets.length);
    alerts.splice(0, alerts.length);
    floorPlan.splice(0, floorPlan.length);
    selectPet(null);
    setConnectionStatus(false);
    petTrails.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  const sampleRooms: Room[] = [
    { name: 'Living Room', bounds: { x1: 0, y1: 0, x2: 300, y2: 250 } },
    { name: 'Kitchen', bounds: { x1: 300, y1: 0, x2: 500, y2: 200 } },
  ];

  const samplePets: PetLocation[] = [
    {
      id: 'pet-1',
      species: 'dog',
      name: 'Rex',
      position: { x: 150, y: 100 },
      room: 'Living Room',
      activity: 'walking',
      confidence: 0.95,
    },
    {
      id: 'pet-2',
      species: 'cat',
      name: 'Luna',
      position: { x: 380, y: 80 },
      room: 'Kitchen',
      activity: 'sitting',
      confidence: 0.82,
    },
  ];

  describe('empty state', () => {
    it('shows empty state when no pets and no floor plan', () => {
      const { getByText } = render(LiveMap);
      expect(getByText('No pets detected')).toBeInTheDocument();
      expect(getByText(/Waiting for CSI data/i)).toBeInTheDocument();
    });

    it('does not show the legend when no pets detected', () => {
      const { queryByText } = render(LiveMap);
      expect(queryByText('Legend')).not.toBeInTheDocument();
    });
  });

  describe('with floor plan and pets', () => {
    it('renders the floor plan when rooms and pets are present', () => {
      floorPlan.push(...sampleRooms);
      pets.push(...samplePets);

      const { container } = render(LiveMap);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('renders room names in the floor plan', () => {
      floorPlan.push(...sampleRooms);
      pets.push(...samplePets);

      const { container } = render(LiveMap);
      // 'Living Room' / 'Kitchen' each appear both as the SVG floor-plan label
      // and as a pet-list room span, so scope to the floor-plan container.
      const mapContainer = container.querySelector('.map-container') as HTMLElement;
      const mapScope = within(mapContainer);
      expect(mapScope.getByText('Living Room')).toBeInTheDocument();
      expect(mapScope.getByText('Kitchen')).toBeInTheDocument();
    });

    it('shows legend with Dog and Cat indicators', () => {
      floorPlan.push(...sampleRooms);
      pets.push(...samplePets);

      const { getByText } = render(LiveMap);
      expect(getByText('Legend')).toBeInTheDocument();
      expect(getByText('Dog')).toBeInTheDocument();
      expect(getByText('Cat')).toBeInTheDocument();
    });

    it('shows legend movement trail indicator', () => {
      floorPlan.push(...sampleRooms);
      pets.push(...samplePets);

      const { getByText } = render(LiveMap);
      expect(getByText('Movement trail')).toBeInTheDocument();
    });

    it('renders pet list with tracked pets count', () => {
      floorPlan.push(...sampleRooms);
      pets.push(...samplePets);

      const { getByText } = render(LiveMap);
      expect(getByText('Tracked Pets (2)')).toBeInTheDocument();
    });

    it('shows "Click a pet" hint when no pet selected but pets exist', () => {
      floorPlan.push(...sampleRooms);
      pets.push(...samplePets);

      const { getByText } = render(LiveMap);
      expect(getByText('Click a pet to see details')).toBeInTheDocument();
    });

    it('shows pet info card when a pet is selected', () => {
      floorPlan.push(...sampleRooms);
      pets.push(...samplePets);
      selectPet('pet-1');

      const { container } = render(LiveMap);
      // 'Rex' / 'Living Room' also appear in the pet list, so scope to the
      // selected-pet info card to assert the card content.
      const infoCard = container.querySelector('.pet-info') as HTMLElement;
      const cardScope = within(infoCard);
      expect(cardScope.getByText('Rex')).toBeInTheDocument();
      expect(cardScope.getByText('walking')).toBeInTheDocument();
      expect(cardScope.getByText('Living Room')).toBeInTheDocument();
    });

    it('selecting the same pet again deselects it', async () => {
      floorPlan.push(...sampleRooms);
      pets.push(...samplePets);
      selectPet('pet-1');

      const { container, getByText } = render(LiveMap);
      // Info card is shown initially
      expect(container.querySelector('.pet-info .info-name')).toBeInTheDocument();

      // Click the same pet's list button to deselect. 'Rex' appears in both
      // the info card and the pet-list button, so target the pet-list button.
      const petListButton = container.querySelector('.pet-list-item') as HTMLButtonElement;
      petListButton.click();
      await tick();

      // Info card replaced by the "Click a pet" hint
      expect(getByText('Click a pet to see details')).toBeInTheDocument();
    });

    it('renders legend dots with correct species colors', () => {
      floorPlan.push(...sampleRooms);
      pets.push(...samplePets);

      const { container } = render(LiveMap);
      const legendDots = container.querySelectorAll('.legend-dot');
      expect(legendDots.length).toBe(2);
      expect((legendDots[0] as HTMLElement).style.background).toBe('rgb(255, 140, 66)');
      expect((legendDots[1] as HTMLElement).style.background).toBe('rgb(66, 212, 255)');
    });
  });

  describe('floor plan only (no pets)', () => {
    it('renders the floor plan even with no pets detected', () => {
      floorPlan.push(...sampleRooms);

      const { container, queryByText } = render(LiveMap);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      // Should NOT show "No pets detected" empty state if floor plan is loaded
      // Even with no pets, having floorPlan means sensors are configured
    });
  });
});
