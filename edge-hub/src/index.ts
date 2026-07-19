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

const MQTT_PORT = 1883;
const MQTT_WS_PORT = 8083;
const API_PORT = 3000;
const DB_PATH = 'petsense.db';

const db = new DB(DB_PATH);
const broker = new MQTTBroker();
const aggregator = new CSIAggregator(broker);
const engine = new InferenceEngine();
const tracker = new KalmanTracker();
const events = new EventEngine();

const startTime = Date.now();

let mqttConnected = false;
let modelLoaded = false;

// Node positions — configurable via config file in production.
// Default layout: 4 nodes in a 10x8m room.
const nodePositions = new Map<string, NodePosition>([
  ['node-1', { x: 0, y: 0 }],
  ['node-2', { x: 10, y: 0 }],
  ['node-3', { x: 0, y: 8 }],
  ['node-4', { x: 10, y: 8 }],
]);

async function main(): Promise<void> {
  broker.startBroker(MQTT_PORT, MQTT_WS_PORT);
  mqttConnected = true;

  await engine.loadModel('models/petsense-v0.onnx');
  modelLoaded = true;

  new APIServer(API_PORT, {
    db, tracker, events, startTime,
    mqttConnected: () => mqttConnected,
    modelLoaded: () => modelLoaded,
  });

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
