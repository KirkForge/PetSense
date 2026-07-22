import { MQTTBroker } from './mqtt-broker.js';
import { CSIAggregator } from './csi-aggregator.js';
import { InferenceEngine } from './inference.js';
import { KalmanTracker } from './tracker.js';
import { EventEngine } from './event-engine.js';
import { extractFeatures } from './preprocessing.js';
import { APIServer } from './api-server.js';
import { DB } from './db.js';
import { estimatePosition } from './multilateration.js';
import type { AggregatedFrame } from './csi-aggregator.js';
import type { NodePosition } from './multilateration.js';
import { readFileSync, existsSync } from 'node:fs';
import { parse as parseYAML } from 'yaml';

const DB_PATH = 'petsense.db';

const configPath = process.env.PETSENSE_CONFIG ?? 'config.yaml';
const config = parseYAML(readFileSync(configPath, 'utf-8'));

const MQTT_PORT = config.mqtt?.port ?? 1883;
const MQTT_WS_PORT = config.mqtt?.wsPort ?? 8083;
const API_PORT = config.api?.port ?? 3000;
const TLS_ENABLED: boolean = config.api?.tls?.enabled ?? false;
const TLS_CERT: string = config.api?.tls?.certFile ?? '';
const TLS_KEY: string = config.api?.tls?.keyFile ?? '';
const CORS_ORIGINS: string[] = config.api?.cors?.origins ?? [];

const db = new DB(DB_PATH);
const broker = new MQTTBroker();
const aggregator = new CSIAggregator(broker);
const engine = new InferenceEngine();
const tracker = new KalmanTracker();
const events = new EventEngine();

const startTime = Date.now();

let mqttConnected = false;
let modelLoaded = false;

// Node positions from config
const nodePositions = new Map<string, NodePosition>();
for (const node of config.nodes ?? []) {
  if (node.id && node.position) {
    nodePositions.set(node.id, { x: node.position.x, y: node.position.y });
  }
}

async function main(): Promise<void> {
  broker.startBroker(MQTT_PORT, MQTT_WS_PORT);
  mqttConnected = true;

  await engine.loadModel('models/petsense-v0.onnx');
  modelLoaded = true;

  const ctx = {
    db, tracker, events, startTime,
    mqttConnected: () => mqttConnected,
    modelLoaded: () => modelLoaded,
    corsAllowlist: CORS_ORIGINS,
  };

  const apiServer = new APIServer(API_PORT, ctx);
  if (TLS_ENABLED && TLS_CERT && TLS_KEY && existsSync(TLS_CERT) && existsSync(TLS_KEY)) {
    apiServer.startTLS(readFileSync(TLS_CERT), readFileSync(TLS_KEY), API_PORT);
  }

  aggregator.onFrame(async (frame: AggregatedFrame) => {
    try {
      const features = extractFeatures([frame.combinedVector]);
      const result = await engine.classify(features);
      if (result.presence) {
        // Extract RSSI per node from the aggregated frame
        const rssiMap = new Map<string, number>();
        for (const [nodeId, pkt] of Object.entries(frame.nodes)) {
          rssiMap.set(nodeId, pkt.rssi);
        }
        const position = estimatePosition(rssiMap, nodePositions);
        const pos = position ?? { x: 0, y: 0 };
        tracker.update(result.species || 'unknown', pos);
        events.checkZones(result.species || 'unknown', pos);
      }
    } catch (err) { console.error('Pipeline error:', err); }
  });

  console.log('[hub] PetSense edge hub running');
}

function shutdown(): void {
  console.log('[hub] shutting down...');
  mqttConnected = false;
  modelLoaded = false;
  broker.close().then(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch(err => {
  console.error('[hub] fatal:', err);
  process.exit(1);
});
