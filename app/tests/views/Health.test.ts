import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/svelte';
import Health from '../../src/views/Health.svelte';
import { pets, healthTrends, selectedPetId, selectPet } from '../../src/lib/stores.svelte';
import type { PetLocation } from '../../src/lib/stores.svelte';

describe('Health', () => {
  afterEach(() => {
    cleanup();
    pets.splice(0, pets.length);
    healthTrends.splice(0, healthTrends.length);
    selectPet(null);
  });

  const samplePets: PetLocation[] = [
    {
      id: 'pet-1',
      species: 'dog',
      name: 'Rex',
      position: { x: 150, y: 100 },
      room: 'Living',
      activity: 'walking',
      confidence: 0.95,
    },
    {
      id: 'pet-2',
      species: 'cat',
      name: 'Luna',
      position: { x: 200, y: 150 },
      room: 'Bedroom',
      activity: 'sleeping',
      confidence: 0.88,
    },
  ];

  describe('empty state', () => {
    it('shows empty state when no pets tracked', () => {
      const { getByText } = render(Health);
      expect(getByText('No pets tracked')).toBeInTheDocument();
    });

    it('does not show stats when no pets', () => {
      const { queryByText } = render(Health);
      expect(queryByText('Today')).not.toBeInTheDocument();
    });
  });

  describe('pet selector', () => {
    it('renders pet selector when multiple pets exist', () => {
      pets.push(...samplePets);

      const { container } = render(Health);
      // Pet names also appear in the anomaly card when random dummy data
      // triggers an anomaly, so scope assertions to the selector.
      const selector = container.querySelector('.pet-selector') as HTMLElement;
      const selectorScope = within(selector);
      expect(selectorScope.getByText('Rex')).toBeInTheDocument();
      expect(selectorScope.getByText('Luna')).toBeInTheDocument();
    });

    it('highlights the active pet in selector', () => {
      pets.push(...samplePets);
      selectPet('pet-1');

      const { container } = render(Health);
      const activeChip = container.querySelector('.chip.active');
      expect(activeChip).toBeInTheDocument();
    });
  });

  describe('activity stats', () => {
    it('shows Today stat card', () => {
      pets.push(...samplePets);

      const { getByText } = render(Health);
      expect(getByText('Today')).toBeInTheDocument();
    });

    it('shows Week Avg stat card', () => {
      pets.push(...samplePets);

      const { getByText } = render(Health);
      expect(getByText('Week Avg')).toBeInTheDocument();
    });

    it('shows Change stat card', () => {
      pets.push(...samplePets);

      const { getByText } = render(Health);
      expect(getByText('Change')).toBeInTheDocument();
    });

    it('shows activity values in min format', () => {
      pets.push(...samplePets);

      const { getByText } = render(Health);
      // Today shows "Xmin active"
      const todayValue = document.querySelector('.stat-value');
      expect(todayValue?.textContent).toMatch(/min/);
    });
  });

  describe('14-day trend sparkline', () => {
    it('renders the 14-Day Activity Trend section', () => {
      pets.push(...samplePets);

      const { getByText } = render(Health);
      expect(getByText('14-Day Activity Trend')).toBeInTheDocument();
    });

    it('renders an ActivitySparkline component', () => {
      pets.push(...samplePets);

      const { container } = render(Health);
      // ActivitySparkline renders an SVG with polyline
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('7-day heatmap', () => {
    it('renders the 7-Day Activity Heatmap section', () => {
      pets.push(...samplePets);

      const { getByText } = render(Health);
      expect(getByText('7-Day Activity Heatmap')).toBeInTheDocument();
    });

    it('renders 7 day cells with weekday labels', () => {
      pets.push(...samplePets);

      const { container, getAllByText } = render(Health);
      // 7 weekday-initial labels render; 'T' (Tue/Thu) and 'S' (Sat/Sun) each
      // appear twice in the ['M','T','W','T','F','S','S'] label set, so use
      // getAllByText for those and assert the heatmap-label count.
      expect(getAllByText('T').length).toBe(2);
      expect(getAllByText('S').length).toBe(2);
      expect(container.querySelectorAll('.heatmap-label').length).toBe(7);
    });
  });

  describe('week comparison', () => {
    it('renders the Week Comparison section', () => {
      pets.push(...samplePets);

      const { getByText } = render(Health);
      expect(getByText('Week Comparison')).toBeInTheDocument();
    });

    it('shows Previous Week and Current Week labels', () => {
      pets.push(...samplePets);

      const { getByText } = render(Health);
      expect(getByText('Previous Week')).toBeInTheDocument();
      expect(getByText('Current Week')).toBeInTheDocument();
    });

    it('renders bar comparison with minute values', () => {
      pets.push(...samplePets);

      const { container } = render(Health);
      const barValues = container.querySelectorAll('.bar-val');
      expect(barValues.length).toBe(2);
      // Each should show a number followed by "min"
      barValues.forEach((el) => {
        expect(el.textContent).toMatch(/\d+ min/);
      });
    });
  });
});
