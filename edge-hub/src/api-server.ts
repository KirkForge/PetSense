import { createServer } from 'node:http';
import { createServer as createHTTPS } from 'node:https';
import type { IncomingMessage, ServerResponse, Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { DB } from './db.js';
import type { KalmanTracker } from './tracker.js';
import type { EventEngine } from './event-engine.js';
import { validateBearerToken, loadBearerToken, RateLimiter, isOriginAllowed } from './auth.js';
import { child } from './logger.js';

const log = child('api');

interface APIContext {
  db: DB;
  tracker: KalmanTracker;
  events: EventEngine;
  startTime: number;
  mqttConnected: () => boolean;
  modelLoaded: () => boolean;
  corsAllowlist: string[];
}

export class APIServer {
  server: Server;
  private wss: WebSocketServer;
  private ctx: APIContext;
  private bearerToken: string | null;
  private rateLimiter: RateLimiter;

  constructor(port: number, ctx: APIContext) {
    this.ctx = ctx;
    this.bearerToken = loadBearerToken();
    this.rateLimiter = new RateLimiter(60_000, 120);
    this.server = createServer((req, res) => this.handleRequest(req, res));
    this.wss = new WebSocketServer({ noServer: true });
    this.server.on('upgrade', (req, socket, head) => {
      if (req.url !== '/api/realtime') {
        socket.destroy();
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.wss.handleUpgrade(req, socket, head, (ws: any) => {
        this.wss.emit('connection', ws, req);
      });
    });
    this.server.listen(port, () => {
      log.info({ port }, 'API server listening');
    });
  }

  startTLS(cert: Buffer, key: Buffer, port: number): void {
    this.server.close();
    this.server = createHTTPS({ cert, key }, (req, res) => this.handleRequest(req, res));
    this.server.on('upgrade', (req, socket, head) => {
      if (req.url !== '/api/realtime') {
        socket.destroy();
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.wss.handleUpgrade(req, socket, head, (ws: any) => {
        this.wss.emit('connection', ws, req);
      });
    });
    this.server.listen(port, () => {
      log.info({ port, tls: true }, 'API server listening');
    });
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const origin = req.headers.origin;
    if (!isOriginAllowed(origin, this.ctx.corsAllowlist)) {
      res.writeHead(403).end(JSON.stringify({ error: 'origin not allowed' }));
      return;
    }
    setCORS(res, origin, this.ctx.corsAllowlist);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // Rate limit by IP
    const ip = req.socket.remoteAddress ?? 'unknown';
    if (!this.rateLimiter.allow(ip)) {
      res.writeHead(429).end(JSON.stringify({ error: 'rate limit exceeded' }));
      return;
    }

    // Bearer auth (skip for health check)
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname !== '/api/health' && !validateBearerToken(req.headers.authorization, this.bearerToken)) {
      res.writeHead(401).end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/health') {
      this.handleHealth(res);
    } else if (req.method === 'GET' && url.pathname === '/api/pets/location') {
      this.handleLocations(res);
    } else if (req.method === 'GET' && url.pathname === '/api/events') {
      this.handleEvents(res);
    } else if (req.method === 'POST' && url.pathname === '/api/zones') {
      this.readBody(req).then(
        body => this.handleZoneUpsert(body, res),
        () => this.tooLarge(res),
      );
    } else if (req.method === 'DELETE' && url.pathname === '/api/zones') {
      this.readBody(req).then(
        body => this.handleZoneDelete(body, res),
        () => this.tooLarge(res),
      );
    } else if (req.method === 'GET' && url.pathname === '/api/zones') {
      this.handleZoneList(res);
    } else {
      res.writeHead(404).end(JSON.stringify({ error: 'not found' }));
    }
  }

  private handleHealth(res: ServerResponse): void {
    const uptime = Date.now() - this.ctx.startTime;
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
      status: 'ok', uptime, mqttConnected: this.ctx.mqttConnected(), modelLoaded: this.ctx.modelLoaded(),
    }));
  }

  private handleLocations(res: ServerResponse): void {
    const positions = this.ctx.tracker.getAllPositions();
    const pets: Record<string, unknown>[] = [];
    for (const [id, pos] of positions) {
      pets.push({ id, x: pos.x, y: pos.y, vx: pos.vx, vy: pos.vy });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ pets }));
  }

  private handleEvents(res: ServerResponse): void {
    const alerts = this.ctx.events.getAlerts();
    const dbEvents = this.ctx.db.getEvents(50);
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ alerts, events: dbEvents }));
  }

  private handleZoneUpsert(body: string, res: ServerResponse): void {
    try {
      const zone = JSON.parse(body) as { id: unknown; name: unknown; bounds: unknown; type: unknown };
      if (typeof zone.id !== 'string' || typeof zone.name !== 'string' ||
          typeof zone.bounds !== 'string' || typeof zone.type !== 'string' ||
          zone.id.length === 0 || zone.name.length === 0) {
        res.writeHead(400).end(JSON.stringify({
          error: 'invalid zone: id, name, bounds, type must be non-empty strings',
        }));
        return;
      }
      this.ctx.db.upsertZone({ id: zone.id, name: zone.name, bounds: zone.bounds, type: zone.type });
      res.writeHead(200).end(JSON.stringify({ ok: true }));
    } catch {
      res.writeHead(400).end(JSON.stringify({ error: 'invalid body' }));
    }
  }

  private handleZoneDelete(body: string, res: ServerResponse): void {
    try {
      const { id } = JSON.parse(body) as { id: unknown };
      if (typeof id !== 'string' || id.length === 0) {
        res.writeHead(400).end(JSON.stringify({ error: 'invalid zone: id must be a non-empty string' }));
        return;
      }
      this.ctx.db.deleteZone(id);
      res.writeHead(200).end(JSON.stringify({ ok: true }));
    } catch {
      res.writeHead(400).end(JSON.stringify({ error: 'invalid body' }));
    }
  }

  private handleZoneList(res: ServerResponse): void {
    const zones = this.ctx.db.getZones();
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ zones }));
  }

  private tooLarge(res: ServerResponse): void {
    res.writeHead(413, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'body too large' }));
  }

  private readBody(req: IncomingMessage, maxBytes = 1024 * 1024): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > maxBytes) { req.destroy(); reject(new Error('payload too large')); }
      });
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }
}

function setCORS(res: ServerResponse, origin: string | undefined, allowlist: string[]): void {
  if (allowlist.length === 0) {
    if (process.env.PETSENSE_CORS_OPEN === '1') {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  } else if (origin && allowlist.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
