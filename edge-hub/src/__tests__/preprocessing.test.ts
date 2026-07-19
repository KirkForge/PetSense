import { describe, it, expect } from 'vitest';
import { hampelFilter, normalizeAmplitude, phaseSanitize, pcaReduce, extractFeatures } from '../preprocessing.js';

describe('hampelFilter', () => {
  it('replaces outliers with median', () => {
    const data = [1, 1, 1, 100, 1, 1, 1];
    const result = hampelFilter(data, 3, 3);
    expect(result[3]).toBe(1);
  });

  it('leaves clean data unchanged', () => {
    const data = [1, 2, 3, 4, 5];
    const result = hampelFilter(data, 3, 3);
    expect(result).toEqual(data);
  });

  it('handles empty array', () => {
    expect(hampelFilter([], 3, 3)).toEqual([]);
  });
});

describe('normalizeAmplitude', () => {
  it('returns zero-mean unit-variance', () => {
    const result = normalizeAmplitude([10, 20, 30]);
    const mean = result.reduce((s, v) => s + v, 0) / result.length;
    expect(mean).toBeCloseTo(0, 10);
  });

  it('handles constant input', () => {
    const result = normalizeAmplitude([5, 5, 5]);
    expect(result).toEqual([0, 0, 0]);
  });
});

describe('phaseSanitize', () => {
  it('removes linear trend and wraps phase', () => {
    const phases = Array.from({ length: 50 }, (_, i) => i * 0.5);
    const result = phaseSanitize(phases);
    expect(result.length).toBe(50);
    // After detrending, result should be closer to zero
    const maxAbs = Math.max(...result.map(Math.abs));
    expect(maxAbs).toBeLessThan(Math.max(...phases.map(Math.abs)));
  });
});

describe('pcaReduce', () => {
  it('reduces dimensionality', () => {
    const matrix = Array.from({ length: 20 }, () =>
      Array.from({ length: 8 }, () => Math.random())
    );
    const result = pcaReduce(matrix, 3);
    expect(result.length).toBe(20);
    expect(result[0].length).toBe(3);
  });

  it('handles empty matrix', () => {
    expect(pcaReduce([], 3)).toEqual([]);
  });

  it('handles more components than dimensions', () => {
    const matrix = [[1, 2], [3, 4]];
    const result = pcaReduce(matrix, 5);
    expect(result[0].length).toBe(2);
  });
});

describe('extractFeatures', () => {
  it('returns non-empty features for a window', () => {
    const window = [
      new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]),
      new Float32Array([2, 3, 4, 5, 6, 7, 8, 9]),
      new Float32Array([3, 4, 5, 6, 7, 8, 9, 10]),
    ];
    const features = extractFeatures(window);
    expect(features.length).toBeGreaterThan(0);
  });

  it('returns empty for empty window', () => {
    expect(extractFeatures([]).length).toBe(0);
  });

  it('feature count is consistent for same-shaped input', () => {
    const w1 = [new Float32Array(8), new Float32Array(8)];
    const w2 = [new Float32Array(8), new Float32Array(8)];
    expect(extractFeatures(w1).length).toBe(extractFeatures(w2).length);
  });
});
