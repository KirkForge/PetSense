import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { APIServer } from '../api-server.js';
import { DB } from '../db.js';
import { KalmanTracker } from '../tracker.js';
import { EventEngine } from '../event-engine.js';

const TEST_TOKEN = 'test-bearer-token-123';

function fetch(url: string, opts?: { headers?: Record<string, string> }): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const reqOpts = {
      headers: opts?.headers ?? {},
    };
    http.get(url, reqOpts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
      });
    }).on('error', reject);
  });
}

describe('APIServer', () => {
  let server: APIServer;
  const PORT = 3099;

  beforeAll(() => {
    process.env.PETSENSE_API_TOKEN = TEST_TOKEN;
    const db = new DB(':memory:');
    const tracker = new KalmanTracker();
    const events = new EventEngine();
    server = new APIServer(PORT, {
      db, tracker, events, startTime: Date.now(),
      mqttConnected: () => true,
      modelLoaded: () => false,
      corsAllowlist: [],
    });
  });

  afterAll(() => {
    (server as any).server.close();
    delete process.env.PETSENSE_API_TOKEN;
  });

  const authHeaders = { Authorization: `Bearer ${TEST_TOKEN}` };

  it('GET /api/health returns ok with live status (no auth needed)', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.status).toBe('ok');
    expect(body.mqttConnected).toBe(true);
    expect(body.modelLoaded).toBe(false);
    expect(typeof body.uptime).toBe('number');
  });

  it('GET /api/pets/location returns empty array with auth', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/pets/location`, { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.pets).toEqual([]);
  });

  it('GET /api/events returns empty structure with auth', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/events`, { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.alerts).toEqual([]);
    expect(body.events).toEqual([]);
  });

  it('GET /api/zones returns empty array with auth', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/zones`, { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.zones).toEqual([]);
  });

  it('unauthenticated request returns 401', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/pets/location`);
    expect(res.status).toBe(401);
  });

  it('unknown route returns 404 (authenticated)', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/nonexistent`, { headers: authHeaders });
    expect(res.status).toBe(404);
  });
});
