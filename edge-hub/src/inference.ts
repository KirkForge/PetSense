import * as ort from 'onnxruntime-node';

export interface InferenceResult {
  presence: boolean;
  species: 'human' | 'dog' | 'cat' | null;
  activity: string | null;
  location: string | null;
  confidence: number;
}

const SPECIES_LABELS = ['human', 'dog', 'cat'] as const;
const ACTIVITY_LABELS = ['walking', 'running', 'lying', 'playing', 'scratching', 'jumping'];
const ROOMS = ['living-room', 'kitchen', 'bedroom'];

export class InferenceEngine {
  private session: ort.InferenceSession | null = null;

  async loadModel(path: string): Promise<void> {
    this.session = await ort.InferenceSession.create(path);
    console.log(`[inference] model loaded: ${path}`);
  }

  async classify(features: Float32Array): Promise<InferenceResult> {
    if (!this.session) throw new Error('Model not loaded');

    // Model expects [batch, 128, 8] — 128 time steps, 8 PCA components per SPEC.md
    const tensor = new ort.Tensor('float32', new Float32Array(features), [1, 128, 8]);
    const feeds: Record<string, ort.Tensor> = {};
    const inputNames = this.session.inputNames;
    feeds[inputNames[0]] = tensor;

    const results = await this.session.run(feeds);
    const outputNames = this.session.outputNames;

    // Parse multi-head outputs
    let presence = false;
    let species: 'human' | 'dog' | 'cat' | null = null;
    let activity: string | null = null;
    let confidence = 0;

    for (const name of outputNames) {
      const data = results[name].data as Float32Array;
      if (name.includes('presence')) {
        presence = data[0] > 0.5;
        confidence = Math.max(confidence, Math.abs(data[0] - 0.5) * 2);
      } else if (name.includes('species')) {
        const idx = argmax(data, SPECIES_LABELS.length);
        species = SPECIES_LABELS[idx];
        confidence = Math.max(confidence, data[idx]);
      } else if (name.includes('activity')) {
        const idx = argmax(data, ACTIVITY_LABELS.length);
        activity = ACTIVITY_LABELS[idx];
        confidence = Math.max(confidence, data[idx]);
      } else if (name.includes('location') || name.includes('room')) {
        const idx = argmax(data, ROOMS.length);
        confidence = Math.max(confidence, data[idx]);
      }
    }

    return { presence, species, activity, location: null, confidence };
  }

  async classifyBatch(featureBatches: Float32Array[]): Promise<InferenceResult[]> {
    return Promise.all(featureBatches.map(f => this.classify(f)));
  }
}

function argmax(arr: Float32Array, length: number): number {
  let maxIdx = 0, maxVal = arr[0];
  for (let i = 1; i < Math.min(length, arr.length); i++) {
    if (arr[i] > maxVal) { maxVal = arr[i]; maxIdx = i; }
  }
  return maxIdx;
}
