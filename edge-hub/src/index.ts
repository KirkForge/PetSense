import { MQTTBroker } from './mqtt-broker.js';
import { CSIAggregator } from './csi-aggregator.js';
import { InferenceEngine } from './inference.js';
import { KalmanTracker } from './tracker.js';
import { EventEngine } from './event-engine.js';
import { extractFeatures } from './preprocessing.js';
import { APIServer } from './api-server.js';
import { DB } from './db.js';
import type { AggregatedFrame } from './csi-aggregator.js';

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

async function main(): Promise<void> {
  broker.startBroker(MQTT_PORT, MQTT_WS_PORT);

  await engine.loadModel('models/petsense-v0.onnx');

  new APIServer(API_PORT, {
    db, tracker, events, startTime,
    mqttConnected: true, modelLoaded: true,
  });

  aggregator.onFrame(async (frame: AggregatedFrame) => {
    try {
      const features = extractFeatures(frame.combinedVector);
      const result = await engine.classify(features);
      if (result.presence) {
        tracker.update(result.species || 'unknown', { x: 0, y: 0 }); // position from multilateration
        // broadcast via WebSocket
      }
    } catch (err) { console.error('Pipeline error:', err); }
  });

  console.log('[hub] PetSense edge hub running');
}

function shutdown(): void {
  console.log('[hub] shutting down...');
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
