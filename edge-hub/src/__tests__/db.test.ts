import { describe, it, expect, afterEach } from 'vitest';
import { DB } from '../db.js';

describe('DB', () => {
  let db: DB;

  afterEach(() => {
    db?.close();
  });

  it('insert and retrieve positions', () => {
    db = new DB(':memory:');
    db.insertPosition({ pet_id: 'dog-1', x: 5, y: 3, room: 'living', timestamp: 1000 });
    const positions = db.getRecentPositions('dog-1');
    expect(positions.length).toBe(1);
    expect(positions[0].pet_id).toBe('dog-1');
    expect(positions[0].x).toBe(5);
  });

  it('insert and retrieve events', () => {
    db = new DB(':memory:');
    db.insertEvent({ pet_id: 'cat-1', type: 'zone', message: 'entered kitchen', timestamp: 2000 });
    const events = db.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('zone');
  });

  it('upsertZone and getZones', () => {
    db = new DB(':memory:');
    db.upsertZone({ id: 'z1', name: 'Kitchen', bounds: '{"x1":0,"y1":0,"x2":5,"y2":5}', type: 'alert' });
    const zones = db.getZones();
    expect(zones.length).toBe(1);
    expect(zones[0].name).toBe('Kitchen');
  });

  it('deleteZone removes zone', () => {
    db = new DB(':memory:');
    db.upsertZone({ id: 'z1', name: 'Test', bounds: '{}', type: 'info' });
    db.deleteZone('z1');
    expect(db.getZones().length).toBe(0);
  });

  it('getRecentPositions respects limit', () => {
    db = new DB(':memory:');
    for (let i = 0; i < 10; i++) {
      db.insertPosition({ pet_id: 'x', x: i, y: 0, room: 'r', timestamp: i });
    }
    expect(db.getRecentPositions('x', 3).length).toBe(3);
  });
});
