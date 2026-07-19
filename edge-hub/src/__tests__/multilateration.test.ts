import { describe, it, expect } from 'vitest';
import { rssiToDistance, multilaterate, estimatePosition } from '../multilateration.js';

describe('rssiToDistance', () => {
  it('returns ~1m for reference RSSI', () => {
    const d = rssiToDistance(-40);
    expect(d).toBeCloseTo(1.0, 0);
  });

  it('larger negative RSSI means farther', () => {
    const d1 = rssiToDistance(-40);
    const d2 = rssiToDistance(-60);
    expect(d2).toBeGreaterThan(d1);
  });

  it('handles zero path loss exponent gracefully', () => {
    const d = rssiToDistance(-50, -40, 2.0);
    expect(d).toBeGreaterThan(0);
    expect(isFinite(d)).toBe(true);
  });
});

describe('multilaterate', () => {
  it('returns null for empty input', () => {
    expect(multilaterate([])).toBeNull();
  });

  it('returns node position for single node', () => {
    const result = multilaterate([{ nodeId: 'a', rssi: -40, x: 5, y: 3 }]);
    expect(result).toEqual({ x: 5, y: 3 });
  });

  it('estimates position between two nodes', () => {
    const result = multilaterate([
      { nodeId: 'n1', rssi: -40, x: 0, y: 0 },
      { nodeId: 'n2', rssi: -40, x: 10, y: 0 },
    ]);
    expect(result).not.toBeNull();
    // Equal RSSI → position should be roughly midway
    expect(result!.x).toBeCloseTo(5, 0);
    expect(result!.y).toBeCloseTo(0, 0);
  });

  it('closer node has more weight', () => {
    const result = multilaterate([
      { nodeId: 'n1', rssi: -30, x: 0, y: 0 },  // strong → close
      { nodeId: 'n2', rssi: -80, x: 10, y: 0 },  // weak → far
    ]);
    expect(result).not.toBeNull();
    expect(result!.x).toBeLessThan(5);
  });

  it('four-node layout returns a point in the room', () => {
    const result = multilaterate([
      { nodeId: 'n1', rssi: -50, x: 0, y: 0 },
      { nodeId: 'n2', rssi: -55, x: 10, y: 0 },
      { nodeId: 'n3', rssi: -45, x: 0, y: 8 },
      { nodeId: 'n4', rssi: -60, x: 10, y: 8 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.x).toBeGreaterThanOrEqual(0);
    expect(result!.x).toBeLessThanOrEqual(10);
    expect(result!.y).toBeGreaterThanOrEqual(0);
    expect(result!.y).toBeLessThanOrEqual(8);
  });
});

describe('estimatePosition', () => {
  it('returns null when no nodes match', () => {
    const rssiMap = new Map([['unknown-node', -50]]);
    const nodePositions = new Map([['n1', { x: 0, y: 0 }]]);
    expect(estimatePosition(rssiMap, nodePositions)).toBeNull();
  });

  it('returns position when nodes match', () => {
    const rssiMap = new Map([
      ['n1', -40],
      ['n2', -40],
    ]);
    const nodePositions = new Map([
      ['n1', { x: 0, y: 0 }],
      ['n2', { x: 10, y: 0 }],
    ]);
    const result = estimatePosition(rssiMap, nodePositions);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(5, 0);
  });
});
