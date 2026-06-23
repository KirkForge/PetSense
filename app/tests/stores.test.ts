import { describe, it, expect, beforeEach } from 'vitest';

// We need to mock $lib/api BEFORE importing stores, because stores
// calls onPetLocation/onAlert/onConnect at module load time.

// Since stores.svelte.ts is a real module with rune state ($state),
// and Vitest's vi.mock with factory requires explicit exports,
// we import stores directly and manage its module-level state.

// The api module will be auto-loaded when stores is imported.
// We mock it first via vi.hoisted + vi.mock to prevent WebSocket setup.

const { apiMocks } = vi.hoisted(() => ({
  apiMocks: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    onPetLocation: vi.fn((_cb: unknown) => {}),
    onAlert: vi.fn((_cb: unknown) => {}),
    onConnect: vi.fn((_cb: unknown) => {}),
    getConnectionStatus: vi.fn(() => false),
  },
}));

vi.mock('$lib/api', () => apiMocks);

// Now import stores
import {
  pets,
  alerts,
  selectedPetId,
  floorPlan,
  isConnected,
  petTrails,
  selectPet,
  addAlert,
  updatePetLocation,
  loadFloorPlan,
  dismissAlert,
  getPetTrail,
  setConnectionStatus,
  getConnectionStatus,
} from '../src/lib/stores.svelte';
import type { PetLocation, Alert, Room } from '../src/lib/stores.svelte';

