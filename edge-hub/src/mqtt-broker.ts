import aedesFactory from 'aedes';
import { createServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { EventEmitter } from 'node:events';
import { WebSocket, WebSocketServer, createWebSocketStream } from 'ws';
import type { Server as NetServer } from 'node:net';
import type { Server as HttpServer } from 'node:http';
import { validateMQTTAuth, loadMQTTCredentials } from './auth.js';
import type { MQTTCredentials } from './auth.js';

// ponytail: aedes's default export is the Aedes class constructor (no named
// `Aedes` type export); derive the instance type from it and construct with new.
type Aedes = InstanceType<typeof aedesFactory>;

export const CSI_TOPIC = 'csi/+/+';
export const EVENT_TOPIC = 'events/+';

export interface CSIPacket {
  nodeId: string;
  timestamp: number;
  rssi: number;
  noise: number;
  amplitudes: number[];
  phases: number[];
}

export class MQTTBroker extends EventEmitter {
  private aedes: Aedes;
  private tcpServer: NetServer | null = null;
  private wsServer: HttpServer | null = null;
  private credentials: MQTTCredentials | null;

  constructor() {
    super();
    this.aedes = new aedesFactory();
    this.credentials = loadMQTTCredentials();
    this.setupAuth();
    this.setupHandler();
  }

  private setupAuth(): void {
    if (!this.credentials) return;
    // aedes.authenticate hook — reject clients with wrong credentials
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.aedes as any).authenticate = (client: unknown, username: string | undefined, password: Buffer | undefined, cb: (err: Error | null, success?: boolean) => void) => {
      const pwd = password?.toString() ?? undefined;
      if (validateMQTTAuth(username, pwd, this.credentials)) {
        cb(null, true);
      } else {
        cb(new Error('Authentication failed'));
      }
    };
    console.log('[mqtt] authentication enabled');
  }

  private setupHandler(): void {
    // ponytail: aedes's typed event map omits 'publish' (only clientError/
    // connectionError are declared) though aedes emits it; cast to the EventEmitter
    // base to use the generic string listener. Params typed to the fields used.
    (this.aedes as EventEmitter).on('publish', (packet: { topic: string; payload: Buffer }, client: unknown) => {
      if (!client || !packet.topic.startsWith('csi/')) return;
      try {
        const topicParts = packet.topic.split('/');
        const nodeId = topicParts[1];
        const payload = JSON.parse(packet.payload.toString()) as {
          timestamp: number; rssi: number; noise: number;
          amplitudes: number[]; phases: number[];
        };
        const csi: CSIPacket = {
          nodeId,
          timestamp: payload.timestamp,
          rssi: payload.rssi,
          noise: payload.noise,
          amplitudes: payload.amplitudes,
          phases: payload.phases,
        };
        this.emit('csi', csi);
      } catch {
        // malformed packet, skip
      }
    });
  }

  startBroker(port: number, wsPort: number): void {
    this.tcpServer = createServer(this.aedes.handle as (sock: unknown) => void);
    this.tcpServer.listen(port, () => {
      console.log(`[mqtt] TCP broker on :${port}`);
    });

    const http = createHttpServer();
    // ponytail: aedes 0.50 has no attachHttpServer; bridge WS→MQTT via ws's
    // createWebSocketStream + aedes.handle (the documented aedes-over-WS pattern).
    const wss = new WebSocketServer({ server: http });
    wss.on('connection', (ws: WebSocket) => {
      const stream = createWebSocketStream(ws);
      this.aedes.handle(stream as never);
      stream.on('error', () => { /* client dropped */ });
    });
    this.wsServer = http;
    http.listen(wsPort, () => {
      console.log(`[mqtt] WebSocket broker on :${wsPort}`);
    });
  }

  async close(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.aedes.close(() => {
        this.tcpServer?.close();
        this.wsServer?.close();
        resolve();
      });
    });
  }
}
