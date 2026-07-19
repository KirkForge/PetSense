import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEngine } from '../event-engine.js';

describe('EventEngine', () => {
  let engine: EventEngine;

  beforeEach(() => {
    engine = new EventEngine();
    vi.useFakeTimers();
  });

  it('triggers alert when pet enters a zone', () => {
    engine.addZone({
      name: 'kitchen',
      bounds: { x1: 0, y1: 0, x2: 5, y2: 5 },
      type: 'alert',
    });
    const alerts = engine.checkZones('dog-1', { x: 2, y: 2 });
    expect(alerts.length).toBe(1);
    expect(alerts[0].zone).toBe('kitchen');
    expect(alerts[0].petId).toBe('dog-1');
  });

  it('does not trigger when pet is outside zone', () => {
    engine.addZone({
      name: 'kitchen',
      bounds: { x1: 0, y1: 0, x2: 5, y2: 5 },
      type: 'alert',
    });
    const alerts = engine.checkZones('dog-1', { x: 10, y: 10 });
    expect(alerts.length).toBe(0);
  });

  it('throttle prevents repeated alerts within cooldown', () => {
    engine.addZone({
      name: 'door',
      bounds: { x1: 0, y1: 0, x2: 2, y2: 2 },
      type: 'info',
    });
    engine.checkZones('cat-1', { x: 1, y: 1 });
    const second = engine.checkZones('cat-1', { x: 1, y: 1 });
    expect(second.length).toBe(0);
  });

  it('throttle expires after cooldown period', () => {
    engine.addZone({
      name: 'door',
      bounds: { x1: 0, y1: 0, x2: 2, y2: 2 },
      type: 'info',
    });
    engine.checkZones('cat-1', { x: 1, y: 1 });
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    const after = engine.checkZones('cat-1', { x: 1, y: 1 });
    expect(after.length).toBe(1);
  });

  it('setZones replaces all zones', () => {
    engine.addZone({ name: 'a', bounds: { x1: 0, y1: 0, x2: 1, y2: 1 }, type: 'alert' });
    engine.setZones([{ name: 'b', bounds: { x1: 0, y1: 0, x2: 10, y2: 10 }, type: 'info' }]);
    const alerts = engine.checkZones('x', { x: 5, y: 5 });
    expect(alerts.length).toBe(1);
    expect(alerts[0].zone).toBe('b');
  });

  it('drainAlerts clears and returns alerts', () => {
    engine.addZone({ name: 'z', bounds: { x1: 0, y1: 0, x2: 10, y2: 10 }, type: 'alert' });
    engine.checkZones('p', { x: 5, y: 5 });
    const drained = engine.drainAlerts();
    expect(drained.length).toBe(1);
    expect(engine.getAlerts().length).toBe(0);
  });

  it('multiple zones trigger independently', () => {
    engine.addZone({ name: 'a', bounds: { x1: 0, y1: 0, x2: 5, y2: 5 }, type: 'alert' });
    engine.addZone({ name: 'b', bounds: { x1: 6, y1: 6, x2: 10, y2: 10 }, type: 'info' });
    const alertsA = engine.checkZones('d', { x: 2, y: 2 });
    const alertsB = engine.checkZones('d', { x: 8, y: 8 });
    expect(alertsA.length).toBe(1);
    expect(alertsB.length).toBe(1);
    expect(alertsA[0].zone).toBe('a');
    expect(alertsB[0].zone).toBe('b');
  });
});
