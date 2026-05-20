import aedesFactory from 'aedes';
import { createServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { EventEmitter } from 'node:events';
import type { Aedes } from 'aedes';
import type { Server as NetServer } from 'node:net';
import type { Server as HttpServer } from 'node:http';

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

  constructor() {
    super();
    this.aedes = aedesFactory();
    this.setupHandler();
  }

  private setupHandler(): void {
    this.aedes.on('publish', (packet, client) => {
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
    this.aedes.attachHttpServer(http);
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
