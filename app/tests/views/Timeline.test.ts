import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import Timeline from '../../src/views/Timeline.svelte';
import { pets } from '../../src/lib/stores.svelte';
import type { PetLocation } from '../../src/lib/stores.svelte';

describe('Timeline', () => {
  afterEach(() => {
    cleanup();
    pets.splice(0, pets.length);
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
    {
      id: 'pet-3',
      species: 'dog',
      name: 'Max',
      position: { x: 300, y: 200 },
      room: 'Kitchen',
      activity: 'running',
      confidence: 0.91,
    },
  ];

  describe('empty state', () => {
    it('shows empty state when no pets detected', () => {
      const { getByText } = render(Timeline);
      expect(getByText('No activity yet')).toBeInTheDocument();
      expect(getByText(/Activity timeline will appear here/i)).toBeInTheDocument();
    });

    it('does not render filter chips when empty', () => {
      const { queryByText } = render(Timeline);
      // "All" chip should not exist when no pets
      expect(queryByText('All')).not.toBeInTheDocument();
    });
  });

  describe('with activity data', () => {
    it('renders filter chips (All, Dog, Cat, Walking, Running, Playing, Resting)', () => {
      pets.push(...samplePets);

      const { getByText } = render(Timeline);
      expect(getByText('All')).toBeInTheDocument();
      expect(getByText('Dog')).toBeInTheDocument();
      expect(getByText('Cat')).toBeInTheDocument();
      expect(getByText('Walking')).toBeInTheDocument();
      expect(getByText('Running')).toBeInTheDocument();
      expect(getByText('Playing')).toBeInTheDocument();
      expect(getByText('Resting')).toBeInTheDocument();
    });

    it('renders 24 hour markers on the timeline', () => {
      pets.push(...samplePets);

      const { getByText } = render(Timeline);
      // Check a few hour labels exist
      expect(getByText('12AM')).toBeInTheDocument();
      expect(getByText('12PM')).toBeInTheDocument();
    });

    it('renders activity bars for each pet', () => {
      pets.push(...samplePets);

      const { container } = render(Timeline);
      const activityBars = container.querySelectorAll('.activity-bar');
      expect(activityBars.length).toBe(samplePets.length);
    });

    it('shows pet names in activity bars', () => {
      pets.push(...samplePets);

      const { getByText } = render(Timeline);
      expect(getByText('Rex')).toBeInTheDocument();
      expect(getByText('Luna')).toBeInTheDocument();
      expect(getByText('Max')).toBeInTheDocument();
    });

    it('shows pets summary with activity status', () => {
      pets.push(...samplePets);

      const { getByText } = render(Timeline);
      expect(getByText('walking')).toBeInTheDocument();
      expect(getByText('sleeping')).toBeInTheDocument();
      expect(getByText('running')).toBeInTheDocument();
    });
  });

  describe('filtering', () => {
    it('filtering by Dog shows only dog entries', async () => {
      pets.push(...samplePets);

      const { container, getByText } = render(Timeline);

      // Click Dog filter chip
      getByText('Dog').click();
      await tick();

      const activityBars = container.querySelectorAll('.activity-bar');
      // Only Rex and Max are dogs
      expect(activityBars.length).toBe(2);
    });

    it('filtering by Cat shows only cat entries', async () => {
      pets.push(...samplePets);

      const { container, getByText } = render(Timeline);

      getByText('Cat').click();
      await tick();

      const activityBars = container.querySelectorAll('.activity-bar');
      expect(activityBars.length).toBe(1);
    });

    it('filtering by Walking shows only walking entries', async () => {
      pets.push(...samplePets);

      const { container, getByText } = render(Timeline);

      getByText('Walking').click();
      await tick();

      const activityBars = container.querySelectorAll('.activity-bar');
      expect(activityBars.length).toBe(1);
    });

    it('returns to All filter', async () => {
      pets.push(...samplePets);

      const { container, getByText } = render(Timeline);

      // Filter by cat first
      getByText('Cat').click();
      await tick();
      let bars = container.querySelectorAll('.activity-bar');
      expect(bars.length).toBe(1);

      // Go back to All
      getByText('All').click();
      await tick();
      bars = container.querySelectorAll('.activity-bar');
      expect(bars.length).toBe(3);
    });
  });

  describe('detail popup', () => {
    it('clicking an activity bar shows detail popup', async () => {
      pets.push(...samplePets);

      const { container, getByText, queryByText } = render(Timeline);

      // No detail popup initially
      expect(queryByText(/min/)).not.toBeInTheDocument();

      // Click the first activity bar
      const bar = container.querySelector('.activity-bar') as HTMLElement;
      bar.click();
      await tick();

      expect(getByText(/min/)).toBeInTheDocument();
      expect(getByText('Confidence')).toBeInTheDocument();
    });

    it('detail popup shows activity, time, duration, and confidence', async () => {
      pets.push(...samplePets);

      const { container, getByText } = render(Timeline);

      const bar = container.querySelector('.activity-bar') as HTMLElement;
      bar.click();
      await tick();

      expect(getByText('Activity')).toBeInTheDocument();
      expect(getByText('Time')).toBeInTheDocument();
      expect(getByText('Duration')).toBeInTheDocument();
      expect(getByText('Confidence')).toBeInTheDocument();
    });

    it('can close detail popup', async () => {
      pets.push(...samplePets);

      const { container, queryByText } = render(Timeline);

      const bar = container.querySelector('.activity-bar') as HTMLElement;
      bar.click();
      await tick();

      expect(queryByText('Confidence')).toBeInTheDocument();

      // Click the close button
      const closeBtn = container.querySelector('.close-btn') as HTMLElement;
      closeBtn.click();
      await tick();

      expect(queryByText('Confidence')).not.toBeInTheDocument();
    });
  });
});
