export function hampelFilter(data: number[], window: number, threshold: number): number[] {
  const out = [...data];
  const half = Math.floor(window / 2);
  for (let i = half; i < data.length - half; i++) {
    const slice = data.slice(i - half, i + half + 1);
    slice.sort((a, b) => a - b);
    const median = slice[half];
    const deviations = slice.map(v => Math.abs(v - median));
    deviations.sort((a, b) => a - b);
    const mad = 1.4826 * deviations[half];
    if (Math.abs(data[i] - median) > threshold * mad) {
      out[i] = median;
    }
  }
  return out;
}

export function normalizeAmplitude(amplitudes: number[]): number[] {
  const n = amplitudes.length;
  const mean = amplitudes.reduce((s, v) => s + v, 0) / n;
  const variance = amplitudes.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance) || 1;
  return amplitudes.map(v => (v - mean) / std);
}

export function phaseSanitize(phases: number[]): number[] {
  const n = phases.length;
  const xs = Array.from({ length: n }, (_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = phases.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * phases[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const detrended = phases.map((p, i) => p - (slope * i + intercept));
  let offset = 0;
  return detrended.map((p, i) => {
    if (i > 0 && Math.abs(detrended[i] - detrended[i - 1]) > Math.PI) {
      offset += detrended[i] > detrended[i - 1] ? -2 * Math.PI : 2 * Math.PI;
    }
    return p + offset;
  });
}

function powerIteration(A: number[][], dim: number): { vec: number[]; val: number } {
  let v = new Array(dim).fill(0).map(() => Math.random());
  let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  v = v.map(x => x / norm);
  for (let iter = 0; iter < 50; iter++) {
    const Av = new Array(dim).fill(0);
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        Av[i] += A[i][j] * v[j];
      }
    }
    const nrm = Math.sqrt(Av.reduce((s, x) => s + x * x, 0));
    const nextV = Av.map(x => x / nrm);
    let diff = 0;
    for (let i = 0; i < dim; i++) diff += Math.abs(nextV[i] - v[i]);
    v = nextV;
    if (diff < 1e-6) break;
  }
  const Av = new Array(dim).fill(0);
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) Av[i] += A[i][j] * v[j];
  }
  const val = v.reduce((s, vi, i) => s + vi * Av[i], 0);
  return { vec: v, val };
}

export function pcaReduce(matrix: number[][], components: number): number[][] {
  const m = matrix.length;
  if (m === 0) return matrix;
  const dim = matrix[0].length;
  const mean = new Array(dim).fill(0);
  for (const row of matrix) for (let j = 0; j < dim; j++) mean[j] += row[j];
  for (let j = 0; j < dim; j++) mean[j] /= m;
  const centered = matrix.map(row => row.map((v, j) => v - mean[j]));
  const cov: number[][] = new Array(dim).fill(0).map(() => new Array(dim).fill(0));
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      let s = 0;
      for (let k = 0; k < m; k++) s += centered[k][i] * centered[k][j];
      cov[i][j] = s / (m - 1);
    }
  }
  const eigvecs: number[][] = [];
  let working = cov.map(row => [...row]);
  for (let c = 0; c < Math.min(components, dim); c++) {
    const { vec, val } = powerIteration(working, dim);
    eigvecs.push(vec);
    if (c >= components - 1) break;
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        working[i][j] -= val * vec[i] * vec[j];
      }
    }
  }
  return centered.map(row => {
    return eigvecs.map(ev => row.reduce((s, v, j) => s + v * ev[j], 0));
  });
}

function computeDFT(signal: Float32Array): { real: Float32Array; imag: Float32Array } {
  const N = signal.length;
  const real = new Float32Array(N);
  const imag = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      re += signal[n] * Math.cos(angle);
      im -= signal[n] * Math.sin(angle);
    }
    real[k] = re;
    imag[k] = im;
  }
  return { real, imag };
}

export function extractFeatures(window: Float32Array[]): Float32Array {
  const nFrames = window.length;
  if (nFrames === 0) return new Float32Array(0);
  const dim = window[0].length;
  const features: number[] = [];
  for (let ch = 0; ch < Math.min(dim, 8); ch++) {
    const series = window.map(f => f[ch]);
    const mean = series.reduce((a, b) => a + b, 0) / nFrames;
    const std = Math.sqrt(series.reduce((a, v) => a + (v - mean) ** 2, 0) / nFrames);
    const rms = Math.sqrt(series.reduce((a, v) => a + v * v, 0) / nFrames);
    const peak = Math.max(...series.map(Math.abs));
    let zcr = 0;
    for (let i = 1; i < nFrames; i++) {
      if ((series[i] >= 0) !== (series[i - 1] >= 0)) zcr++;
    }
    zcr /= nFrames;

    features.push(mean, std, rms, peak, zcr);

    const sig = new Float32Array(series);
    const dft = computeDFT(sig);
    const mag = new Float32Array(nFrames);
    let sumMag = 0;
    for (let k = 1; k < Math.floor(nFrames / 2); k++) {
      mag[k] = Math.sqrt(dft.real[k] ** 2 + dft.imag[k] ** 2);
      sumMag += mag[k];
    }
    if (sumMag > 0) {
      let centroid = 0;
      for (let k = 1; k < Math.floor(nFrames / 2); k++) {
        centroid += (k * mag[k]) / sumMag;
      }
      features.push(centroid / nFrames);
      let bw = 0;
      for (let k = 1; k < Math.floor(nFrames / 2); k++) {
        const diff = k / nFrames - centroid / nFrames;
        bw += (diff * diff * mag[k]) / sumMag;
      }
      features.push(Math.sqrt(bw));
      let entropy = 0;
      for (let k = 1; k < Math.floor(nFrames / 2); k++) {
        const p = mag[k] / sumMag;
        if (p > 1e-10) entropy -= p * Math.log2(p);
      }
      features.push(entropy);
    } else {
      features.push(0, 0, 0);
    }
  }

  // Correlation matrix upper-triangle
  const corrChannels = Math.min(dim, 4);
  for (let i = 0; i < corrChannels; i++) {
    for (let j = i + 1; j < corrChannels; j++) {
      const a1 = window.map(f => f[i]);
      const a2 = window.map(f => f[j]);
      const m1 = a1.reduce((s, v) => s + v, 0) / nFrames;
      const m2 = a2.reduce((s, v) => s + v, 0) / nFrames;
      let cov = 0, v1 = 0, v2 = 0;
      for (let k = 0; k < nFrames; k++) {
        const d1 = a1[k] - m1;
        const d2 = a2[k] - m2;
        cov += d1 * d2;
        v1 += d1 * d1;
        v2 += d2 * d2;
      }
      const denom = Math.sqrt(v1 * v2);
      features.push(denom > 1e-10 ? cov / denom : 0);
    }
  }

  return new Float32Array(features);
}
