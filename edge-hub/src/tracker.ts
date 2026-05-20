interface KalmanState {
  x: number; y: number; vx: number; vy: number;
  P: number[][];
}

const Q = [[1, 0, 0.1, 0], [0, 1, 0, 0.1], [0.1, 0, 0.05, 0], [0, 0.1, 0, 0.05]];
const R = [[4, 0], [0, 4]];
const H = [[1, 0, 0, 0], [0, 1, 0, 0]];
const DT = 0.1;
const F = [
  [1, 0, DT, 0],
  [0, 1, 0, DT],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

function matMul(a: number[][], b: number[][]): number[][] {
  const rows = a.length, cols = b[0].length, inner = b.length;
  const out: number[][] = new Array(rows).fill(0).map(() => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      for (let k = 0; k < inner; k++)
        out[i][j] += a[i][k] * b[k][j];
  return out;
}

function matTranspose(a: number[][]): number[][] {
  const rows = a.length, cols = a[0].length;
  const out: number[][] = new Array(cols).fill(0).map(() => new Array(rows).fill(0));
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      out[j][i] = a[i][j];
  return out;
}

function matAdd(a: number[][], b: number[][]): number[][] {
  return a.map((row, i) => row.map((v, j) => v + b[i][j]));
}

function matSub(a: number[][], b: number[][]): number[][] {
  return a.map((row, i) => row.map((v, j) => v - b[i][j]));
}

function matScale(a: number[][], s: number): number[][] {
  return a.map(row => row.map(v => v * s));
}

export interface TrackedPosition {
  x: number; y: number; vx: number; vy: number;
}

export class KalmanTracker {
  private pets: Map<string, KalmanState> = new Map();

  addPet(id: string): void {
    if (this.pets.has(id)) return;
    this.pets.set(id, {
      x: 0, y: 0, vx: 0, vy: 0,
      P: [[10, 0, 0, 0], [0, 10, 0, 0], [0, 0, 5, 0], [0, 0, 0, 5]],
    });
  }

  removePet(id: string): void {
    this.pets.delete(id);
  }

  predict(): void {
    for (const [id, state] of this.pets) {
      const xVec = [[state.x], [state.y], [state.vx], [state.vy]];
      const predicted = matMul(F, xVec);
      const P_pred = matAdd(matMul(matMul(F, state.P), matTranspose(F)), Q);
      this.pets.set(id, {
        x: predicted[0][0], y: predicted[1][0],
        vx: predicted[2][0], vy: predicted[3][0],
        P: P_pred,
      });
    }
  }

  update(id: string, measurement: { x: number; y: number }): void {
    const state = this.pets.get(id);
    if (!state) return;
    const z = [[measurement.x], [measurement.y]];
    const zPred = matMul(H, [[state.x], [state.y], [state.vx], [state.vy]]);
    const y = matSub(z, zPred);
    const S = matAdd(matMul(matMul(H, state.P), matTranspose(H)), R);
    const SInv = invert2x2(S);
    const K = matMul(state.P, matMul(matTranspose(H), SInv));
    const stateVec = [[state.x], [state.y], [state.vx], [state.vy]];
    const corrected = matAdd(stateVec, matMul(K, y));
    const I = identity4();
    const IK = matSub(I, matMul(K, H));
    const P_corr = matMul(IK, state.P);
    this.pets.set(id, {
      x: corrected[0][0], y: corrected[1][0],
      vx: corrected[2][0], vy: corrected[3][0],
      P: P_corr,
    });
  }

  getPosition(id: string): TrackedPosition | null {
    const state = this.pets.get(id);
    if (!state) return null;
    return { x: state.x, y: state.y, vx: state.vx, vy: state.vy };
  }

  getAllPositions(): Map<string, TrackedPosition> {
    const result = new Map<string, TrackedPosition>();
    for (const [id, state] of this.pets) {
      result.set(id, { x: state.x, y: state.y, vx: state.vx, vy: state.vy });
    }
    return result;
  }
}

function invert2x2(a: number[][]): number[][] {
  const det = a[0][0] * a[1][1] - a[0][1] * a[1][0];
  if (Math.abs(det) < 1e-10) return [[1, 0], [0, 1]];
  return [
    [a[1][1] / det, -a[0][1] / det],
    [-a[1][0] / det, a[0][0] / det],
  ];
}

function identity4(): number[][] {
  return [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
}