describe('stores', () => {
  // Reset all module-level state before each test
  beforeEach(() => {
    // Clear reactive arrays
    pets.splice(0, pets.length);
    alerts.splice(0, alerts.length);
    floorPlan.splice(0, floorPlan.length);
    // Clear selected pet
    selectPet(null);
    // Reset connection status
    setConnectionStatus(false);
    // Clear trails
    petTrails.clear();
  });

  describe('pets state', () => {
    it('initializes as empty array', () => {
      expect(pets.length).toBe(0);
    });

    it('updatePetLocation adds a new pet', () => {
      const pet: PetLocation = {
        id: 'pet-1',
        species: 'dog',
        name: 'Rex',
        position: { x: 100, y: 200 },
        room: 'Living',
        activity: 'walking',
        confidence: 0.95,
      };

      updatePetLocation(pet);

      expect(pets.length).toBe(1);
      expect(pets[0].id).toBe('pet-1');
      expect(pets[0].species).toBe('dog');
      expect(pets[0].name).toBe('Rex');
    });

    it('updatePetLocation updates existing pet by id', () => {
      const pet: PetLocation = {
        id: 'pet-1',
        species: 'dog',
        name: 'Rex',
        position: { x: 100, y: 200 },
        room: 'Living',
        activity: 'walking',
        confidence: 0.95,
      };

      updatePetLocation(pet);

      // Update same pet with new position and activity
      updatePetLocation({
        id: 'pet-1',
        species: 'dog',
        name: 'Rex',
        position: { x: 300, y: 400 },
        room: 'Kitchen',
        activity: 'running',
        confidence: 0.91,
      });

      expect(pets.length).toBe(1);
      expect(pets[0].position.x).toBe(300);
      expect(pets[0].position.y).toBe(400);
      expect(pets[0].room).toBe('Kitchen');
      expect(pets[0].activity).toBe('running');
    });

    it('tracks multiple distinct pets', () => {
      updatePetLocation({
        id: 'dog-1', species: 'dog',
        position: { x: 1, y: 1 }, room: 'A', activity: 'walking', confidence: 0.9,
      });
      updatePetLocation({
        id: 'cat-1', species: 'cat',
        position: { x: 2, y: 2 }, room: 'B', activity: 'sleeping', confidence: 0.85,
      });

      expect(pets.length).toBe(2);
      expect(pets.map((p) => p.species)).toContain('dog');
      expect(pets.map((p) => p.species)).toContain('cat');
    });
  });

  describe('selectedPetId', () => {
    it('starts as null', () => {
      expect(selectedPetId).toBeNull();
    });

    it('selectPet sets the selected pet ID', () => {
      selectPet('pet-1');
      expect(selectedPetId).toBe('pet-1');
    });

    it('selectPet with null clears selection', () => {
      selectPet('pet-1');
      expect(selectedPetId).toBe('pet-1');

      selectPet(null);
      expect(selectedPetId).toBeNull();
    });

    it('selectPet toggles between pets', () => {
      selectPet('pet-a');
      expect(selectedPetId).toBe('pet-a');

      selectPet('pet-b');
      expect(selectedPetId).toBe('pet-b');
    });
  });

  describe('alerts', () => {
    it('starts as empty array', () => {
      expect(alerts.length).toBe(0);
    });

    it('addAlert appends alert to front of array', () => {
      const alert: Alert = {
        id: 'a1',
        type: 'zone_enter',
        message: 'Pet entered Kitchen',
        timestamp: Date.now(),
      };

      addAlert(alert);
      expect(alerts.length).toBe(1);
      expect(alerts[0].id).toBe('a1');
      expect(alerts[0].message).toBe('Pet entered Kitchen');
    });

    it('new alerts appear at position 0 (unshift)', () => {
      addAlert({ id: 'a1', type: 'zone', message: 'First', timestamp: 100 });
      addAlert({ id: 'a2', type: 'zone', message: 'Second', timestamp: 200 });

      expect(alerts.length).toBe(2);
      expect(alerts[0].id).toBe('a2'); // newest first
      expect(alerts[1].id).toBe('a1');
    });

    it('caps at 100 alerts (oldest removed)', () => {
      for (let i = 0; i < 150; i++) {
        addAlert({
          id: `alert-${i}`,
          type: 'test',
          message: `Alert ${i}`,
          timestamp: i,
        });
      }

      expect(alerts.length).toBe(100);
    });

    it('dismissAlert removes alert by id', () => {
      addAlert({ id: 'a1', type: 'zone', message: 'First', timestamp: 100 });
      addAlert({ id: 'a2', type: 'zone', message: 'Second', timestamp: 200 });
      expect(alerts.length).toBe(2);

      dismissAlert('a1');
      expect(alerts.length).toBe(1);
      expect(alerts[0].id).toBe('a2');

      dismissAlert('a2');
      expect(alerts.length).toBe(0);
    });

    it('dismissAlert is safe when id not found', () => {
      addAlert({ id: 'a1', type: 'zone', message: 'First', timestamp: 100 });
      expect(() => dismissAlert('nonexistent')).not.toThrow();
      expect(alerts.length).toBe(1);
    });
  });

  describe('floorPlan', () => {
    it('starts as empty array', () => {
      expect(floorPlan.length).toBe(0);
    });

    it('loadFloorPlan sets rooms', () => {
      const rooms: Room[] = [
        { name: 'Living', bounds: { x1: 0, y1: 0, x2: 200, y2: 200 } },
        { name: 'Kitchen', bounds: { x1: 200, y1: 0, x2: 400, y2: 200 } },
      ];

      loadFloorPlan(rooms);
      expect(floorPlan.length).toBe(2);
      expect(floorPlan[0].name).toBe('Living');
      expect(floorPlan[1].name).toBe('Kitchen');
    });

    it('loadFloorPlan replaces existing rooms', () => {
      const r1: Room[] = [{ name: 'R1', bounds: { x1: 0, y1: 0, x2: 1, y2: 1 } }];
      const r2: Room[] = [{ name: 'R2', bounds: { x1: 0, y1: 0, x2: 1, y2: 1 } }];

      loadFloorPlan(r1);
      expect(floorPlan.length).toBe(1);
      expect(floorPlan[0].name).toBe('R1');

      loadFloorPlan(r2);
      expect(floorPlan.length).toBe(1);
      expect(floorPlan[0].name).toBe('R2');
    });
  });

  describe('isConnected', () => {
    it('starts as false', () => {
      expect(getConnectionStatus()).toBe(false);
    });

    it('can be manually toggled', () => {
      setConnectionStatus(true);
      expect(getConnectionStatus()).toBe(true);

      setConnectionStatus(false);
      expect(getConnectionStatus()).toBe(false);
    });
  });

  describe('pet trails', () => {
    it('getPetTrail returns empty for unknown pet', () => {
      expect(getPetTrail('nonexistent')).toEqual([]);
    });

    it('updatePetLocation appends to trail', () => {
      updatePetLocation({
        id: 'pet-1', species: 'dog',
        position: { x: 10, y: 20 }, room: 'A', activity: 'walking', confidence: 0.9,
      });

      const trail = getPetTrail('pet-1');
      expect(trail.length).toBe(1);
      expect(trail[0]).toEqual({ x: 10, y: 20 });
    });

    it('trail accumulates up to 20 positions then shifts', () => {
      for (let i = 0; i < 25; i++) {
        updatePetLocation({
          id: 'pet-1', species: 'dog',
          position: { x: i, y: i * 2 }, room: 'A', activity: 'walking', confidence: 0.9,
        });
      }

      const trail = getPetTrail('pet-1');
      expect(trail.length).toBe(20);
      // First position (i=0) should be gone, earliest now is i=5
      expect(trail[0].x).toBe(5);
      // Last position is i=24
      expect(trail[19].x).toBe(24);
    });

    it('isolates trails between pets', () => {
      updatePetLocation({
        id: 'pet-a', species: 'dog',
        position: { x: 1, y: 1 }, room: 'A', activity: 'walking', confidence: 0.9,
      });
      updatePetLocation({
        id: 'pet-b', species: 'cat',
        position: { x: 99, y: 99 }, room: 'B', activity: 'sleeping', confidence: 0.8,
      });

      const trailA = getPetTrail('pet-a');
      const trailB = getPetTrail('pet-b');

      expect(trailA.length).toBe(1);
      expect(trailA[0]).toEqual({ x: 1, y: 1 });
      expect(trailB.length).toBe(1);
      expect(trailB[0]).toEqual({ x: 99, y: 99 });
    });
  });
});
