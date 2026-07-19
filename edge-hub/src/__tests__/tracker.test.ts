import { describe, it, expect } from 'vitest';
import { KalmanTracker } from '../tracker.js';

describe('KalmanTracker', () => {
  it('addPet creates a pet with zero position', () => {
    const tracker = new KalmanTracker();
    tracker.addPet('dog-1');
    const pos = tracker.getPosition('dog-1');
    expect(pos).toEqual({ x: 0, y: 0, vx: 0, vy: 0 });
  });

  it('update moves pet toward measurement', () => {
    const tracker = new KalmanTracker();
    tracker.addPet('cat-1');
    tracker.predict();
    tracker.update('cat-1', { x: 5, y: 3 });
    const pos = tracker.getPosition('cat-1');
    expect(pos).not.toBeNull();
    expect(pos!.x).toBeGreaterThan(0);
    expect(pos!.x).toBeLessThanOrEqual(5);
    expect(pos!.y).toBeGreaterThan(0);
    expect(pos!.y).toBeLessThanOrEqual(3);
  });

  it('update on unknown pet is a no-op', () => {
    const tracker = new KalmanTracker();
    tracker.update('ghost', { x: 10, y: 10 });
    expect(tracker.getPosition('ghost')).toBeNull();
  });

  it('removePet removes the pet', () => {
    const tracker = new KalmanTracker();
    tracker.addPet('dog-2');
    expect(tracker.getPosition('dog-2')).not.toBeNull();
    tracker.removePet('dog-2');
    expect(tracker.getPosition('dog-2')).toBeNull();
  });

  it('getAllPositions returns all tracked pets', () => {
    const tracker = new KalmanTracker();
    tracker.addPet('a');
    tracker.addPet('b');
    const all = tracker.getAllPositions();
    expect(all.size).toBe(2);
    expect(all.has('a')).toBe(true);
    expect(all.has('b')).toBe(true);
  });

  it('multiple predict-update cycles converge toward repeated measurement', () => {
    const tracker = new KalmanTracker();
    tracker.addPet('dog-3');
    for (let i = 0; i < 20; i++) {
      tracker.predict();
      tracker.update('dog-3', { x: 10, y: 5 });
    }
    const pos = tracker.getPosition('dog-3')!;
    expect(pos.x).toBeCloseTo(10, 0);
    expect(pos.y).toBeCloseTo(5, 0);
  });

  it('addPet is idempotent', () => {
    const tracker = new KalmanTracker();
    tracker.addPet('x');
    tracker.addPet('x');
    expect(tracker.getAllPositions().size).toBe(1);
  });
});
