import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse, Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { DB } from './db.js';
import type { KalmanTracker } from './tracker.js';
import type { EventEngine } from './event-engine.js';

interface APIContext {
  db: DB;
  tracker: KalmanTracker;
  events: EventEngine;
  startTime: number;
  mqttConnected: boolean;
  modelLoaded: boolean;
}

export class APIServer {
  private server: Server;
  private wss: WebSocketServer;
  private ctx: APIContext;

  constructor(port: number, ctx: APIContext) {
    this.ctx = ctx;
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
      console.log(`[api] listening on :${port}`);
    });
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    setCORS(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/api/health') {
      this.handleHealth(res);
    } else if (req.method === 'GET' && url.pathname === '/api/pets/location') {
      this.handleLocations(res);
    } else if (req.method === 'GET' && url.pathname === '/api/events') {
      this.handleEvents(res);
    } else if (req.method === 'POST' && url.pathname === '/api/zones') {
      this.readBody(req).then(body => this.handleZoneUpsert(body, res));
    } else if (req.method === 'DELETE' && url.pathname === '/api/zones') {
      this.readBody(req).then(body => this.handleZoneDelete(body, res));
    } else if (req.method === 'GET' && url.pathname === '/api/zones') {
      this.handleZoneList(res);
    } else {
      res.writeHead(404).end(JSON.stringify({ error: 'not found' }));
    }
  }

  private handleHealth(res: ServerResponse): void {
    const uptime = Date.now() - this.ctx.startTime;
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
      status: 'ok', uptime, mqttConnected: this.ctx.mqttConnected, modelLoaded: this.ctx.modelLoaded,
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
      const zone = JSON.parse(body) as { id: string; name: string; bounds: string; type: string };
      this.ctx.db.upsertZone(zone);
      res.writeHead(200).end(JSON.stringify({ ok: true }));
    } catch {
      res.writeHead(400).end(JSON.stringify({ error: 'invalid body' }));
    }
  }

  private handleZoneDelete(body: string, res: ServerResponse): void {
    try {
      const { id } = JSON.parse(body) as { id: string };
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

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => resolve(body));
    });
  }
}

function setCORS(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
