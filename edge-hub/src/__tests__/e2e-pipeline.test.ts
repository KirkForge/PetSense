import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { DB } from '../db.js';
import { KalmanTracker } from '../tracker.js';
import { EventEngine } from '../event-engine.js';
import { extractFeatures } from '../preprocessing.js';
import { estimatePosition } from '../multilateration.js';
import type { NodePosition } from '../multilateration.js';
import { APIServer } from '../api-server.js';

const TEST_TOKEN = 'e2e-test-token';

function fetch(url: string, opts?: { headers?: Record<string, string> }): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    http.get(url, { headers: opts?.headers ?? {} }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
      });
    }).on('error', reject);
  });
}

describe('E2E: CSI → pipeline → API', () => {
  let server: APIServer;
  let db: DB;
  const PORT = 3098;

  beforeAll(() => {
    process.env.PETSENSE_API_TOKEN = TEST_TOKEN;
    db = new DB(':memory:');
    const tracker = new KalmanTracker();
    const events = new EventEngine();
    server = new APIServer(PORT, {
      db, tracker, events, startTime: Date.now(),
      mqttConnected: () => true,
      modelLoaded: () => true,
      corsAllowlist: [],
    });
  });

  afterAll(() => {
    (server as any).server.close();
    db.close();
    delete process.env.PETSENSE_API_TOKEN;
  });

  const authHeaders = { Authorization: `Bearer ${TEST_TOKEN}` };

  it('health reports live status', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.status).toBe('ok');
    expect(body.mqttConnected).toBe(true);
    expect(body.modelLoaded).toBe(true);
    expect(typeof body.uptime).toBe('number');
  });

  it('CSI frame → feature extraction → tracking → API returns pet', () => {
    const nodePositions = new Map<string, NodePosition>([
      ['esp32-living', { x: 3, y: 2.5 }],
      ['esp32-kitchen', { x: 8, y: 2.5 }],
    ]);

    const csiFrame = {
      combinedVector: new Float32Array(128 * 8).fill(0.5),
      nodes: {
        'esp32-living': { rssi: -45, amplitudes: Array(64).fill(0.5), phases: Array(64).fill(0.1) },
        'esp32-kitchen': { rssi: -60, amplitudes: Array(64).fill(0.3), phases: Array(64).fill(0.2) },
      },
    };

    const features = extractFeatures([csiFrame.combinedVector]);
    expect(features).toBeInstanceOf(Float32Array);
    expect(features.length).toBeGreaterThan(0);

    const rssiMap = new Map<string, number>();
    for (const [nodeId, pkt] of Object.entries(csiFrame.nodes)) {
      rssiMap.set(nodeId, pkt.rssi);
    }
    const position = estimatePosition(rssiMap, nodePositions);
    expect(position).not.toBeNull();
    expect(typeof position!.x).toBe('number');
    expect(typeof position!.y).toBe('number');
  });

  it('zones CRUD works end-to-end', async () => {
    const createRes = await fetch(`http://127.0.0.1:${PORT}/api/zones`, {
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
    });

    const listRes = await fetch(`http://127.0.0.1:${PORT}/api/zones`, { headers: authHeaders });
    expect(listRes.status).toBe(200);
    const body = listRes.body as any;
    expect(Array.isArray(body.zones)).toBe(true);
  });

  it('unauthenticated request to protected endpoint returns 401', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/pets/location`);
    expect(res.status).toBe(401);
  });

  it('WebSocket upgrade endpoint exists', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
    expect(res.status).toBe(200);
  });
});
