import type { MQTTBroker, CSIPacket } from './mqtt-broker.js';

export interface AggregatedFrame {
  timestamp: number;
  nodes: Record<string, CSIPacket>;
  combinedVector: Float32Array;
}

type FrameCallback = (frame: AggregatedFrame) => void;

const RING_SIZE = 128;
const WINDOW_TOLERANCE_MS = 50;

export class CSIAggregator {
  private broker: MQTTBroker;
  private nodeBuffers: Map<string, CSIPacket[]> = new Map();
  private frameCallback: FrameCallback | null = null;
  private packetCounter = 0;

  constructor(broker: MQTTBroker) {
    this.broker = broker;
    this.broker.on('csi', (pkt: CSIPacket) => this.handlePacket(pkt));
  }

  private handlePacket(pkt: CSIPacket): void {
    if (!this.nodeBuffers.has(pkt.nodeId)) {
      this.nodeBuffers.set(pkt.nodeId, []);
    }
    const buf = this.nodeBuffers.get(pkt.nodeId)!;
    buf.push(pkt);
    if (buf.length > RING_SIZE) buf.shift();
    this.packetCounter++;
    this.tryAggregate(pkt.timestamp);
  }

  private tryAggregate(ts: number): void {
    const nodeIds = Array.from(this.nodeBuffers.keys());
    if (nodeIds.length < 2) return;
    const nodes: Record<string, CSIPacket> = {};
    for (const nid of nodeIds) {
      const buf = this.nodeBuffers.get(nid)!;
      let closest: CSIPacket | null = null;
      let minDiff = Infinity;
      for (const p of buf) {
        const diff = Math.abs(p.timestamp - ts);
        if (diff < WINDOW_TOLERANCE_MS && diff < minDiff) {
          closest = p;
          minDiff = diff;
        }
      }
      if (closest) nodes[nid] = closest;
    }
    if (Object.keys(nodes).length < 2) return;
    const combined = this.buildCombined(nodes);
    const frame: AggregatedFrame = { timestamp: ts, nodes, combinedVector: combined };
    this.frameCallback?.(frame);
  }

  private buildCombined(nodes: Record<string, CSIPacket>): Float32Array {
    const chunks: Float32Array[] = [];
    for (const pkt of Object.values(nodes)) {
      chunks.push(new Float32Array([pkt.rssi, pkt.noise]));
      chunks.push(new Float32Array(pkt.amplitudes));
      chunks.push(new Float32Array(pkt.phases));
    }
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Float32Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  }

  onFrame(callback: FrameCallback): void {
    this.frameCallback = callback;
  }

  getWindowedData(windowSize: number): Float32Array[] {
    const all: Float32Array[] = [];
    for (const buf of this.nodeBuffers.values()) {
      const recent = buf.slice(-windowSize);
      for (const pkt of recent) {
        const f = new Float32Array(2 + pkt.amplitudes.length + pkt.phases.length);
        f[0] = pkt.rssi;
        f[1] = pkt.noise;
        f.set(new Float32Array(pkt.amplitudes), 2);
        f.set(new Float32Array(pkt.phases), 2 + pkt.amplitudes.length);
        all.push(f);
      }
    }
    return all.slice(-windowSize);
  }
}
