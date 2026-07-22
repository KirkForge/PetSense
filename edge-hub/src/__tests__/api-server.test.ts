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

function post(url: string, body: unknown, headers: Record<string, string> = {}): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function del(url: string, body: unknown, headers: Record<string, string> = {}): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
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

  it('POST /api/zones with valid zone returns 200', async () => {
    const res = await post(`http://127.0.0.1:${PORT}/api/zones`, {
      id: 'kitchen-alert',
      name: 'Kitchen Alert',
      bounds: { x1: 6, y1: 0, x2: 10, y2: 5 },
      type: 'alert',
    }, authHeaders);
    expect(res.status).toBe(200);
    expect((res.body as any).ok).toBe(true);

    const list = await fetch(`http://127.0.0.1:${PORT}/api/zones`, { headers: authHeaders });
    expect(list.status).toBe(200);
    const zones = (list.body as any).zones;
    expect(zones.length).toBeGreaterThanOrEqual(1);
    expect(zones[0].id).toBe('kitchen-alert');
    expect(zones[0].type).toBe('alert');
  });

  it('POST /api/zones with missing name returns 400', async () => {
    const res = await post(`http://127.0.0.1:${PORT}/api/zones`, {
      id: 'z1',
      name: '',
      bounds: { x1: 0, y1: 0, x2: 5, y2: 5 },
      type: 'alert',
    }, authHeaders);
    expect(res.status).toBe(400);
    expect((res.body as any).error).toContain('name');
  });

  it('POST /api/zones with numeric id returns 400', async () => {
    const res = await post(`http://127.0.0.1:${PORT}/api/zones`, {
      id: 123,
      name: 'test',
      bounds: { x1: 0, y1: 0, x2: 5, y2: 5 },
      type: 'safe',
    }, authHeaders);
    expect(res.status).toBe(400);
    expect((res.body as any).error).toContain('id');
  });

  it('POST /api/zones with bounds as string returns 400', async () => {
    const res = await post(`http://127.0.0.1:${PORT}/api/zones`, {
      id: 'z2',
      name: 'test',
      bounds: 'kitchen',
      type: 'alert',
    }, authHeaders);
    expect(res.status).toBe(400);
    expect((res.body as any).error).toContain('bounds');
  });

  it('POST /api/zones with invalid type returns 400', async () => {
    const res = await post(`http://127.0.0.1:${PORT}/api/zones`, {
      id: 'z3',
      name: 'test',
      bounds: { x1: 0, y1: 0, x2: 5, y2: 5 },
      type: 'bogus',
    }, authHeaders);
    expect(res.status).toBe(400);
    expect((res.body as any).error).toContain('type');
  });

  it('POST /api/zones with bounds missing x2 returns 400', async () => {
    const res = await post(`http://127.0.0.1:${PORT}/api/zones`, {
      id: 'z4',
      name: 'test',
      bounds: { x1: 0, y1: 0, y2: 5 },
      type: 'notify',
    }, authHeaders);
    expect(res.status).toBe(400);
    expect((res.body as any).error).toContain('x2');
  });

  it('DELETE /api/zones with valid id returns 200', async () => {
    const createRes = await post(`http://127.0.0.1:${PORT}/api/zones`, {
      id: 'del-zone',
      name: 'ToDelete',
      bounds: { x1: 0, y1: 0, x2: 1, y2: 1 },
      type: 'safe',
    }, authHeaders);
    expect(createRes.status).toBe(200);

    const delRes = await del(`http://127.0.0.1:${PORT}/api/zones`, { id: 'del-zone' }, authHeaders);
    expect(delRes.status).toBe(200);
    expect((delRes.body as any).ok).toBe(true);
  });
});
